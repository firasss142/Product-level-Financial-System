import type { BadgeVariant } from "@/components/ui";

const NUMBER_FMT = new Intl.NumberFormat("fr-TN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DATE_FMT_SHORT = new Intl.DateTimeFormat("fr-TN", { dateStyle: "short" });
const DATE_FMT_MEDIUM = new Intl.DateTimeFormat("fr-TN", { dateStyle: "medium" });
const DATETIME_FMT = new Intl.DateTimeFormat("fr-TN", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function fmtNumber(n: number): string {
  return NUMBER_FMT.format(n);
}

export function fmtPrice(value: number | null): string {
  if (value === null) return "—";
  return NUMBER_FMT.format(value);
}

export function fmtDateShort(iso: string): string {
  return DATE_FMT_SHORT.format(new Date(iso));
}

export function fmtDateMedium(iso: string): string {
  return DATE_FMT_MEDIUM.format(new Date(iso));
}

export function fmtDateTime(iso: string): string {
  return DATETIME_FMT.format(new Date(iso));
}

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  abandoned: "Abandonné",
  attempt: "Tentative",
  confirmed: "Confirmé",
  rejected: "Rejeté",
  uploaded: "Téléchargé",
  deposit: "Dépôt",
  "in transit": "En transit",
  unverified: "Non vérifié",
  delivered: "Livré",
  to_be_returned: "À retourner",
  returned: "Retourné",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function statusBadgeVariant(status: string): BadgeVariant {
  if (status === "delivered") return "delivered";
  if (status === "returned" || status === "to_be_returned") return "returned";
  if (status === "pending" || status === "abandoned" || status === "rejected") return "rejected";
  if (status === "confirmed" || status === "attempt") return "pending";
  return "default";
}

export function timelineDotColor(status: string): string {
  if (status === "delivered") return "bg-emerald";
  if (status === "returned" || status === "to_be_returned") return "bg-terracotta";
  if (status === "pending" || status === "abandoned" || status === "rejected") return "bg-warm-gray-400";
  if (status === "confirmed" || status === "attempt") return "bg-amber";
  return "bg-navy/40";
}
