// Registro das rotas do app (uma por feature).
import { registerRoute, beforeEach } from "./router.js";
import { renderDashboard } from "../features/dashboard/dashboard.view.js";
import { renderTeachers } from "../features/teachers/teachers.view.js";
import { renderTasks } from "../features/tasks/tasks.view.js";
import { renderObservations, resetObsEditing } from "../features/observations/observations.view.js";
import { renderReports } from "../features/reports/reports.view.js";
import { renderBackup } from "../features/backup/backup.view.js";

export function registerRoutes() {
  registerRoute("painel", { title: "Painel", render: renderDashboard });
  registerRoute("professores", { title: "Professores", render: renderTeachers });
  registerRoute("tarefas", { title: "Tarefas", render: renderTasks });
  registerRoute("observacoes", { title: "Observação de aula", render: renderObservations });
  registerRoute("relatorios", { title: "Relatórios", render: renderReports });
  registerRoute("backup", { title: "Backup e dados", render: renderBackup });

  // Navegar pelo menu sempre mostra a lista de observações (fecha o formulário).
  beforeEach(() => resetObsEditing());
}
