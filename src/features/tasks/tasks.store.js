// Dados das tarefas e entregas.
import { getState, commit, uid, clone } from "../../core/db.js";

// Ordena por mês de referência / vencimento, mais recente primeiro.
function sortTasks(a, b) {
  const ka = a.type === "monthly" ? a.referenceMonth || "" : (a.dueDate || "").slice(0, 7);
  const kb = b.type === "monthly" ? b.referenceMonth || "" : (b.dueDate || "").slice(0, 7);
  if (ka !== kb) return kb.localeCompare(ka);
  return (b.createdAt || "").localeCompare(a.createdAt || "");
}

export function getTasks() {
  return clone(getState().tasks).sort(sortTasks);
}

export function getTask(id) {
  const t = getState().tasks.find((x) => x.id === id);
  return t ? clone(t) : null;
}

// Calcula a 1ª sexta-feira de um mês "YYYY-MM" -> "YYYY-MM-DD".
export function firstFridayOf(ym) {
  if (!/^\d{4}-\d{2}$/.test(ym || "")) return "";
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const offset = (5 - first.getDay() + 7) % 7; // 5 = sexta-feira
  const day = 1 + offset;
  return `${ym}-${String(day).padStart(2, "0")}`;
}

// Resolve o tipo de regra de entrega e a data final resultante.
function resolveDue(type, referenceMonth, dueDate, dueRule) {
  const rule = type === "monthly" && dueRule === "firstFriday" ? "firstFriday" : "";
  if (rule === "firstFriday" && referenceMonth) {
    return { dueRule: rule, dueDate: firstFridayOf(referenceMonth) };
  }
  return { dueRule: rule, dueDate: dueDate || "" };
}

// Monta a lista de atribuições preservando entregas anteriores.
function buildAssignments(teacherIds, previous) {
  const state = getState();
  const ids = Array.isArray(teacherIds) ? teacherIds : [];
  const prevMap = new Map((previous || []).map((a) => [a.teacherId, a]));
  return ids
    .filter((id) => state.teachers.some((t) => t.id === id))
    .map((teacherId) => {
      const prev = prevMap.get(teacherId);
      return prev
        ? { teacherId, delivered: !!prev.delivered, deliveredAt: prev.deliveredAt || null }
        : { teacherId, delivered: false, deliveredAt: null };
    });
}

export function addTask({ title, description, type, referenceMonth, dueDate, dueRule, teacherIds }) {
  const normType = type === "monthly" ? "monthly" : "single";
  const refMonth = normType === "monthly" ? referenceMonth || "" : "";
  const due = resolveDue(normType, refMonth, dueDate, dueRule);
  const task = {
    id: uid("k_"),
    title: (title || "").trim(),
    description: (description || "").trim(),
    type: normType,
    referenceMonth: refMonth,
    dueRule: due.dueRule,
    dueDate: due.dueDate,
    assignments: buildAssignments(teacherIds, []),
    createdAt: new Date().toISOString(),
  };
  getState().tasks.push(task);
  commit();
  return clone(task);
}

export function updateTask(id, { title, description, type, referenceMonth, dueDate, dueRule, teacherIds }) {
  const task = getState().tasks.find((x) => x.id === id);
  if (!task) return null;
  task.title = (title || "").trim();
  task.description = (description || "").trim();
  task.type = type === "monthly" ? "monthly" : "single";
  task.referenceMonth = task.type === "monthly" ? referenceMonth || "" : "";
  const due = resolveDue(task.type, task.referenceMonth, dueDate, dueRule);
  task.dueRule = due.dueRule;
  task.dueDate = due.dueDate;
  task.assignments = buildAssignments(teacherIds, task.assignments);
  commit();
  return clone(task);
}

export function deleteTask(id) {
  const state = getState();
  state.tasks = state.tasks.filter((x) => x.id !== id);
  commit();
}

// Marca/desmarca a entrega de um professor em uma tarefa.
export function setDelivery(taskId, teacherId, delivered) {
  const task = getState().tasks.find((x) => x.id === taskId);
  if (!task) return null;
  const a = task.assignments.find((x) => x.teacherId === teacherId);
  if (!a) return null;
  a.delivered = !!delivered;
  a.deliveredAt = delivered ? new Date().toISOString() : null;
  commit();
  return clone(task);
}

// Remove um professor de todas as tarefas (sem persistir — quem chama comita).
export function detachTeacher(teacherId) {
  getState().tasks.forEach((task) => {
    task.assignments = task.assignments.filter((a) => a.teacherId !== teacherId);
  });
}

// Retorna o mês (YYYY-MM) de referência de uma tarefa.
export function taskMonth(task) {
  if (task.type === "monthly") return task.referenceMonth || "";
  return (task.dueDate || "").slice(0, 7);
}

// Lista de meses (YYYY-MM) com ao menos uma tarefa, desc.
export function getMonthsWithTasks() {
  const set = new Set();
  getState().tasks.forEach((t) => {
    const m = taskMonth(t);
    if (m) set.add(m);
  });
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}
