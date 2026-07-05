// Painel (indicadores + situação do mês atual).
import { view, emptyCard, bindGoButtons } from "../../app/shell.js";
import { escapeHtml } from "../../core/ui/escape.js";
import { formatMonth, pluralize } from "../../core/ui/format.js";
import { getStats } from "./dashboard.store.js";
import { getMonthlyReport } from "../reports/reports.store.js";

function renderMonthSummary(report) {
  if (report.totalTasks === 0) {
    return `<p class="muted mb-0">Nenhuma tarefa com referência neste mês.
      <a href="#/tarefas">Criar uma tarefa</a>.</p>`;
  }
  if (report.pendingTeachers.length === 0) {
    return `<div class="badge badge--success" style="font-size:.9rem;padding:8px 14px;">
      ✓ Todos os professores entregaram as tarefas deste mês.</div>`;
  }
  let html = `<p class="text-sm muted mt-0">Professores com alguma entrega pendente:</p>
    <div class="list">`;
  report.pendingTeachers.forEach((p) => {
    html += `
      <div class="delivery">
        <div class="delivery__info">
          <div class="delivery__name">${escapeHtml(p.teacher.name)}</div>
          <div class="delivery__sub">${escapeHtml(p.tasks.join(" • "))}</div>
        </div>
        <span class="badge badge--danger">${p.tasks.length} ${pluralize(p.tasks.length, "tarefa", "tarefas")}</span>
      </div>`;
  });
  html += `</div>`;
  return html;
}

export function renderDashboard() {
  const s = getStats();
  const report = getMonthlyReport(s.currentMonth);

  let html = `
    <div class="stats">
      <div class="stat stat--primary">
        <div class="stat__value">${s.teachers}</div>
        <div class="stat__label">${pluralize(s.teachers, "Professor cadastrado", "Professores cadastrados")}</div>
      </div>
      <div class="stat">
        <div class="stat__value">${s.tasks}</div>
        <div class="stat__label">${pluralize(s.tasks, "Tarefa criada", "Tarefas criadas")}</div>
      </div>
      <div class="stat stat--warning">
        <div class="stat__value">${s.pendingDeliveries}</div>
        <div class="stat__label">${pluralize(s.pendingDeliveries, "Entrega pendente", "Entregas pendentes")} (total)</div>
      </div>
      <div class="stat stat--danger">
        <div class="stat__value">${s.currentMonthPendingTeachers}</div>
        <div class="stat__label">Com pendência em ${escapeHtml(formatMonth(s.currentMonth))}</div>
      </div>
    </div>`;

  if (s.teachers === 0) {
    html += emptyCard("👋", "Bem-vindo!",
      "Comece cadastrando seus professores e as matérias que cada um leciona.",
      `<button class="btn" data-go="professores">Cadastrar professores</button>`);
    view.innerHTML = html;
    bindGoButtons();
    return;
  }

  html += `
    <div class="card">
      <div class="card__body">
        <div class="section-head">
          <div>
            <h2 class="mt-0 mb-0">Situação de ${escapeHtml(formatMonth(s.currentMonth))}</h2>
            <p>Entregas das tarefas com referência neste mês.</p>
          </div>
          <button class="btn btn--ghost btn--sm" data-go="relatorios">Ver relatório completo →</button>
        </div>
        ${renderMonthSummary(report)}
      </div>
    </div>`;

  const tasksWithPending = report.tasks.filter((t) => t.pendingCount > 0).slice(0, 5);
  if (tasksWithPending.length) {
    html += `<div class="card"><div class="card__body">
      <h2 class="mt-0">Tarefas com pendências este mês</h2>
      <div class="list">`;
    tasksWithPending.forEach((tr) => {
      html += `
        <div class="delivery">
          <div class="delivery__info">
            <div class="delivery__name">${escapeHtml(tr.task.title)}</div>
            <div class="delivery__sub">${tr.deliveredCount}/${tr.total} entregaram</div>
          </div>
          <span class="badge badge--danger">${tr.pendingCount} ${pluralize(tr.pendingCount, "pendente", "pendentes")}</span>
        </div>`;
    });
    html += `</div></div></div>`;
  }

  view.innerHTML = html;
  bindGoButtons();
}
