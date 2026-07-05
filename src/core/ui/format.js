// Formatação de datas/meses e utilidades de texto (pt-BR).
const MONTHS_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// "2026-06" -> "Junho de 2026"
export function formatMonth(ym) {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return "—";
  const [y, m] = ym.split("-").map(Number);
  const name = MONTHS_PT[m - 1] || "";
  return capitalize(name) + " de " + y;
}

// "2026-06-30" -> "30/06/2026"
export function formatDate(iso) {
  if (!iso) return "";
  const datePart = String(iso).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return "";
  const [y, m, d] = datePart.split("-");
  return `${d}/${m}/${y}`;
}

// ISO timestamp -> "30/06/2026 14:32"
export function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// pluralize(2, "professor", "professores")
export function pluralize(n, singular, plural) {
  return n === 1 ? singular : plural;
}
