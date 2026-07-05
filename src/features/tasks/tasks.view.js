// Tela de tarefas (lista, cartões, formulário, marcação de entregas).
import { view, emptyCard, bindGoButtons } from "../../app/shell.js";
import { escapeHtml } from "../../core/ui/escape.js";
import { formatMonth, formatDate, formatDateTime, pluralize } from "../../core/ui/format.js";
import { toast } from "../../core/ui/toast.js";
import { openModal, closeModal, confirmDialog } from "../../core/ui/modal.js";
import {
  getTasks, getTask, addTask, updateTask, deleteTask, setDelivery,
  taskMonth, getMonthsWithTasks, firstFridayOf,
} from "./tasks.store.js";
import { getTeachers } from "../teachers/teachers.store.js";
import { openShareModal } from "./tasks.share.js";

const expandedTasks = new Set();
let tasksFilterMonth = "";

export function renderTasks() {
  const teachers = getTeachers();
  let tasks = getTasks();
  const months = getMonthsWithTasks();

  let html = `
    <div class="section-head">
      <div>
        <h2 class="mt-0 mb-0">Tarefas</h2>
        <p>Crie tarefas e marque quem já entregou.</p>
      </div>
      <button class="btn" data-new-task ${teachers.length ? "" : "disabled title='Cadastre um professor antes'"}>+ Nova tarefa</button>
    </div>`;

  if (teachers.length === 0) {
    html += emptyCard("📝", "Cadastre professores primeiro",
      "As tarefas são atribuídas aos professores. Cadastre ao menos um professor para começar.",
      `<button class="btn" data-go="professores">Ir para professores</button>`);
    view.innerHTML = html;
    bindGoButtons();
    view.querySelectorAll("[data-new-task]").forEach((b) => b.setAttribute("disabled", ""));
    return;
  }

  if (tasksFilterMonth && !months.includes(tasksFilterMonth)) tasksFilterMonth = "";
  if (months.length) {
    html += `<div class="card" style="margin-bottom:16px"><div class="card__body" style="padding:12px 16px">
      <div class="flex gap center wrap">
        <label for="taskMonthFilter" class="text-sm" style="font-weight:600">Filtrar por mês:</label>
        <select class="select" id="taskMonthFilter" style="max-width:240px">
          <option value="">Todos os meses</option>
          ${months.map((m) => `<option value="${m}" ${m === tasksFilterMonth ? "selected" : ""}>${escapeHtml(formatMonth(m))}</option>`).join("")}
        </select>
      </div>
    </div></div>`;
  }

  if (tasksFilterMonth) tasks = tasks.filter((t) => taskMonth(t) === tasksFilterMonth);

  if (tasks.length === 0) {
    html += emptyCard("📝",
      tasksFilterMonth ? "Nenhuma tarefa neste mês" : "Nenhuma tarefa ainda",
      tasksFilterMonth ? "Tente outro mês ou crie uma nova tarefa." : "Crie a primeira tarefa e atribua aos professores responsáveis.",
      `<button class="btn" data-new-task>Nova tarefa</button>`);
    view.innerHTML = html;
    bindTaskActions(teachers);
    return;
  }

  html += `<div class="list" id="taskList">`;
  tasks.forEach((task) => { html += renderTaskCard(task); });
  html += `</div>`;
  view.innerHTML = html;
  bindTaskActions(teachers);
}

function renderTaskCard(task) {
  const teacherMap = new Map(getTeachers().map((t) => [t.id, t]));
  const total = task.assignments.length;
  const delivered = task.assignments.filter((a) => a.delivered).length;
  const pending = total - delivered;
  const pct = total ? Math.round((delivered / total) * 100) : 0;
  const expanded = expandedTasks.has(task.id);

  const typeBadge = task.type === "monthly"
    ? `<span class="badge badge--info">📅 Mensal</span>`
    : `<span class="badge badge--muted">Avulsa</span>`;
  const monthBadge = task.type === "monthly" && task.referenceMonth
    ? `<span class="badge badge--muted">${escapeHtml(formatMonth(task.referenceMonth))}</span>` : "";
  const dueBadge = task.dueDate
    ? `<span class="badge badge--muted">Entrega: ${escapeHtml(formatDate(task.dueDate))}</span>` : "";
  const ruleBadge = task.dueRule === "firstFriday"
    ? `<span class="badge badge--info">1ª sexta do mês</span>` : "";
  const statusBadge = total === 0
    ? `<span class="badge badge--muted">Sem responsáveis</span>`
    : pending === 0
      ? `<span class="badge badge--success">✓ Todos entregaram</span>`
      : `<span class="badge badge--danger">${pending} ${pluralize(pending, "pendente", "pendentes")}</span>`;

  let deliveries = "";
  if (expanded) {
    if (total === 0) {
      deliveries = `<p class="muted text-sm">Nenhum professor atribuído. Edite a tarefa para adicionar responsáveis.</p>`;
    } else {
      deliveries = task.assignments
        .map((a) => {
          const teacher = teacherMap.get(a.teacherId);
          if (!teacher) return "";
          const sub = a.delivered && a.deliveredAt
            ? `Entregue em ${escapeHtml(formatDateTime(a.deliveredAt))}`
            : "Pendente";
          return `
            <div class="delivery ${a.delivered ? "delivery--done" : ""}">
              <div class="delivery__info">
                <div class="delivery__name">${escapeHtml(teacher.name)}</div>
                <div class="delivery__sub">${sub}</div>
              </div>
              <label class="switch">
                <input type="checkbox" data-delivery="${task.id}|${a.teacherId}" ${a.delivered ? "checked" : ""} />
                <span class="switch__track"></span>
                <span>${a.delivered ? "Entregue" : "Marcar"}</span>
              </label>
            </div>`;
        }).join("");
    }
  }

  return `
    <div class="item" data-task-card="${task.id}">
      <div class="item__head">
        <div style="min-width:0">
          <h3 class="item__title">${escapeHtml(task.title)}</h3>
          <div class="item__meta">${typeBadge}${monthBadge}${dueBadge}${ruleBadge}${statusBadge}</div>
        </div>
        <div class="item__actions">
          <button class="btn-icon" title="Editar" data-edit-task="${task.id}">✏️</button>
          <button class="btn-icon btn-icon--danger" title="Excluir" data-del-task="${task.id}">🗑️</button>
        </div>
      </div>
      ${task.description ? `<div class="item__body text-sm">${escapeHtml(task.description)}</div>` : ""}
      <div class="flex between center wrap" style="margin-top:12px;gap:12px">
        <div class="grow" style="min-width:180px">
          <div class="text-sm muted">${delivered}/${total} ${pluralize(total, "entrega", "entregas")} (${pct}%)</div>
          <div class="progress"><div class="progress__bar" style="width:${pct}%"></div></div>
        </div>
        <div class="flex gap wrap">
          <button class="btn btn--ghost btn--sm" data-share-task="${task.id}">📲 Compartilhar</button>
          <button class="btn btn--ghost btn--sm" data-toggle-task="${task.id}">
            ${expanded ? "Ocultar" : "Marcar entregas"}
          </button>
        </div>
      </div>
      ${expanded ? `<div class="item__body">${deliveries}</div>` : ""}
    </div>`;
}

function bindTaskActions(teachers) {
  view.querySelectorAll("[data-new-task]").forEach((b) =>
    b.addEventListener("click", () => { if (!b.disabled) openTaskForm(null, teachers); }));
  view.querySelectorAll("[data-edit-task]").forEach((b) =>
    b.addEventListener("click", () => openTaskForm(b.getAttribute("data-edit-task"), teachers)));
  view.querySelectorAll("[data-del-task]").forEach((b) =>
    b.addEventListener("click", () => deleteTaskFlow(b.getAttribute("data-del-task"))));
  view.querySelectorAll("[data-toggle-task]").forEach((b) =>
    b.addEventListener("click", () => toggleTask(b.getAttribute("data-toggle-task"), teachers)));
  view.querySelectorAll("[data-share-task]").forEach((b) =>
    b.addEventListener("click", () => openShareModal(b.getAttribute("data-share-task"))));
  view.querySelectorAll("[data-delivery]").forEach((chk) =>
    chk.addEventListener("change", () => onDeliveryToggle(chk, teachers)));
  const filter = view.querySelector("#taskMonthFilter");
  if (filter) filter.addEventListener("change", () => {
    tasksFilterMonth = filter.value;
    renderTasks();
  });
  bindGoButtons();
}

function toggleTask(tid, teachers) {
  if (expandedTasks.has(tid)) expandedTasks.delete(tid);
  else expandedTasks.add(tid);
  refreshTaskCard(tid, teachers);
}

function onDeliveryToggle(chk, teachers) {
  const [taskId, teacherId] = chk.getAttribute("data-delivery").split("|");
  setDelivery(taskId, teacherId, chk.checked);
  refreshTaskCard(taskId, teachers);
}

function refreshTaskCard(taskId, teachers) {
  const card = view.querySelector(`[data-task-card="${taskId}"]`);
  const task = getTask(taskId);
  if (!card || !task) { renderTasks(); return; }
  const tmp = document.createElement("div");
  tmp.innerHTML = renderTaskCard(task);
  const fresh = tmp.firstElementChild;
  card.replaceWith(fresh);
  rebindCard(fresh, teachers);
}

function rebindCard(card, teachers) {
  card.querySelectorAll("[data-edit-task]").forEach((b) =>
    b.addEventListener("click", () => openTaskForm(b.getAttribute("data-edit-task"), teachers)));
  card.querySelectorAll("[data-del-task]").forEach((b) =>
    b.addEventListener("click", () => deleteTaskFlow(b.getAttribute("data-del-task"))));
  card.querySelectorAll("[data-toggle-task]").forEach((b) =>
    b.addEventListener("click", () => toggleTask(b.getAttribute("data-toggle-task"), teachers)));
  card.querySelectorAll("[data-share-task]").forEach((b) =>
    b.addEventListener("click", () => openShareModal(b.getAttribute("data-share-task"))));
  card.querySelectorAll("[data-delivery]").forEach((chk) =>
    chk.addEventListener("change", () => onDeliveryToggle(chk, teachers)));
}

function openTaskForm(id, teachers) {
  const task = id ? getTask(id) : null;
  const selected = new Set(task ? task.assignments.map((a) => a.teacherId) : teachers.map((t) => t.id));
  const isMonthly = task ? task.type === "monthly" : true;
  const defaultMonth = (task && task.referenceMonth) || new Date().toISOString().slice(0, 7);

  const html = `
    <form id="taskForm">
      <div class="field">
        <label for="kTitle">Título *</label>
        <input class="input" id="kTitle" required maxlength="140"
               value="${escapeHtml(task ? task.title : "")}" placeholder="Ex.: Diário de classe — entrega mensal" />
      </div>
      <div class="field">
        <label for="kDesc">Descrição (opcional)</label>
        <textarea class="textarea" id="kDesc" maxlength="600" placeholder="Detalhes da tarefa...">${escapeHtml(task ? task.description : "")}</textarea>
      </div>
      <div class="form-row">
        <div class="field">
          <label for="kType">Tipo</label>
          <select class="select" id="kType">
            <option value="monthly" ${isMonthly ? "selected" : ""}>Mensal (repete todo mês)</option>
            <option value="single" ${!isMonthly ? "selected" : ""}>Avulsa (uma vez)</option>
          </select>
        </div>
        <div class="field" id="monthField" ${isMonthly ? "" : 'style="display:none"'}>
          <label for="kMonth">Mês de referência</label>
          <input class="input" id="kMonth" type="month" value="${escapeHtml(defaultMonth)}" />
        </div>
        <div class="field">
          <label for="kDue">Data de entrega (opcional)</label>
          <input class="input" id="kDue" type="date" value="${escapeHtml(task ? task.dueDate : "")}" />
        </div>
      </div>
      <div class="field" id="firstFridayField" ${isMonthly ? "" : 'style="display:none"'}>
        <label class="checkbox-row">
          <input type="checkbox" id="kFirstFriday" ${task && task.dueRule === "firstFriday" ? "checked" : ""} />
          <span>Entrega sempre na <strong>sexta-feira da primeira semana do mês</strong> (a data é calculada automaticamente)</span>
        </label>
      </div>
      <div class="field">
        <div class="flex between center">
          <label class="mb-0">Professores responsáveis</label>
          <div class="flex gap">
            <button type="button" class="btn btn--ghost btn--sm" id="selAll">Todos</button>
            <button type="button" class="btn btn--ghost btn--sm" id="selNone">Nenhum</button>
          </div>
        </div>
        <div id="teacherChecks" style="margin-top:10px;display:flex;flex-direction:column;gap:8px;max-height:240px;overflow:auto">
          ${teachers.map((t) => `
            <label class="checkbox-row">
              <input type="checkbox" value="${t.id}" ${selected.has(t.id) ? "checked" : ""} />
              <span>${escapeHtml(t.name)}${t.subjects.length ? ` <span class="muted text-sm">— ${escapeHtml(t.subjects.join(", "))}</span>` : ""}</span>
            </label>`).join("")}
        </div>
        <div class="hint">Marque quem deve entregar esta tarefa.</div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" data-close-modal>Cancelar</button>
        <button type="submit" class="btn">${id ? "Salvar alterações" : "Criar tarefa"}</button>
      </div>
    </form>`;

  openModal(id ? "Editar tarefa" : "Nova tarefa", html, (body) => {
    body.querySelector("[data-close-modal]").addEventListener("click", closeModal);
    const typeSel = body.querySelector("#kType");
    const monthField = body.querySelector("#monthField");
    const monthInput = body.querySelector("#kMonth");
    const dueInput = body.querySelector("#kDue");
    const fridayField = body.querySelector("#firstFridayField");
    const fridayChk = body.querySelector("#kFirstFriday");

    function applyFirstFriday() {
      if (typeSel.value === "monthly" && fridayChk.checked) {
        const d = firstFridayOf(monthInput.value);
        if (d) dueInput.value = d;
        dueInput.readOnly = true;
        dueInput.style.opacity = "0.6";
      } else {
        dueInput.readOnly = false;
        dueInput.style.opacity = "";
      }
    }
    function syncType() {
      const monthly = typeSel.value === "monthly";
      monthField.style.display = monthly ? "" : "none";
      fridayField.style.display = monthly ? "" : "none";
      if (!monthly) fridayChk.checked = false;
      applyFirstFriday();
    }
    typeSel.addEventListener("change", syncType);
    fridayChk.addEventListener("change", applyFirstFriday);
    monthInput.addEventListener("change", applyFirstFriday);
    applyFirstFriday();

    const checks = () => Array.from(body.querySelectorAll('#teacherChecks input[type="checkbox"]'));
    body.querySelector("#selAll").addEventListener("click", () => checks().forEach((c) => (c.checked = true)));
    body.querySelector("#selNone").addEventListener("click", () => checks().forEach((c) => (c.checked = false)));

    body.querySelector("#taskForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const title = body.querySelector("#kTitle").value.trim();
      if (!title) { toast("Informe o título da tarefa.", "danger"); return; }
      const type = typeSel.value;
      const referenceMonth = body.querySelector("#kMonth").value;
      if (type === "monthly" && !referenceMonth) {
        toast("Informe o mês de referência.", "danger"); return;
      }
      const payload = {
        title,
        description: body.querySelector("#kDesc").value.trim(),
        type,
        referenceMonth,
        dueDate: body.querySelector("#kDue").value,
        dueRule: type === "monthly" && fridayChk.checked ? "firstFriday" : "",
        teacherIds: checks().filter((c) => c.checked).map((c) => c.value),
      };
      if (id) { updateTask(id, payload); toast("Tarefa atualizada.", "success"); }
      else { addTask(payload); toast("Tarefa criada.", "success"); }
      closeModal();
      renderTasks();
    });
  });
}

async function deleteTaskFlow(id) {
  const task = getTask(id);
  if (!task) return;
  const ok = await confirmDialog({
    title: "Excluir tarefa",
    message: `Excluir a tarefa "${task.title}"? Os registros de entrega serão perdidos.`,
    confirmText: "Excluir",
    danger: true,
  });
  if (!ok) return;
  deleteTask(id);
  expandedTasks.delete(id);
  toast("Tarefa excluída.", "success");
  renderTasks();
}
