/**
 * An optional PIN gate in front of the app.
 *
 * The PIN never leaves the device — there is no server involved, so there is
 * nothing to send it to. What is stored is a salted SHA-256 hash, the same
 * shape a real login system uses, so a copy of localStorage does not hand
 * over the PIN itself.
 *
 * There is no recovery path, by construction: a purely local, no-account
 * system cannot verify who is asking to reset a forgotten PIN. The one way
 * back in is `clearLock`, which the settings screen offers only alongside
 * the same warning "Erase everything" already carries — losing the PIN
 * means losing this device's copy of the data, not just the lock.
 */

const HASH_KEY = "cashflow.lock.v1";

interface StoredLock {
  salt: string;
  hash: string;
}

function randomHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return [...array].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function digest(pin: string, salt: string): Promise<string> {
  const encoded = new TextEncoder().encode(`${salt}:${pin}`);
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readStored(): StoredLock | null {
  try {
    const raw = window.localStorage.getItem(HASH_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as StoredLock).salt === "string" &&
      typeof (parsed as StoredLock).hash === "string"
    ) {
      return parsed as StoredLock;
    }
    return null;
  } catch {
    return null;
  }
}

export function hasLock(): boolean {
  return readStored() !== null;
}

export async function setLock(pin: string): Promise<void> {
  const salt = randomHex(16);
  const hash = await digest(pin, salt);
  window.localStorage.setItem(HASH_KEY, JSON.stringify({ salt, hash }));
}

export async function verifyLock(pin: string): Promise<boolean> {
  const stored = readStored();
  if (!stored) return true;
  const hash = await digest(pin, stored.salt);
  return hash === stored.hash;
}

export function clearLock(): void {
  window.localStorage.removeItem(HASH_KEY);
}

export const MIN_PIN_LENGTH = 4;
