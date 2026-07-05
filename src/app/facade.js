// Fachada exposta em window.Store para depuração e testes automatizados.
// A UI interna usa os módulos por feature diretamente; esta fachada apenas
// reúne a mesma API pública num único objeto.
import * as db from "../core/db.js";
import * as teachers from "../features/teachers/teachers.store.js";
import * as tasks from "../features/tasks/tasks.store.js";
import * as observations from "../features/observations/observations.store.js";
import { getMonthlyReport } from "../features/reports/reports.store.js";
import { getStats } from "../features/dashboard/dashboard.store.js";
import { loadSampleData } from "./sampleData.js";

export { DriveSync } from "../features/backup/drive.js";

export const Store = {
  // professores
  getTeachers: teachers.getTeachers,
  getTeacher: teachers.getTeacher,
  addTeacher: teachers.addTeacher,
  updateTeacher: teachers.updateTeacher,
  deleteTeacher: teachers.deleteTeacher,
  // tarefas
  getTasks: tasks.getTasks,
  getTask: tasks.getTask,
  addTask: tasks.addTask,
  updateTask: tasks.updateTask,
  deleteTask: tasks.deleteTask,
  setDelivery: tasks.setDelivery,
  firstFridayOf: tasks.firstFridayOf,
  taskMonth: tasks.taskMonth,
  getMonthsWithTasks: tasks.getMonthsWithTasks,
  // observações
  getObservations: observations.getObservations,
  getObservation: observations.getObservation,
  addObservation: observations.addObservation,
  updateObservation: observations.updateObservation,
  deleteObservation: observations.deleteObservation,
  newObservationDraft: observations.newObservationDraft,
  getObsDefaults: observations.getObsDefaults,
  // relatórios
  getMonthlyReport,
  getStats,
  // configurações
  getSettings: db.getSettings,
  setSettings: db.setSettings,
  // backup
  exportData: db.exportData,
  importData: (json, opts) => { db.importData(json, opts); return getStats(); },
  clearAll: db.clearAll,
  loadSampleData: () => { loadSampleData(); return getStats(); },
};
