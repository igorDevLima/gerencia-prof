// Roteador por hash. As features registram suas rotas; o index inicia.
const routes = {};
const beforeHooks = [];
let started = false;

export function registerRoute(key, def) { routes[key] = def; }
export function beforeEach(fn) { beforeHooks.push(fn); }

function currentRouteKey() {
  const hash = (location.hash || "").replace(/^#\//, "");
  if (routes[hash]) return hash;
  return routes.painel ? "painel" : Object.keys(routes)[0];
}

export function render() {
  const key = currentRouteKey();
  const def = routes[key];
  if (!def) return;
  beforeHooks.forEach((fn) => fn(key));
  const pageTitle = document.getElementById("pageTitle");
  if (pageTitle) pageTitle.textContent = def.title;
  document.querySelectorAll("[data-route]").forEach((el) =>
    el.classList.toggle("active", el.getAttribute("data-route") === key));
  const sidebar = document.getElementById("sidebar");
  if (sidebar) sidebar.classList.remove("open");
  const view = document.getElementById("view");
  if (view) view.scrollTop = 0;
  def.render();
  if (view) view.focus({ preventScroll: true });
}

export function navigate(key) {
  if (location.hash === "#/" + key) render();
  else location.hash = "#/" + key;
}

export function startRouter() {
  if (started) return;
  started = true;
  window.addEventListener("hashchange", render);
  if (!location.hash) location.hash = "#/painel";
  else render();
}
