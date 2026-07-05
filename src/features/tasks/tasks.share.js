// Compartilhamento de tarefa via WhatsApp (mensagem profissional, sem emojis).
import { escapeHtml } from "../../core/ui/escape.js";
import { formatDate, formatMonth } from "../../core/ui/format.js";
import { toast } from "../../core/ui/toast.js";
import { copyText } from "../../core/ui/files.js";
import { openModal, closeModal } from "../../core/ui/modal.js";
import { navigate } from "../../app/router.js";
import { getTask } from "./tasks.store.js";
import { getTeachers } from "../teachers/teachers.store.js";
import { openTeacherForm } from "../teachers/teachers.view.js";

// Saudação conforme o horário atual.
function greetingNow() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function taskDueText(task) {
  if (task.dueDate) return { text: formatDate(task.dueDate), hasDate: true };
  if (task.type === "monthly" && task.referenceMonth) {
    return { text: formatMonth(task.referenceMonth).toLowerCase(), hasDate: false };
  }
  return { text: "", hasDate: false };
}

function buildShareMessage(task, teacherName) {
  const g = greetingNow();
  const who = teacherName ? teacherName.trim() : "professor(a)";
  const due = taskDueText(task);
  const lines = [];
  lines.push(`${g}, ${who}.`);
  lines.push("");
  if (due.hasDate) {
    lines.push(`Gostaria de lembrar sobre a entrega da tarefa "${task.title}", cujo prazo final é ${due.text}.`);
  } else if (due.text) {
    lines.push(`Gostaria de lembrar sobre a entrega da tarefa "${task.title}", referente ao mês de ${due.text}.`);
  } else {
    lines.push(`Gostaria de lembrar sobre a entrega da tarefa "${task.title}".`);
  }
  lines.push("");
  lines.push("Por gentileza, realize o envio dentro do prazo. Caso já tenha entregado, favor desconsiderar esta mensagem.");
  lines.push("");
  lines.push("Atenciosamente,");
  lines.push("Coordenação.");
  return lines.join("\n");
}

// Só dígitos, com DDI do Brasil quando vier apenas com DDD.
function normalizeWhatsPhone(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length <= 11) d = "55" + d;
  return d;
}

function waLink(phone, text) {
  const base = phone ? `https://wa.me/${phone}` : "https://wa.me/";
  return base + "?text=" + encodeURIComponent(text);
}

export function openShareModal(taskId) {
  const task = getTask(taskId);
  if (!task) return;
  const teacherMap = new Map(getTeachers().map((t) => [t.id, t]));
  const assigned = task.assignments.map((a) => teacherMap.get(a.teacherId)).filter(Boolean);
  const genericMsg = buildShareMessage(task, "");

  let teacherRows;
  if (!assigned.length) {
    teacherRows = `<p class="muted text-sm">Nenhum professor atribuído a esta tarefa. Edite a tarefa para adicionar responsáveis.</p>`;
  } else {
    teacherRows = assigned.map((t) => {
      const phone = normalizeWhatsPhone(t.phone);
      if (phone) {
        const msg = buildShareMessage(task, t.name);
        return `
          <div class="delivery">
            <div class="delivery__info">
              <div class="delivery__name">${escapeHtml(t.name)}</div>
              <div class="delivery__sub">${escapeHtml(t.phone)}</div>
            </div>
            <a class="btn btn--sm" target="_blank" rel="noopener" href="${escapeHtml(waLink(phone, msg))}">Enviar</a>
          </div>`;
      }
      return `
        <div class="delivery">
          <div class="delivery__info">
            <div class="delivery__name">${escapeHtml(t.name)}</div>
            <div class="delivery__sub muted">Sem WhatsApp cadastrado</div>
          </div>
          <button class="btn btn--ghost btn--sm" data-add-phone="${t.id}">Adicionar</button>
        </div>`;
    }).join("");
  }

  const html = `
    <div class="field">
      <label for="shareMsg">Mensagem</label>
      <textarea class="textarea" id="shareMsg" rows="9">${escapeHtml(genericMsg)}</textarea>
      <div class="hint">A saudação muda conforme o horário (bom dia / boa tarde / boa noite). Você pode editar antes de enviar.</div>
    </div>
    <div class="flex gap wrap" style="margin-bottom:4px">
      <button class="btn btn--ghost" id="copyMsg" type="button">Copiar mensagem</button>
      <button class="btn" id="openWa" type="button">Abrir no WhatsApp</button>
    </div>
    <hr class="divider">
    <h3 class="mt-0" style="font-size:1rem">Enviar direto para cada professor</h3>
    <p class="muted text-sm mt-0">Cada mensagem é personalizada com o nome do professor.</p>
    <div class="list">${teacherRows}</div>`;

  openModal("Compartilhar tarefa no WhatsApp", html, (body) => {
    body.querySelector("#copyMsg").addEventListener("click", async () => {
      const ok = await copyText(body.querySelector("#shareMsg").value);
      toast(ok ? "Mensagem copiada." : "Não foi possível copiar.", ok ? "success" : "danger");
    });
    body.querySelector("#openWa").addEventListener("click", () => {
      const text = body.querySelector("#shareMsg").value;
      window.open(waLink("", text), "_blank", "noopener");
    });
    body.querySelectorAll("[data-add-phone]").forEach((b) =>
      b.addEventListener("click", () => {
        const tid = b.getAttribute("data-add-phone");
        closeModal();
        navigate("professores");
        openTeacherForm(tid);
      }));
  });
}
