/* ===========================================================================
   store.js — camada de dados (localStorage)
   Todos os dados ficam salvos APENAS no navegador deste dispositivo.
   Use a tela de Backup para exportar/importar um arquivo .json.
   =========================================================================== */
(function (global) {
  "use strict";

  const STORAGE_KEY = "gerencia-prof:v1";
  const SCHEMA_VERSION = 1;

  function emptyState() {
    return { version: SCHEMA_VERSION, teachers: [], tasks: [] };
  }

  function uid(prefix) {
    if (global.crypto && typeof global.crypto.randomUUID === "function") {
      return (prefix || "") + global.crypto.randomUUID();
    }
    return (prefix || "") + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

  // --- Persistência -------------------------------------------------------
  let state = load();

  function load() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return emptyState();
      return normalize(parsed);
    } catch (err) {
      console.error("Falha ao ler dados salvos:", err);
      return emptyState();
    }
  }

  function normalize(data) {
    const s = emptyState();
    if (Array.isArray(data.teachers)) s.teachers = data.teachers;
    if (Array.isArray(data.tasks)) s.tasks = data.tasks;
    return s;
  }

  function persist() {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error("Falha ao salvar dados:", err);
      alert("Não foi possível salvar os dados (armazenamento cheio ou indisponível).");
    }
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  // --- Professores --------------------------------------------------------
  function getTeachers() {
    return clone(state.teachers).sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
    );
  }

  function getTeacher(id) {
    const t = state.teachers.find((x) => x.id === id);
    return t ? clone(t) : null;
  }

  function addTeacher({ name, email, subjects }) {
    const teacher = {
      id: uid("t_"),
      name: (name || "").trim(),
      email: (email || "").trim(),
      subjects: cleanSubjects(subjects),
      createdAt: new Date().toISOString(),
    };
    state.teachers.push(teacher);
    persist();
    return clone(teacher);
  }

  function updateTeacher(id, { name, email, subjects }) {
    const teacher = state.teachers.find((x) => x.id === id);
    if (!teacher) return null;
    teacher.name = (name || "").trim();
    teacher.email = (email || "").trim();
    teacher.subjects = cleanSubjects(subjects);
    persist();
    return clone(teacher);
  }

  function deleteTeacher(id) {
    state.teachers = state.teachers.filter((x) => x.id !== id);
    // Remove o professor das atribuições de tarefas existentes.
    state.tasks.forEach((task) => {
      task.assignments = task.assignments.filter((a) => a.teacherId !== id);
    });
    persist();
  }

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

  // --- Tarefas ------------------------------------------------------------
  function getTasks() {
    return clone(state.tasks).sort(sortTasks);
  }

  function getTask(id) {
    const t = state.tasks.find((x) => x.id === id);
    return t ? clone(t) : null;
  }

  // Ordena por mês de referência / vencimento, mais recente primeiro.
  function sortTasks(a, b) {
    const ka = a.type === "monthly" ? a.referenceMonth || "" : (a.dueDate || "").slice(0, 7);
    const kb = b.type === "monthly" ? b.referenceMonth || "" : (b.dueDate || "").slice(0, 7);
    if (ka !== kb) return kb.localeCompare(ka);
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  }

  function addTask({ title, description, type, referenceMonth, dueDate, teacherIds }) {
    const task = {
      id: uid("k_"),
      title: (title || "").trim(),
      description: (description || "").trim(),
      type: type === "monthly" ? "monthly" : "single",
      referenceMonth: type === "monthly" ? referenceMonth || "" : "",
      dueDate: dueDate || "",
      assignments: buildAssignments(teacherIds, []),
      createdAt: new Date().toISOString(),
    };
    state.tasks.push(task);
    persist();
    return clone(task);
  }

  function updateTask(id, { title, description, type, referenceMonth, dueDate, teacherIds }) {
    const task = state.tasks.find((x) => x.id === id);
    if (!task) return null;
    task.title = (title || "").trim();
    task.description = (description || "").trim();
    task.type = type === "monthly" ? "monthly" : "single";
    task.referenceMonth = task.type === "monthly" ? referenceMonth || "" : "";
    task.dueDate = dueDate || "";
    // Preserva o status de entrega dos professores que continuam na tarefa.
    task.assignments = buildAssignments(teacherIds, task.assignments);
    persist();
    return clone(task);
  }

  function deleteTask(id) {
    state.tasks = state.tasks.filter((x) => x.id !== id);
    persist();
  }

  // Monta a lista de atribuições preservando entregas anteriores.
  function buildAssignments(teacherIds, previous) {
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

  // Marca/desmarca a entrega de um professor em uma tarefa.
  function setDelivery(taskId, teacherId, delivered) {
    const task = state.tasks.find((x) => x.id === taskId);
    if (!task) return null;
    const a = task.assignments.find((x) => x.teacherId === teacherId);
    if (!a) return null;
    a.delivered = !!delivered;
    a.deliveredAt = delivered ? new Date().toISOString() : null;
    persist();
    return clone(task);
  }

  // --- Relatórios ---------------------------------------------------------
  // Retorna o mês (YYYY-MM) de referência de uma tarefa.
  function taskMonth(task) {
    if (task.type === "monthly") return task.referenceMonth || "";
    return (task.dueDate || "").slice(0, 7);
  }

  // Lista de meses (YYYY-MM) que possuem ao menos uma tarefa, desc.
  function getMonthsWithTasks() {
    const set = new Set();
    state.tasks.forEach((t) => {
      const m = taskMonth(t);
      if (m) set.add(m);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }

  // Relatório de pendências de um mês.
  function getMonthlyReport(month) {
    const tasks = state.tasks
      .filter((t) => taskMonth(t) === month)
      .sort(sortTasks);

    const teacherMap = new Map(state.teachers.map((t) => [t.id, t]));
    const pendingByTeacher = new Map(); // teacherId -> { teacher, tasks: [] }

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

  // Estatísticas para o painel.
  function getStats() {
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
      pendingDeliveries,
      totalDeliveries,
      currentMonth,
      currentMonthPendingTeachers: currentReport.pendingTeachers.length,
      currentMonthTasks: currentReport.totalTasks,
    };
  }

  // --- Backup / restauração ----------------------------------------------
  function exportData() {
    return JSON.stringify(
      { version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data: state },
      null,
      2
    );
  }

  function importData(json, { merge } = {}) {
    let parsed;
    try {
      parsed = typeof json === "string" ? JSON.parse(json) : json;
    } catch (err) {
      throw new Error("Arquivo inválido: não é um JSON válido.");
    }
    const incoming = parsed && parsed.data ? parsed.data : parsed;
    if (!incoming || (!Array.isArray(incoming.teachers) && !Array.isArray(incoming.tasks))) {
      throw new Error("Arquivo inválido: estrutura não reconhecida.");
    }
    const next = normalize(incoming);
    if (merge) {
      const teacherIds = new Set(state.teachers.map((t) => t.id));
      const taskIds = new Set(state.tasks.map((t) => t.id));
      next.teachers.forEach((t) => { if (!teacherIds.has(t.id)) state.teachers.push(t); });
      next.tasks.forEach((t) => { if (!taskIds.has(t.id)) state.tasks.push(t); });
    } else {
      state = next;
    }
    persist();
    return getStats();
  }

  function clearAll() {
    state = emptyState();
    persist();
  }

  // Dados de demonstração para testes rápidos.
  function loadSampleData() {
    state = emptyState();
    const profs = [
      { name: "Ana Souza", email: "ana@escola.edu", subjects: ["Programação Web", "Lógica de Programação"] },
      { name: "Bruno Lima", email: "bruno@escola.edu", subjects: ["Banco de Dados"] },
      { name: "Carla Mendes", email: "carla@escola.edu", subjects: ["Redes de Computadores", "Sistemas Operacionais"] },
      { name: "Diego Rocha", email: "", subjects: ["Front-end", "UX/UI"] },
    ].map((p) => addTeacher(p));

    const month = new Date().toISOString().slice(0, 7);
    addTask({
      title: "Diário de classe — entrega mensal",
      description: "Enviar o diário de classe preenchido até o último dia útil do mês.",
      type: "monthly",
      referenceMonth: month,
      dueDate: month + "-30",
      teacherIds: profs.map((p) => p.id),
    });
    addTask({
      title: "Plano de aula do bimestre",
      description: "Entregar o plano de aula atualizado.",
      type: "single",
      dueDate: month + "-15",
      teacherIds: [profs[0].id, profs[1].id],
    });
    // Marca algumas entregas para ilustrar o relatório.
    const firstTask = state.tasks[state.tasks.length - 1];
    if (firstTask) setDelivery(firstTask.id, profs[0].id, true);
    const monthlyTask = state.tasks.find((t) => t.type === "monthly");
    if (monthlyTask) {
      setDelivery(monthlyTask.id, profs[1].id, true);
      setDelivery(monthlyTask.id, profs[2].id, true);
    }
    return getStats();
  }

  // --- API pública --------------------------------------------------------
  global.Store = {
    // professores
    getTeachers, getTeacher, addTeacher, updateTeacher, deleteTeacher,
    // tarefas
    getTasks, getTask, addTask, updateTask, deleteTask, setDelivery,
    // relatórios
    getMonthlyReport, getMonthsWithTasks, getStats, taskMonth,
    // backup
    exportData, importData, clearAll, loadSampleData,
  };
})(window);
