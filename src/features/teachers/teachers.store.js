// Dados dos professores.
import { getState, commit, uid, clone } from "../../core/db.js";
import { detachTeacher } from "../tasks/tasks.store.js";

function cleanSubjects(subjects) {
  if (!Array.isArray(subjects)) return [];
  const seen = new Set();
  const result = [];
  subjects.forEach((s) => {
    const v = String(s || "").trim();
    const key = v.toLocaleLowerCase("pt-BR");
    if (v && !seen.has(key)) {
      seen.add(key);
      result.push(v);
    }
  });
  return result;
}

export function getTeachers() {
  return clone(getState().teachers).sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
  );
}

export function getTeacher(id) {
  const t = getState().teachers.find((x) => x.id === id);
  return t ? clone(t) : null;
}

export function addTeacher({ name, email, phone, subjects }) {
  const teacher = {
    id: uid("t_"),
    name: (name || "").trim(),
    email: (email || "").trim(),
    phone: (phone || "").trim(),
    subjects: cleanSubjects(subjects),
    createdAt: new Date().toISOString(),
  };
  getState().teachers.push(teacher);
  commit();
  return clone(teacher);
}

export function updateTeacher(id, { name, email, phone, subjects }) {
  const teacher = getState().teachers.find((x) => x.id === id);
  if (!teacher) return null;
  teacher.name = (name || "").trim();
  teacher.email = (email || "").trim();
  teacher.phone = (phone || "").trim();
  teacher.subjects = cleanSubjects(subjects);
  commit();
  return clone(teacher);
}

export function deleteTeacher(id) {
  const state = getState();
  state.teachers = state.teachers.filter((x) => x.id !== id);
  detachTeacher(id); // remove o professor das atribuições de tarefas
  commit();
}
