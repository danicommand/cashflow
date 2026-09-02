import { useCallback, useEffect, useRef, useState } from "react";

import type { Ledger } from "../types.ts";
import { pruneLedger } from "../services/merge.ts";
import { isUsableCode, syncLedger } from "../services/syncClient.ts";

export interface SyncStatus {
  state: "off" | "idle" | "syncing" | "error";
  lastSyncedAt: string | null;
}

/** How long to wait after the last edit before pushing. */
const QUIET_PERIOD_MS = 2_500;

function signatureOf(ledger: Ledger): string {
  return JSON.stringify(pruneLedger(ledger));
}

/**
 * Keeps the local ledger and the cloud copy in step.
 *
 * Sync is deliberately never on the critical path: every edit is already saved
 * locally before this hook hears about it, and a failure leaves the app fully
 * usable. A push is scheduled once the edits stop rather than per keystroke,
 * and skipped when the ledger has not actually changed — otherwise applying a
 * merge result would itself look like a change and the two sides would ping
 * each other forever.
 */
export function useSync(
  code: string,
  ledger: Ledger,
  applyMerged: (merged: Ledger) => void,
): { status: SyncStatus; syncNow: () => void } {
  const [status, setStatus] = useState<SyncStatus>({
    state: isUsableCode(code) ? "idle" : "off",
    lastSyncedAt: null,
  });

  const ledgerRef = useRef(ledger);
  ledgerRef.current = ledger;
  const applyRef = useRef(applyMerged);
  applyRef.current = applyMerged;

  const lastSentRef = useRef<string | null>(null);
  const inFlightRef = useRef<AbortController | null>(null);

  const run = useCallback(
    async (force: boolean) => {
      if (!isUsableCode(code)) {
        setStatus({ state: "off", lastSyncedAt: null });
        return;
      }

      const signature = signatureOf(ledgerRef.current);
      if (!force && signature === lastSentRef.current) return;

      inFlightRef.current?.abort();
      const controller = new AbortController();
      inFlightRef.current = controller;
      setStatus((current) => ({ ...current, state: "syncing" }));

      try {
        const merged = await syncLedger(code, ledgerRef.current, controller.signal);
        if (controller.signal.aborted) return;
        // Record what the server now holds, not what was sent: the merge can
        // add records this device did not have, and those must not look like
        // a fresh local change on the next tick.
        lastSentRef.current = signatureOf(merged);
        applyRef.current(merged);
        setStatus({ state: "idle", lastSyncedAt: new Date().toISOString() });
      } catch (error) {
        if (controller.signal.aborted || (error as Error).name === "AbortError") return;
        setStatus((current) => ({ ...current, state: "error" }));
      } finally {
        if (inFlightRef.current === controller) inFlightRef.current = null;
      }
    },
    [code],
  );

  const syncNow = useCallback(() => {
    void run(true);
  }, [run]);

  // A new code is a different space; nothing known about the old one carries
  // over, so pull straight away.
  useEffect(() => {
    lastSentRef.current = null;
    if (!isUsableCode(code)) {
      setStatus({ state: "off", lastSyncedAt: null });
      return;
    }
    void run(true);
  }, [code, run]);

  useEffect(() => {
    if (!isUsableCode(code)) return;
    const timer = window.setTimeout(() => void run(false), QUIET_PERIOD_MS);
    return () => window.clearTimeout(timer);
  }, [code, ledger, run]);

  // Coming back to the tab, or back online, is when another device's changes
  // are most likely to be waiting.
  useEffect(() => {
    if (!isUsableCode(code)) return;
    const onWake = () => {
      if (document.visibilityState === "visible") void run(true);
    };
    const onOnline = () => void run(true);
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("online", onOnline);
    };
  }, [code, run]);

  useEffect(() => () => inFlightRef.current?.abort(), []);

  return { status, syncNow };
}
