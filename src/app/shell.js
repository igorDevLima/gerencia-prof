// Elementos e utilitários compartilhados pela casca do app.
import { escapeHtml } from "../core/ui/escape.js";
import { navigate } from "./router.js";

export const view = document.getElementById("view");
export const pageTitle = document.getElementById("pageTitle");

// Cartão de estado vazio reutilizável.
export function emptyCard(icon, title, text, actionHtml) {
  return `
    <div class="card"><div class="card__body">
      <div class="empty">
        <div class="empty__icon">${icon}</div>
        <h3 class="mb-0">${escapeHtml(title)}</h3>
        <p>${escapeHtml(text)}</p>
        ${actionHtml || ""}
      </div>
    </div></div>`;
}

// Vincula os botões com [data-go] para navegar entre telas.
export function bindGoButtons(container) {
  (container || view).querySelectorAll("[data-go]").forEach((b) =>
    b.addEventListener("click", () => navigate(b.getAttribute("data-go"))));
}

// --- Menu lateral (mobile) ---
export function closeSidebar() {
  const s = document.getElementById("sidebar");
  if (s) s.classList.remove("open");
}

export function initSidebar() {
  const toggle = document.getElementById("menuToggle");
  if (toggle) toggle.addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });
  document.addEventListener("click", (e) => {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar || !sidebar.classList.contains("open")) return;
    if (sidebar.contains(e.target) || e.target.id === "menuToggle") return;
    closeSidebar();
  });
}
