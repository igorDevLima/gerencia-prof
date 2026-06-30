/* ===========================================================================
   ui.js — utilitários de interface (modal, toast, formatação, escape)
   =========================================================================== */
(function (global) {
  "use strict";

  // Escapa texto para inserção segura via innerHTML (evita XSS).
  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Escapa para uso dentro de atributos entre aspas duplas.
  function escapeAttr(value) {
    return escapeHtml(value);
  }

  const MONTHS_PT = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];

  // "2026-06" -> "Junho de 2026"
  function formatMonth(ym) {
    if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return "—";
    const [y, m] = ym.split("-").map(Number);
    const name = MONTHS_PT[m - 1] || "";
    return capitalize(name) + " de " + y;
  }

  // "2026-06-30" -> "30/06/2026"
  function formatDate(iso) {
    if (!iso) return "";
    const datePart = String(iso).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return "";
    const [y, m, d] = datePart.split("-");
    return `${d}/${m}/${y}`;
  }

  // ISO timestamp -> "30/06/2026 14:32"
  function formatDateTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  // Plural simples: pluralize(2, "professor", "professores")
  function pluralize(n, singular, plural) {
    return n === 1 ? singular : plural;
  }

  // --- Toast --------------------------------------------------------------
  let toastTimer = null;
  function toast(message, type) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message;
    el.className = "toast" + (type ? " toast--" + type : "");
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
  }

  // --- Modal --------------------------------------------------------------
  let modalCloseHandler = null;

  function openModal(title, bodyHtml, onMount) {
    const modal = document.getElementById("modal");
    const titleEl = document.getElementById("modalTitle");
    const bodyEl = document.getElementById("modalBody");
    titleEl.textContent = title;
    bodyEl.innerHTML = bodyHtml;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    if (typeof onMount === "function") onMount(bodyEl);
    // Foca o primeiro campo, se houver.
    const firstField = bodyEl.querySelector("input, select, textarea, button");
    if (firstField) firstField.focus();
  }

  function closeModal() {
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

  function onModalClose(fn) { modalCloseHandler = fn; }

  // Confirmação reutilizável. Retorna uma Promise<boolean>.
  function confirmDialog({ title, message, confirmText, danger }) {
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

  // Inicializa o fechamento do modal (clique no backdrop, botão × e ESC).
  function initModalDismissal() {
    document.querySelectorAll("[data-close-modal]").forEach((el) => {
      el.addEventListener("click", closeModal);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
  }

  // Dispara o download de um arquivo de texto gerado no cliente.
  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime || "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  global.UI = {
    escapeHtml, escapeAttr,
    formatMonth, formatDate, formatDateTime, capitalize, pluralize,
    toast,
    openModal, closeModal, onModalClose, confirmDialog, initModalDismissal,
    downloadFile,
  };
})(window);
