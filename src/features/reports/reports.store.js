// Relatório mensal de pendências de entrega.
import { getState, clone } from "../../core/db.js";
import { taskMonth } from "../tasks/tasks.store.js";

// Reordena por mês/vencimento (mesma regra das tarefas).
function sortTasks(a, b) {
  const ka = a.type === "monthly" ? a.referenceMonth || "" : (a.dueDate || "").slice(0, 7);
  const kb = b.type === "monthly" ? b.referenceMonth || "" : (b.dueDate || "").slice(0, 7);
  if (ka !== kb) return kb.localeCompare(ka);
  return (b.createdAt || "").localeCompare(a.createdAt || "");
}

export function getMonthlyReport(month) {
  const state = getState();
  const tasks = state.tasks.filter((t) => taskMonth(t) === month).sort(sortTasks);
  const teacherMap = new Map(state.teachers.map((t) => [t.id, t]));
  const pendingByTeacher = new Map();

  const taskReports = tasks.map((task) => {
    const pending = [];
    const delivered = [];
    task.assignments.forEach((a) => {
      const teacher = teacherMap.get(a.teacherId);
      if (!teacher) return;
      if (a.delivered) {
        delivered.push({ teacher: clone(teacher), deliveredAt: a.deliveredAt });
      } else {
        pending.push({ teacher: clone(teacher) });
        if (!pendingByTeacher.has(teacher.id)) {
          pendingByTeacher.set(teacher.id, { teacher: clone(teacher), tasks: [] });
        }
        pendingByTeacher.get(teacher.id).tasks.push(task.title);
      }
    });
    return {
      task: clone(task),
      total: task.assignments.length,
      deliveredCount: delivered.length,
      pendingCount: pending.length,
      pending,
      delivered,
    };
  });

  return {
    month,
    tasks: taskReports,
    totalTasks: taskReports.length,
    pendingTeachers: Array.from(pendingByTeacher.values()).sort((a, b) =>
      a.teacher.name.localeCompare(b.teacher.name, "pt-BR", { sensitivity: "base" })
    ),
  };
}
