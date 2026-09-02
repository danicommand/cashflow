/**
 * Translations.
 *
 * English is the source of truth: `TranslationKey` is derived from it, so a
 * Portuguese dictionary missing a key fails the type check rather than
 * shipping an English string into a Portuguese screen. Month and weekday names
 * come from `Intl` instead of being listed here — the platform already knows
 * them, in every language, with the right capitalisation.
 */

import type { Language } from "./types.ts";

const en = {
  appName: "Cashflow",
  tagline: "What you owe, what you earn, what is left.",

  "nav.month": "Month",
  "nav.calendar": "Calendar",
  "nav.settings": "Settings",

  "month.previous": "Previous month",
  "month.next": "Next month",
  "month.today": "Today",

  "summary.leftToPay": "Left to pay",
  "summary.paidOf": "{paid} paid of {total}",
  "summary.overdue": "Overdue",
  "summary.dueLater": "Still ahead",
  "summary.income": "Income",
  "summary.received": "Received",
  "summary.expected": "Expected",
  "summary.balance": "Balance",
  "summary.balanceHint": "Received minus paid, so far",
  "summary.allPaid": "Everything for this month is settled.",
  "summary.empty": "Nothing logged for this month yet.",
  "summary.emptyHint": "Add a bill or an amount you received to get started.",

  "list.expenses": "Bills",
  "list.income": "Income",
  "list.paid": "Paid",
  "list.unpaid": "Unpaid",
  "list.showPaid": "Show settled",
  "list.hidePaid": "Hide settled",

  "status.overdue": "Overdue",
  "status.overdueDays": "{count} days late",
  "status.dueToday": "Due today",
  "status.dueTomorrow": "Due tomorrow",
  "status.dueInDays": "In {count} days",
  "status.paidOn": "Paid {date}",
  "status.receivedOn": "Received {date}",
  "status.instalment": "{current} of {total}",

  "action.add": "Add",
  "action.addExpense": "Add a bill",
  "action.addIncome": "Add income",
  "action.save": "Save",
  "action.cancel": "Cancel",
  "action.delete": "Delete",
  "action.edit": "Edit",
  "action.markPaid": "Mark paid",
  "action.markReceived": "Mark received",
  "action.undo": "Undo",
  "action.close": "Close",
  "action.back": "Back",

  "form.newExpense": "New bill",
  "form.newIncome": "New income",
  "form.editExpense": "Edit bill",
  "form.editIncome": "Edit income",
  "form.kind": "Type",
  "form.expense": "Bill",
  "form.income": "Income",
  "form.description": "Description",
  "form.descriptionPlaceholder": "Rent, power, salary…",
  "form.amount": "Amount",
  "form.dueDate": "Due date",
  "form.receiveDate": "Date",
  "form.repeat": "Repeats",
  "form.repeatCount": "How many times",
  "form.repeatForever": "Keep going",
  "form.repeatTimes": "{count} times",
  "form.category": "Category",
  "form.categoryPlaceholder": "Optional",
  "form.note": "Note",
  "form.notePlaceholder": "Optional",
  "form.errorDescription": "Give it a name.",
  "form.errorAmount": "Enter an amount above zero.",
  "form.errorDate": "Pick a valid date.",
  "form.deleteConfirm": "Delete this and everything recorded against it?",
  "form.splitHint": "{count} × {amount}",

  "repeat.none": "One time",
  "repeat.weekly": "Every week",
  "repeat.monthly": "Every month",
  "repeat.yearly": "Every year",

  "pay.titleExpense": "Mark as paid",
  "pay.titleIncome": "Mark as received",
  "pay.amountExpense": "Amount paid",
  "pay.amountIncome": "Amount received",
  "pay.date": "On",
  "pay.differs": "Different from the {amount} planned.",

  "calendar.noItems": "Nothing on this day.",
  "calendar.legendDue": "Due",
  "calendar.legendSettled": "Settled",
  "calendar.legendIncome": "Income",

  "categories.title": "Where it goes",
  "categories.uncategorised": "Uncategorised",

  "settings.appearance": "Appearance",
  "settings.language": "Language",
  "settings.currency": "Currency",
  "settings.theme": "Theme",
  "theme.system": "System",
  "theme.light": "Light",
  "theme.dark": "Dark",

  "settings.sync": "Sync across devices",
  "settings.syncHelp":
    "Type the same personal code on your phone and your computer and both will show the same ledger. Anyone who knows the code can read it, so make it long and keep it to yourself.",
  "settings.syncCode": "Personal code",
  "settings.syncCodePlaceholder": "at least 8 characters",
  "settings.generate": "Suggest one",
  "settings.syncNow": "Sync now",
  "settings.syncOff": "Turn off sync",
  "settings.syncing": "Syncing…",
  "settings.syncedAt": "Last synced {time}",
  "settings.syncNever": "Not synced yet",
  "settings.syncFailed": "Could not sync. Check the connection and try again.",
  "settings.syncTooShort": "Use at least 8 characters.",
  "settings.syncOn": "Sync is on",

  "settings.data": "Your data",
  "settings.dataHint": "{entries} entries and {payments} payments on this device.",
  "settings.export": "Download a backup",
  "settings.import": "Restore from a backup",
  "settings.importDone": "Restored {entries} entries and {payments} payments.",
  "settings.importFailed": "That file could not be read.",
  "settings.erase": "Erase everything on this device",
  "settings.eraseConfirm":
    "Erase every entry and payment stored on this device? If sync is on, the data stays in the cloud.",

  "settings.about": "About",
  "settings.aboutText":
    "Everything is stored on this device first, so the app works with no connection. Sync only runs when a personal code is set.",
} as const;

export type TranslationKey = keyof typeof en;

/** Every key, so a test can walk the whole dictionary rather than a sample. */
export const TRANSLATION_KEYS = Object.keys(en) as TranslationKey[];

const pt: Record<TranslationKey, string> = {
  appName: "Cashflow",
  tagline: "O que você deve, o que você recebe, o que falta.",

  "nav.month": "Mês",
  "nav.calendar": "Calendário",
  "nav.settings": "Ajustes",

  "month.previous": "Mês anterior",
  "month.next": "Próximo mês",
  "month.today": "Hoje",

  "summary.leftToPay": "Falta pagar",
  "summary.paidOf": "{paid} pagos de {total}",
  "summary.overdue": "Em atraso",
  "summary.dueLater": "A vencer",
  "summary.income": "Recebimentos",
  "summary.received": "Recebido",
  "summary.expected": "Previsto",
  "summary.balance": "Saldo",
  "summary.balanceHint": "Recebido menos pago, até agora",
  "summary.allPaid": "Tudo deste mês está quitado.",
  "summary.empty": "Nada lançado neste mês ainda.",
  "summary.emptyHint": "Lance uma conta ou um valor recebido para começar.",

  "list.expenses": "Contas",
  "list.income": "Recebimentos",
  "list.paid": "Pago",
  "list.unpaid": "Em aberto",
  "list.showPaid": "Mostrar quitados",
  "list.hidePaid": "Ocultar quitados",

  "status.overdue": "Vencida",
  "status.overdueDays": "{count} dias de atraso",
  "status.dueToday": "Vence hoje",
  "status.dueTomorrow": "Vence amanhã",
  "status.dueInDays": "Em {count} dias",
  "status.paidOn": "Pago em {date}",
  "status.receivedOn": "Recebido em {date}",
  "status.instalment": "{current} de {total}",

  "action.add": "Lançar",
  "action.addExpense": "Lançar conta",
  "action.addIncome": "Lançar recebimento",
  "action.save": "Salvar",
  "action.cancel": "Cancelar",
  "action.delete": "Excluir",
  "action.edit": "Editar",
  "action.markPaid": "Marcar como pago",
  "action.markReceived": "Marcar como recebido",
  "action.undo": "Desfazer",
  "action.close": "Fechar",
  "action.back": "Voltar",

  "form.newExpense": "Nova conta",
  "form.newIncome": "Novo recebimento",
  "form.editExpense": "Editar conta",
  "form.editIncome": "Editar recebimento",
  "form.kind": "Tipo",
  "form.expense": "Conta",
  "form.income": "Recebimento",
  "form.description": "Descrição",
  "form.descriptionPlaceholder": "Aluguel, luz, salário…",
  "form.amount": "Valor",
  "form.dueDate": "Vencimento",
  "form.receiveDate": "Data",
  "form.repeat": "Repete",
  "form.repeatCount": "Quantas vezes",
  "form.repeatForever": "Sempre",
  "form.repeatTimes": "{count} vezes",
  "form.category": "Categoria",
  "form.categoryPlaceholder": "Opcional",
  "form.note": "Observação",
  "form.notePlaceholder": "Opcional",
  "form.errorDescription": "Dê um nome ao lançamento.",
  "form.errorAmount": "Informe um valor maior que zero.",
  "form.errorDate": "Escolha uma data válida.",
  "form.deleteConfirm": "Excluir este lançamento e tudo que foi registrado nele?",
  "form.splitHint": "{count} × {amount}",

  "repeat.none": "Única",
  "repeat.weekly": "Toda semana",
  "repeat.monthly": "Todo mês",
  "repeat.yearly": "Todo ano",

  "pay.titleExpense": "Marcar como pago",
  "pay.titleIncome": "Marcar como recebido",
  "pay.amountExpense": "Valor pago",
  "pay.amountIncome": "Valor recebido",
  "pay.date": "Em",
  "pay.differs": "Diferente dos {amount} previstos.",

  "calendar.noItems": "Nada neste dia.",
  "calendar.legendDue": "A pagar",
  "calendar.legendSettled": "Quitado",
  "calendar.legendIncome": "Recebimento",

  "categories.title": "Para onde vai",
  "categories.uncategorised": "Sem categoria",

  "settings.appearance": "Aparência",
  "settings.language": "Idioma",
  "settings.currency": "Moeda",
  "settings.theme": "Tema",
  "theme.system": "Do sistema",
  "theme.light": "Claro",
  "theme.dark": "Escuro",

  "settings.sync": "Sincronizar entre aparelhos",
  "settings.syncHelp":
    "Digite o mesmo código pessoal no celular e no computador para ver os mesmos lançamentos nos dois. Quem souber o código consegue ler tudo, então use um código longo e guarde só com você.",
  "settings.syncCode": "Código pessoal",
  "settings.syncCodePlaceholder": "pelo menos 8 caracteres",
  "settings.generate": "Sugerir um",
  "settings.syncNow": "Sincronizar agora",
  "settings.syncOff": "Desligar sincronização",
  "settings.syncing": "Sincronizando…",
  "settings.syncedAt": "Sincronizado às {time}",
  "settings.syncNever": "Ainda não sincronizado",
  "settings.syncFailed": "Não deu para sincronizar. Verifique a conexão e tente de novo.",
  "settings.syncTooShort": "Use pelo menos 8 caracteres.",
  "settings.syncOn": "Sincronização ligada",

  "settings.data": "Seus dados",
  "settings.dataHint": "{entries} lançamentos e {payments} pagamentos neste aparelho.",
  "settings.export": "Baixar um backup",
  "settings.import": "Restaurar de um backup",
  "settings.importDone": "Restaurados {entries} lançamentos e {payments} pagamentos.",
  "settings.importFailed": "Não foi possível ler esse arquivo.",
  "settings.erase": "Apagar tudo deste aparelho",
  "settings.eraseConfirm":
    "Apagar todos os lançamentos e pagamentos guardados neste aparelho? Se a sincronização estiver ligada, os dados continuam na nuvem.",

  "settings.about": "Sobre",
  "settings.aboutText":
    "Tudo fica guardado primeiro neste aparelho, então o app funciona sem internet. A sincronização só acontece quando há um código pessoal.",
};

const DICTIONARIES: Record<Language, Record<TranslationKey, string>> = { en, pt };

export const LANGUAGES: { code: Language; label: string }[] = [
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
];

export const LOCALE_OF: Record<Language, string> = {
  en: "en-US",
  pt: "pt-BR",
};

/**
 * Look up a string and fill in `{placeholders}`. Missing keys are impossible
 * by construction, so there is no fallback path to get wrong.
 */
export function translate(
  language: Language,
  key: TranslationKey,
  values?: Record<string, string | number>,
): string {
  const template = DICTIONARIES[language][key];
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

export type Translator = (
  key: TranslationKey,
  values?: Record<string, string | number>,
) => string;

export function translatorFor(language: Language): Translator {
  return (key, values) => translate(language, key, values);
}

/** The language to open with when nothing has been chosen yet. */
export function detectLanguage(candidates: readonly string[]): Language {
  for (const candidate of candidates) {
    if (candidate.toLowerCase().startsWith("pt")) return "pt";
    if (candidate.toLowerCase().startsWith("en")) return "en";
  }
  return "en";
}
