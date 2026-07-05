// Tela de Observação de Aula (lista + formulário completo + exportação .docx).
import "./observations.scss";
import { view, emptyCard, pageTitle } from "../../app/shell.js";
import { escapeHtml } from "../../core/ui/escape.js";
import { formatDate } from "../../core/ui/format.js";
import { toast } from "../../core/ui/toast.js";
import { confirmDialog } from "../../core/ui/modal.js";
import { deliverFile } from "../../app/deliver.js";
import {
  getObservations, getObservation, addObservation, updateObservation,
  deleteObservation, newObservationDraft,
} from "./observations.store.js";
import { CRITERIA, GUIDANCE, FEEDBACK_HINTS } from "./observations.criteria.js";
import { buildDocx } from "./observations.docx.js";
import { getTeachers } from "../teachers/teachers.store.js";

// null = lista; "new" = nova; id = editando. Resetado ao trocar de rota.
let editingObsId = null;
export function resetObsEditing() { editingObsId = null; }

export function renderObservations() {
  if (editingObsId) renderObsForm();
  else renderObsList();
}

function markSummary(o) {
  const c = { sim: 0, nao: 0, na: 0, vazio: 0 };
  (o.criterios || []).forEach((x) => {
    if (x.mark === "sim") c.sim++;
    else if (x.mark === "nao") c.nao++;
    else if (x.mark === "na") c.na++;
    else c.vazio++;
  });
  return c;
}

function renderObsList() {
  view.scrollTop = 0;
  const observations = getObservations();
  let html = `
    <div class="section-head">
      <div>
        <h2 class="mt-0 mb-0">Observação de Aula</h2>
        <p>Assista à aula, preencha o protocolo e exporte no template oficial (.docx).</p>
      </div>
      <button class="btn" data-new-obs>+ Nova observação</button>
    </div>`;

  if (!observations.length) {
    html += emptyCard("👁️", "Nenhuma observação registrada",
      "Registre a observação de uma aula e exporte o documento .docx no mesmo template do modelo oficial.",
      `<button class="btn" data-new-obs>Nova observação</button>`);
    view.innerHTML = html;
    bindObsListActions();
    return;
  }

  html += `<div class="list">`;
  observations.forEach((o) => {
    const s = markSummary(o);
    const meta = [
      o.disciplina,
      o.serieTurma,
      (formatDate(o.dataObservacao) || "") + (o.horario ? ` (${o.horario})` : ""),
    ].filter((x) => x && x.trim());
    html += `
      <div class="item">
        <div class="item__head">
          <div style="min-width:0">
            <h3 class="item__title">${escapeHtml(o.professor || "(sem professor)")}</h3>
            <div class="item__meta">${meta.map((m) => `<span>${escapeHtml(m)}</span>`).join("")}</div>
          </div>
          <div class="item__actions">
            <button class="btn-icon" title="Editar" data-edit-obs="${o.id}">✏️</button>
            <button class="btn-icon btn-icon--danger" title="Excluir" data-del-obs="${o.id}">🗑️</button>
          </div>
        </div>
        <div class="item__body flex gap wrap center">
          <span class="badge badge--success">Sim: ${s.sim}</span>
          <span class="badge badge--danger">Não: ${s.nao}</span>
          <span class="badge badge--muted">N/D: ${s.na}</span>
          ${s.vazio ? `<span class="badge badge--pending">Em branco: ${s.vazio}</span>` : ""}
          <span class="grow"></span>
          <button class="btn btn--sm" data-export-obs="${o.id}">⬇️ Exportar .docx</button>
        </div>
      </div>`;
  });
  html += `</div>`;
  view.innerHTML = html;
  bindObsListActions();
}

function bindObsListActions() {
  view.querySelectorAll("[data-new-obs]").forEach((b) =>
    b.addEventListener("click", () => { editingObsId = "new"; renderObservations(); }));
  view.querySelectorAll("[data-edit-obs]").forEach((b) =>
    b.addEventListener("click", () => { editingObsId = b.getAttribute("data-edit-obs"); renderObservations(); }));
  view.querySelectorAll("[data-del-obs]").forEach((b) =>
    b.addEventListener("click", () => deleteObservationFlow(b.getAttribute("data-del-obs"))));
  view.querySelectorAll("[data-export-obs]").forEach((b) =>
    b.addEventListener("click", () => exportObservationDocx(b.getAttribute("data-export-obs"))));
}

function renderObsForm() {
  view.scrollTop = 0;
  const isNew = editingObsId === "new";
  const obs = isNew ? newObservationDraft() : getObservation(editingObsId);
  if (!obs) { editingObsId = null; renderObsList(); return; }
  pageTitle.textContent = isNew ? "Nova observação" : "Editar observação";

  const teachers = getTeachers();
  const allSubjects = Array.from(new Set(teachers.flatMap((t) => t.subjects || [])))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  const teacherOpts = `<option value="">— Selecione um cadastrado —</option>` +
    teachers.map((t) => `<option value="${t.id}" ${obs.teacherId === t.id ? "selected" : ""}>${escapeHtml(t.name)}</option>`).join("") +
    `<option value="__manual__">Outro (digitar manualmente)</option>`;

  const critBlocks = CRITERIA.map((text, i) => {
    const d = obs.criterios[i] || { mark: "", evidencias: "" };
    const lab = (val, cls, label) =>
      `<label class="radio radio--${cls}${d.mark === val ? " radio--on" : ""}">
         <input type="radio" name="crit-${i}" value="${val}" ${d.mark === val ? "checked" : ""}><span>${label}</span>
       </label>`;
    return `
      <div class="obs-crit" data-crit="${i}">
        <div class="obs-crit__text">${i + 1}. ${escapeHtml(text)}</div>
        <div class="obs-crit__marks">
          ${lab("sim", "sim", "Sim")}
          ${lab("nao", "nao", "Não")}
          ${lab("na", "na", "Não foi possível observar")}
          <button type="button" class="linklike" data-clear-crit="${i}">limpar</button>
        </div>
        <textarea class="textarea" id="ev-${i}" rows="2" placeholder="${escapeHtml(GUIDANCE[i] || "Indicadores / evidências…")}">${escapeHtml(d.evidencias)}</textarea>
      </div>`;
  }).join("");

  const field = (id, label, value, type, ph) =>
    `<div class="field"><label for="${id}">${label}</label>
      <input class="input" id="${id}" ${type ? `type="${type}"` : ""} value="${escapeHtml(value || "")}" ${ph ? `placeholder="${escapeHtml(ph)}"` : ""}/></div>`;

  view.innerHTML = `
    <div class="section-head no-print">
      <div>
        <h2 class="mt-0 mb-0">${isNew ? "Nova observação de aula" : "Editar observação"}</h2>
        <p>Preencha o protocolo. Ao final, exporte no template oficial (.docx).</p>
      </div>
      <button class="btn btn--ghost btn--sm" data-cancel-obs>← Voltar</button>
    </div>

    <div class="card"><div class="card__body">
      <h2 class="mt-0">1. Identificação</h2>
      <div class="form-row">
        <div class="field">
          <label for="obsTeacher">Professor(a) observado(a)</label>
          <select class="select" id="obsTeacher">${teacherOpts}</select>
          <div class="hint">Escolha um cadastrado (preenche o nome) ou digite ao lado.</div>
        </div>
        ${field("obsProfessor", "Nome do professor(a) *", obs.professor, "", "Ex.: Maria Silva")}
      </div>
      <div class="form-row">
        <div class="field">
          <label for="obsDisciplina">Disciplina</label>
          <input class="input" id="obsDisciplina" list="discList" value="${escapeHtml(obs.disciplina || "")}" placeholder="Ex.: Desenvolvimento Web"/>
          <datalist id="discList">${allSubjects.map((s) => `<option value="${escapeHtml(s)}"></option>`).join("")}</datalist>
        </div>
        ${field("obsSerie", "Série/Turma", obs.serieTurma, "", "Ex.: 2º Ano — Turma B")}
      </div>
      <div class="form-row">
        ${field("obsData", "Data da observação *", obs.dataObservacao, "date")}
        ${field("obsHorario", "Horário", obs.horario, "", "Ex.: 15h-15h50")}
      </div>
      <details class="obs-advanced">
        <summary>Dados do cabeçalho (escola, etapa, modalidade…)</summary>
        ${field("hdrEscola", "Escola", obs.escola)}
        <div class="form-row">
          ${field("hdrEtapa", "Etapa", obs.etapa)}
          ${field("hdrTurno", "Turno", obs.turno, "", "Ex.: Vespertino")}
        </div>
        ${field("hdrModalidade", "Modalidade", obs.modalidade)}
        ${field("hdrArea", "Área de Conhecimento / Área Técnica", obs.area)}
        <div class="form-row">
          ${field("hdrCoordPed", "Coordenadora Pedagógica", obs.coordenadoraPedagogica)}
          ${field("hdrCoordArea", "Coord. de Área / Curso Técnico", obs.coordenadorArea)}
        </div>
        <div class="hint">Estes dados são lembrados para as próximas observações.</div>
      </details>
    </div></div>

    <div class="card"><div class="card__body">
      <h2 class="mt-0">2. Protocolo de Observação</h2>
      <p class="muted text-sm">Para cada critério, marque <strong>Sim / Não / Não foi possível observar</strong> e registre as evidências.</p>
      ${critBlocks}
      <div class="field" style="margin-top:16px">
        <label for="obsObservacoes">Observações gerais</label>
        <textarea class="textarea" id="obsObservacoes" rows="3" placeholder="Registros gerais da aula…">${escapeHtml(obs.observacoes || "")}</textarea>
      </div>
    </div></div>

    <div class="card"><div class="card__body">
      <h2 class="mt-0">3. Protocolo do Feedback</h2>
      <div class="field">
        <label for="obsRegistro">Registro de Evidências</label>
        <textarea class="textarea" id="obsRegistro" rows="3">${escapeHtml(obs.registroEvidencias || "")}</textarea>
      </div>
      <div class="field">
        <label for="obsSugestoes">Sugestões/Orientações</label>
        <textarea class="textarea" id="obsSugestoes" rows="4" placeholder="${escapeHtml(FEEDBACK_HINTS)}">${escapeHtml(obs.sugestoes || "")}</textarea>
      </div>
      <div class="field" style="max-width:260px">
        <label for="obsDataFeedback">Data do Feedback</label>
        <input class="input" type="date" id="obsDataFeedback" value="${escapeHtml(obs.dataFeedback || "")}"/>
      </div>
      <hr class="divider">
      <h3 class="mt-0">Assinaturas (opcional)</h3>
      <p class="muted text-sm">Os nomes aparecem acima da linha de assinatura no documento exportado.</p>
      <div class="form-row">
        ${field("sigRegente", "Professor(a) Regente", (obs.assinaturas || {}).regente)}
        ${field("sigCoordArea", "Coord. de Área / Curso Técnico", (obs.assinaturas || {}).coordenadorArea)}
      </div>
      <div class="form-row">
        ${field("sigPedagoga", "Pedagoga", (obs.assinaturas || {}).pedagoga)}
        ${field("sigCoordPed", "Coordenadora Pedagógica", (obs.assinaturas || {}).coordenadoraPedagogica)}
      </div>
    </div></div>

    <div class="card"><div class="card__body flex gap wrap between center">
      <button class="btn btn--ghost" data-cancel-obs>← Voltar sem salvar</button>
      <div class="flex gap wrap">
        <button class="btn btn--ghost" data-save-obs>Salvar</button>
        <button class="btn" data-save-export-obs>💾 Salvar e exportar .docx</button>
      </div>
    </div></div>`;

  bindObsForm(teachers, allSubjects);
}

function bindObsForm(teachers, allSubjects) {
  const teacherSel = view.querySelector("#obsTeacher");
  teacherSel.addEventListener("change", () => {
    const t = teachers.find((x) => x.id === teacherSel.value);
    if (t) view.querySelector("#obsProfessor").value = t.name;
    const dl = view.querySelector("#discList");
    const subs = t && t.subjects && t.subjects.length ? t.subjects : allSubjects;
    dl.innerHTML = subs.map((s) => `<option value="${escapeHtml(s)}"></option>`).join("");
  });

  view.querySelectorAll("[data-crit]").forEach((block) => {
    const i = block.getAttribute("data-crit");
    block.querySelectorAll(`input[name="crit-${i}"]`).forEach((radio) =>
      radio.addEventListener("change", () => updateCritLabels(block)));
    block.querySelector("[data-clear-crit]").addEventListener("click", () => {
      block.querySelectorAll(`input[name="crit-${i}"]`).forEach((r) => (r.checked = false));
      updateCritLabels(block);
    });
  });

  view.querySelectorAll("[data-cancel-obs]").forEach((b) =>
    b.addEventListener("click", () => { editingObsId = null; renderObservations(); }));
  view.querySelector("[data-save-obs]").addEventListener("click", () => saveObservation(false));
  view.querySelector("[data-save-export-obs]").addEventListener("click", () => saveObservation(true));
}

function updateCritLabels(block) {
  block.querySelectorAll(".radio").forEach((label) => {
    const input = label.querySelector("input");
    label.classList.toggle("radio--on", !!(input && input.checked));
  });
}

function collectObsPayload() {
  const val = (id) => { const el = view.querySelector("#" + id); return el ? el.value : ""; };
  const teacherSel = view.querySelector("#obsTeacher");
  const teacherId = teacherSel && /^t_/.test(teacherSel.value) ? teacherSel.value : "";
  const criterios = [];
  for (let i = 0; i < CRITERIA.length; i++) {
    const checked = view.querySelector(`input[name="crit-${i}"]:checked`);
    criterios.push({ mark: checked ? checked.value : "", evidencias: val("ev-" + i) });
  }
  return {
    teacherId,
    professor: val("obsProfessor"),
    disciplina: val("obsDisciplina"),
    serieTurma: val("obsSerie"),
    dataObservacao: val("obsData"),
    horario: val("obsHorario"),
    escola: val("hdrEscola"),
    etapa: val("hdrEtapa"),
    modalidade: val("hdrModalidade"),
    turno: val("hdrTurno"),
    area: val("hdrArea"),
    coordenadoraPedagogica: val("hdrCoordPed"),
    coordenadorArea: val("hdrCoordArea"),
    criterios,
    observacoes: val("obsObservacoes"),
    registroEvidencias: val("obsRegistro"),
    sugestoes: val("obsSugestoes"),
    dataFeedback: val("obsDataFeedback"),
    assinaturas: {
      regente: val("sigRegente"),
      coordenadorArea: val("sigCoordArea"),
      pedagoga: val("sigPedagoga"),
      coordenadoraPedagogica: val("sigCoordPed"),
    },
  };
}

function saveObservation(exportAfter) {
  const payload = collectObsPayload();
  if (!payload.professor.trim()) { toast("Informe o nome do professor(a).", "danger"); return; }
  if (!payload.dataObservacao) { toast("Informe a data da observação.", "danger"); return; }
  let saved;
  if (editingObsId && editingObsId !== "new") saved = updateObservation(editingObsId, payload);
  else saved = addObservation(payload);
  if (!saved) { toast("Não foi possível salvar.", "danger"); return; }
  toast("Observação salva.", "success");
  if (exportAfter) exportObservationDocx(saved.id);
  editingObsId = null;
  renderObservations();
}

async function deleteObservationFlow(id) {
  const obs = getObservation(id);
  if (!obs) return;
  const ok = await confirmDialog({
    title: "Excluir observação",
    message: `Excluir a observação de "${obs.professor || "(sem professor)"}"${obs.dataObservacao ? " de " + formatDate(obs.dataObservacao) : ""}? Esta ação não pode ser desfeita.`,
    confirmText: "Excluir",
    danger: true,
  });
  if (!ok) return;
  deleteObservation(id);
  toast("Observação excluída.", "success");
  renderObservations();
}

function obsSlug(s) {
  return String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .toLowerCase().slice(0, 40) || "professor";
}

function obsFilename(obs) {
  return `observacao-aula-${obsSlug(obs.professor)}-${obs.dataObservacao || "sem-data"}.docx`;
}

function exportObservationDocx(id) {
  const obs = getObservation(id);
  if (!obs) { toast("Observação não encontrada.", "danger"); return; }
  try {
    const bytes = buildDocx(obs);
    deliverFile(
      obsFilename(obs),
      bytes,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Documento .docx"
    );
  } catch (err) {
    console.error("Falha ao gerar .docx:", err);
    toast("Falha ao gerar o documento .docx.", "danger");
  }
}
