// Entry point: estilos globais, inicialização da casca e do roteador.
import "./styles/global.scss";
import { initModalDismissal } from "./core/ui/modal.js";
import { initSidebar } from "./app/shell.js";
import { registerRoutes } from "./app/routes.js";
import { startRouter } from "./app/router.js";
import { Store, DriveSync } from "./app/facade.js";

// Exposto para depuração no console e para os testes automatizados.
window.Store = Store;
window.DriveSync = DriveSync;

registerRoutes();
initModalDismissal();
initSidebar();
startRouter();

// Service worker para uso offline (apenas quando servido por http/https).
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => { /* offline opcional */ });
  });
}
