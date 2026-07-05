// Tela de professores (lista + formulário).
import { view, emptyCard } from "../../app/shell.js";
import { escapeHtml } from "../../core/ui/escape.js";
import { pluralize } from "../../core/ui/format.js";
import { toast } from "../../core/ui/toast.js";
import { openModal, closeModal, confirmDialog } from "../../core/ui/modal.js";
import { getTeachers, getTeacher, addTeacher, updateTeacher, deleteTeacher } from "./teachers.store.js";
import { getTasks } from "../tasks/tasks.store.js";

export function renderTeachers() {
  const teachers = getTeachers();
  let html = `
    <div class="section-head">
      <div>
        <h2 class="mt-0 mb-0">Professores</h2>
        <p>${teachers.length} ${pluralize(teachers.length, "professor cadastrado", "professores cadastrados")}.</p>
      </div>
      <button class="btn" data-new-teacher>+ Novo professor</button>
    </div>`;

  if (teachers.length === 0) {
    html += emptyCard("👩‍🏫", "Nenhum professor ainda",
      "Cadastre os professores e informe as matérias que cada um leciona.",
      `<button class="btn" data-new-teacher>Cadastrar professor</button>`);
    view.innerHTML = html;
    bindTeacherActions();
    return;
  }

  html += `<div class="list">`;
  teachers.forEach((t) => {
    const subjects = t.subjects.length
      ? `<div class="tags" style="margin-top:10px">${t.subjects.map((s) => `<span class="tag">${escapeHtml(s)}</span>`).join("")}</div>`
      : `<div class="muted text-sm" style="margin-top:8px">Sem matérias informadas</div>`;
    html += `
      <div class="item">
        <div class="item__head">
          <div>
            <h3 class="item__title">${escapeHtml(t.name)}</h3>
            ${(t.email || t.phone) ? `<div class="item__meta">${t.email ? `<span>✉️ ${escapeHtml(t.email)}</span>` : ""}${t.phone ? `<span>📱 ${escapeHtml(t.phone)}</span>` : ""}</div>` : ""}
          </div>
          <div class="item__actions">
            <button class="btn-icon" title="Editar" data-edit-teacher="${t.id}">✏️</button>
            <button class="btn-icon btn-icon--danger" title="Excluir" data-del-teacher="${t.id}">🗑️</button>
          </div>
        </div>
        ${subjects}
      </div>`;
  });
  html += `</div>`;
  view.innerHTML = html;
  bindTeacherActions();
}

function bindTeacherActions() {
  view.querySelectorAll("[data-new-teacher]").forEach((b) =>
    b.addEventListener("click", () => openTeacherForm()));
  view.querySelectorAll("[data-edit-teacher]").forEach((b) =>
    b.addEventListener("click", () => openTeacherForm(b.getAttribute("data-edit-teacher"))));
  view.querySelectorAll("[data-del-teacher]").forEach((b) =>
    b.addEventListener("click", () => deleteTeacherFlow(b.getAttribute("data-del-teacher"))));
}

export function openTeacherForm(id) {
  const teacher = id ? getTeacher(id) : null;
  const subjects = teacher ? teacher.subjects.slice() : [];

  const html = `
    <form id="teacherForm">
      <div class="field">
        <label for="tName">Nome *</label>
        <input class="input" id="tName" required maxlength="120"
               value="${escapeHtml(teacher ? teacher.name : "")}" placeholder="Ex.: Maria Silva" />
      </div>
      <div class="form-row">
        <div class="field">
          <label for="tEmail">E-mail (opcional)</label>
          <input class="input" id="tEmail" type="email" maxlength="160"
                 value="${escapeHtml(teacher ? teacher.email : "")}" placeholder="maria@escola.edu" />
        </div>
        <div class="field">
          <label for="tPhone">WhatsApp (opcional)</label>
          <input class="input" id="tPhone" type="tel" maxlength="30"
                 value="${escapeHtml(teacher ? teacher.phone || "" : "")}" placeholder="Ex.: (27) 99999-8888" />
          <div class="hint">Com DDD. Usado para enviar avisos pelo WhatsApp.</div>
        </div>
      </div>
      <div class="field">
        <label for="tSubject">Matérias</label>
        <div class="flex gap">
          <input class="input grow" id="tSubject" maxlength="80"
                 placeholder="Digite uma matéria e tecle Enter" />
          <button class="btn btn--ghost" type="button" id="addSubject">Adicionar</button>
        </div>
        <div class="tags" id="subjectTags" style="margin-top:10px"></div>
        <div class="hint">Adicione quantas matérias o professor leciona.</div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" data-close-modal>Cancelar</button>
        <button type="submit" class="btn">${id ? "Salvar alterações" : "Cadastrar"}</button>
      </div>
    </form>`;

  openModal(id ? "Editar professor" : "Novo professor", html, (body) => {
    body.querySelector("[data-close-modal]").addEventListener("click", closeModal);
    const tagsEl = body.querySelector("#subjectTags");
    const subjectInput = body.querySelector("#tSubject");

    function renderTags() {
      tagsEl.innerHTML = subjects.map((s, i) =>
        `<span class="tag">${escapeHtml(s)}<button type="button" class="tag__remove" data-rm="${i}" aria-label="Remover">×</button></span>`
      ).join("");
      tagsEl.querySelectorAll("[data-rm]").forEach((btn) =>
        btn.addEventListener("click", () => {
          subjects.splice(Number(btn.getAttribute("data-rm")), 1);
          renderTags();
        }));
    }
    function addSubject() {
      const val = subjectInput.value.trim();
      if (!val) return;
      const exists = subjects.some((s) => s.toLocaleLowerCase("pt-BR") === val.toLocaleLowerCase("pt-BR"));
      if (!exists) subjects.push(val);
      subjectInput.value = "";
      subjectInput.focus();
      renderTags();
    }
    body.querySelector("#addSubject").addEventListener("click", addSubject);
    subjectInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSubject(); }
    });
    renderTags();

    body.querySelector("#teacherForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = body.querySelector("#tName").value.trim();
      if (!name) { toast("Informe o nome do professor.", "danger"); return; }
      const email = body.querySelector("#tEmail").value.trim();
      const phone = body.querySelector("#tPhone").value.trim();
      const payload = { name, email, phone, subjects };
      if (id) { updateTeacher(id, payload); toast("Professor atualizado.", "success"); }
      else { addTeacher(payload); toast("Professor cadastrado.", "success"); }
      closeModal();
      renderTeachers();
    });
  });
}

async function deleteTeacherFlow(id) {
  const teacher = getTeacher(id);
  if (!teacher) return;
  const inTasks = getTasks().filter((t) => t.assignments.some((a) => a.teacherId === id)).length;
  const extra = inTasks
    ? ` Ele será removido de ${inTasks} ${pluralize(inTasks, "tarefa", "tarefas")}.`
    : "";
  const ok = await confirmDialog({
    title: "Excluir professor",
    message: `Excluir "${teacher.name}"?${extra} Esta ação não pode ser desfeita.`,
    confirmText: "Excluir",
    danger: true,
  });
  if (!ok) return;
  deleteTeacher(id);
  toast("Professor excluído.", "success");
  renderTeachers();
}
