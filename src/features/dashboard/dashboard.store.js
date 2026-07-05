// Indicadores agregados para o painel.
import { getState } from "../../core/db.js";
import { getMonthsWithTasks } from "../tasks/tasks.store.js";
import { getMonthlyReport } from "../reports/reports.store.js";

export function getStats() {
  const state = getState();
  const months = getMonthsWithTasks();
  const currentMonth = new Date().toISOString().slice(0, 7);
  let pendingDeliveries = 0;
  let totalDeliveries = 0;
  state.tasks.forEach((t) => {
    t.assignments.forEach((a) => {
      totalDeliveries++;
      if (!a.delivered) pendingDeliveries++;
    });
  });
  const currentReport = getMonthlyReport(currentMonth);
  return {
    teachers: state.teachers.length,
    tasks: state.tasks.length,
    months: months.length,
    observations: state.observations.length,
    pendingDeliveries,
    totalDeliveries,
    currentMonth,
    currentMonthPendingTeachers: currentReport.pendingTeachers.length,
    currentMonthTasks: currentReport.totalTasks,
  };
}
