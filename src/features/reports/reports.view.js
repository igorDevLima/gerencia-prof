// Tela de relatórios (pendências por mês).
import { view, emptyCard, bindGoButtons } from "../../app/shell.js";
import { escapeHtml } from "../../core/ui/escape.js";
import { formatMonth, formatDate, pluralize } from "../../core/ui/format.js";
import { toast } from "../../core/ui/toast.js";
import { deliverFile } from "../../app/deliver.js";
import { getMonthsWithTasks } from "../tasks/tasks.store.js";
import { getMonthlyReport } from "./reports.store.js";

let reportsMonth = "";

export function renderReports() {
  const months = getMonthsWithTasks();
  if (months.length === 0) {
    view.innerHTML = `
      <div class="section-head"><div><h2 class="mt-0 mb-0">Relatórios</h2>
        <p>Pendências de entrega por mês.</p></div></div>` +
      emptyCard("📄", "Nada para relatar ainda",
        "Crie tarefas e atribua professores para gerar relatórios de pendências.",
        `<button class="btn" data-go="tarefas">Ir para tarefas</button>`);
    bindGoButtons();
    return;
  }

  if (!reportsMonth || !months.includes(reportsMonth)) {
    const current = new Date().toISOString().slice(0, 7);
    reportsMonth = months.includes(current) ? current : months[0];
  }
  const report = getMonthlyReport(reportsMonth);

  let html = `
    <div class="section-head no-print">
      <div>
        <h2 class="mt-0 mb-0">Relatórios</h2>
        <p>Professores que não entregaram as tarefas do mês.</p>
      </div>
      <div class="flex gap wrap">
        <select class="select" id="reportMonth" style="max-width:220px">
          ${months.map((m) => `<option value="${m}" ${m === reportsMonth ? "selected" : ""}>${escapeHtml(formatMonth(m))}</option>`).join("")}
        </select>
        <button class="btn btn--ghost btn--sm" id="printReport">🖨️ Imprimir / PDF</button>
        <button class="btn btn--ghost btn--sm" id="csvReport">⬇️ CSV</button>
      </div>
    </div>

    <div class="card">
      <div class="card__body">
        <h2 class="mt-0">Relatório de ${escapeHtml(formatMonth(reportsMonth))}</h2>
        <p class="muted text-sm">
          ${report.totalTasks} ${pluralize(report.totalTasks, "tarefa", "tarefas")} no mês •
          ${report.pendingTeachers.length} ${pluralize(report.pendingTeachers.length, "professor com pendência", "professores com pendência")}
        </p>`;

  if (report.pendingTeachers.length === 0) {
    html += `<div class="badge badge--success" style="font-size:.95rem;padding:10px 16px;">
      ✓ Todos os professores entregaram as tarefas de ${escapeHtml(formatMonth(reportsMonth))}.</div>`;
  } else {
    html += `<h3>Professores com entregas pendentes</h3>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Professor</th><th>E-mail</th><th>Tarefas não entregues</th></tr></thead>
        <tbody>`;
    report.pendingTeachers.forEach((p) => {
      html += `<tr>
        <td><strong>${escapeHtml(p.teacher.name)}</strong></td>
        <td>${escapeHtml(p.teacher.email || "—")}</td>
        <td>${p.tasks.map((t) => escapeHtml(t)).join("<br>")}</td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
  }
  html += `</div></div>`;

  html += `<div class="card"><div class="card__body">
    <h2 class="mt-0">Detalhamento por tarefa</h2>`;
  if (report.tasks.length === 0) {
    html += `<p class="muted mb-0">Nenhuma tarefa neste mês.</p>`;
  } else {
    report.tasks.forEach((tr) => {
      const statusBadge = tr.total === 0
        ? `<span class="badge badge--muted">Sem responsáveis</span>`
        : tr.pendingCount === 0
          ? `<span class="badge badge--success">✓ Completa</span>`
          : `<span class="badge badge--danger">${tr.pendingCount} ${pluralize(tr.pendingCount, "pendente", "pendentes")}</span>`;
      html += `
        <div style="margin-bottom:18px">
          <div class="flex between center wrap" style="gap:8px">
            <h3 class="mb-0">${escapeHtml(tr.task.title)}</h3>
            ${statusBadge}
          </div>
          <div class="text-sm muted" style="margin:4px 0 8px">
            ${tr.task.type === "monthly" ? "Mensal" : "Avulsa"}
            ${tr.task.dueDate ? " • Entrega: " + escapeHtml(formatDate(tr.task.dueDate)) : ""}
            • ${tr.deliveredCount}/${tr.total} entregaram
          </div>
          ${tr.pendingCount > 0
            ? `<div class="text-sm"><strong>Não entregaram:</strong> ${tr.pending.map((p) => escapeHtml(p.teacher.name)).join(", ")}</div>`
            : tr.total > 0 ? `<div class="text-sm muted">Todos entregaram.</div>` : ""}
        </div>`;
    });
  }
  html += `</div></div>`;

  view.innerHTML = html;
  view.querySelector("#reportMonth").addEventListener("change", (e) => {
    reportsMonth = e.target.value;
    renderReports();
  });
  view.querySelector("#printReport").addEventListener("click", () => window.print());
  view.querySelector("#csvReport").addEventListener("click", () => exportReportCsv(report));
  bindGoButtons();
}

function exportReportCsv(report) {
  const rows = [["Professor", "E-mail", "Tarefa nao entregue", "Mes de referencia"]];
  report.pendingTeachers.forEach((p) => {
    p.tasks.forEach((task) => {
      rows.push([p.teacher.name, p.teacher.email || "", task, formatMonth(report.month)]);
    });
  });
  if (rows.length === 1) rows.push(["(nenhuma pendencia)", "", "", formatMonth(report.month)]);
  const csv = rows.map((r) => r.map(csvCell).join(";")).join("\r\n");
  // BOM (﻿) garante acentuação correta ao abrir no Excel.
  deliverFile(`pendencias-${report.month}.csv`, "﻿" + csv, "text/csv;charset=utf-8", "CSV");
}

function csvCell(value) {
  const s = String(value == null ? "" : value);
  return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
