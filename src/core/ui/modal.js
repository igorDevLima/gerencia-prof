// Modal reutilizável + confirmação.
import { escapeHtml } from "./escape.js";

let modalCloseHandler = null;

export function openModal(title, bodyHtml, onMount) {
  const modal = document.getElementById("modal");
  const titleEl = document.getElementById("modalTitle");
  const bodyEl = document.getElementById("modalBody");
  titleEl.textContent = title;
  bodyEl.innerHTML = bodyHtml;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  if (typeof onMount === "function") onMount(bodyEl);
  const firstField = bodyEl.querySelector("input, select, textarea, button");
  if (firstField) firstField.focus();
}

export function closeModal() {
  const modal = document.getElementById("modal");
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  document.getElementById("modalBody").innerHTML = "";
  document.body.style.overflow = "";
  if (typeof modalCloseHandler === "function") {
    const fn = modalCloseHandler;
    modalCloseHandler = null;
    fn();
  }
}

export function onModalClose(fn) { modalCloseHandler = fn; }

// Confirmação. Retorna Promise<boolean>.
export function confirmDialog({ title, message, confirmText, danger }) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
      closeModal();
    };
    const html = `
      <p class="mt-0">${escapeHtml(message)}</p>
      <div class="form-actions">
        <button class="btn btn--ghost" data-act="cancel">Cancelar</button>
        <button class="btn ${danger ? "btn--danger" : ""}" data-act="confirm">${escapeHtml(confirmText || "Confirmar")}</button>
      </div>`;
    onModalClose(() => finish(false));
    openModal(title || "Confirmar", html, (body) => {
      body.querySelector('[data-act="cancel"]').addEventListener("click", () => finish(false));
      body.querySelector('[data-act="confirm"]').addEventListener("click", () => finish(true));
    });
  });
}

// Fechar modal por backdrop, botão × e tecla ESC.
export function initModalDismissal() {
  document.querySelectorAll("[data-close-modal]").forEach((el) => {
    el.addEventListener("click", closeModal);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}
