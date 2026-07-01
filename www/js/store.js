/* ===========================================================================
   store.js — camada de dados (localStorage)
   Todos os dados ficam salvos APENAS no navegador deste dispositivo.
   Use a tela de Backup para exportar/importar um arquivo .json.
   =========================================================================== */
(function (global) {
  "use strict";

  const STORAGE_KEY = "gerencia-prof:v1";
  const SCHEMA_VERSION = 1;

  // Valores iniciais do cabeçalho da observação (do template oficial).
  const DEFAULT_OBS_HEADER = {
    escola: "Escola Estadual de Ensino Médio “Nossa Senhora de Lourdes”",
    etapa: "Ensino Médio",
    modalidade: "Curso Técnico em Informática para Internet Integrado ao Ensino Médio",
    turno: "",
    area: "",
    coordenadoraPedagogica: "Wiviane Fabris Fávaro Dondoni",
    coordenadorArea: "",
  };
  const OBS_HEADER_KEYS = Object.keys(DEFAULT_OBS_HEADER);
  const OBS_CRITERIA_COUNT = 10;

  function emptyState() {
    return {
      version: SCHEMA_VERSION,
      teachers: [],
      tasks: [],
      observations: [],
      obsDefaults: Object.assign({}, DEFAULT_OBS_HEADER),
    };
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
    if (Array.isArray(data.observations)) s.observations = data.observations;
    if (data.obsDefaults && typeof data.obsDefaults === "object") {
      s.obsDefaults = Object.assign({}, DEFAULT_OBS_HEADER, data.obsDefaults);
    }
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

  // --- Configurações (integrações) ---------------------------------------
  // Guardadas em chave separada, para não se misturarem aos dados nem sumirem
  // quando o usuário "apaga todos os dados".
  const SETTINGS_KEY = "gerencia-prof:settings";
  const DEFAULT_SETTINGS = {
    googleClientId: "",
    driveEnabled: false,
    driveFolder: "Gerência Prof",
    driveKeepLocal: false,
  };
  let settings = loadSettings();

  function loadSettings() {
    try {
      const raw = global.localStorage.getItem(SETTINGS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return Object.assign({}, DEFAULT_SETTINGS, parsed || {});
    } catch (err) {
      return Object.assign({}, DEFAULT_SETTINGS);
    }
  }

  function getSettings() {
    return Object.assign({}, DEFAULT_SETTINGS, settings);
  }

  function setSettings(patch) {
    settings = Object.assign(getSettings(), patch || {});
    try {
      global.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (err) {
      console.error("Falha ao salvar configurações:", err);
    }
    return getSettings();
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

  function addTeacher({ name, email, phone, subjects }) {
    const teacher = {
      id: uid("t_"),
      name: (name || "").trim(),
      email: (email || "").trim(),
      phone: (phone || "").trim(),
      subjects: cleanSubjects(subjects),
      createdAt: new Date().toISOString(),
    };
    state.teachers.push(teacher);
    persist();
    return clone(teacher);
  }

  function updateTeacher(id, { name, email, phone, subjects }) {
    const teacher = state.teachers.find((x) => x.id === id);
    if (!teacher) return null;
    teacher.name = (name || "").trim();
    teacher.email = (email || "").trim();
    teacher.phone = (phone || "").trim();
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

  // Calcula a 1ª sexta-feira de um mês "YYYY-MM" -> "YYYY-MM-DD".
  function firstFridayOf(ym) {
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

  function addTask({ title, description, type, referenceMonth, dueDate, dueRule, teacherIds }) {
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
    state.tasks.push(task);
    persist();
    return clone(task);
  }

  function updateTask(id, { title, description, type, referenceMonth, dueDate, dueRule, teacherIds }) {
    const task = state.tasks.find((x) => x.id === id);
    if (!task) return null;
    task.title = (title || "").trim();
    task.description = (description || "").trim();
    task.type = type === "monthly" ? "monthly" : "single";
    task.referenceMonth = task.type === "monthly" ? referenceMonth || "" : "";
    const due = resolveDue(task.type, task.referenceMonth, dueDate, dueRule);
    task.dueRule = due.dueRule;
    task.dueDate = due.dueDate;
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

  // --- Observações de aula ------------------------------------------------
  function emptyCriterios() {
    const arr = [];
    for (let i = 0; i < OBS_CRITERIA_COUNT; i++) arr.push({ mark: "", evidencias: "" });
    return arr;
  }

  function getObsDefaults() {
    return Object.assign({}, DEFAULT_OBS_HEADER, state.obsDefaults || {});
  }

  // Guarda os campos de cabeçalho para reutilizar na próxima observação.
  function rememberObsDefaults(obs) {
    state.obsDefaults = state.obsDefaults || {};
    OBS_HEADER_KEYS.forEach((k) => {
      if (obs[k] != null && String(obs[k]).trim() !== "") state.obsDefaults[k] = obs[k];
    });
  }

  function sanitizeObservation(payload, base) {
    const o = base || {};
    const str = (v, fb) => (v != null ? String(v) : fb != null ? fb : "");
    const result = {
      id: o.id,
      teacherId: payload.teacherId || o.teacherId || "",
      escola: str(payload.escola, o.escola),
      etapa: str(payload.etapa, o.etapa),
      modalidade: str(payload.modalidade, o.modalidade),
      turno: str(payload.turno, o.turno),
      area: str(payload.area, o.area),
      coordenadoraPedagogica: str(payload.coordenadoraPedagogica, o.coordenadoraPedagogica),
      coordenadorArea: str(payload.coordenadorArea, o.coordenadorArea),
      disciplina: str(payload.disciplina, o.disciplina),
      professor: str(payload.professor, o.professor),
      serieTurma: str(payload.serieTurma, o.serieTurma),
      dataObservacao: str(payload.dataObservacao, o.dataObservacao),
      horario: str(payload.horario, o.horario),
      observacoes: str(payload.observacoes, o.observacoes),
      registroEvidencias: str(payload.registroEvidencias, o.registroEvidencias),
      sugestoes: str(payload.sugestoes, o.sugestoes),
      dataFeedback: str(payload.dataFeedback, o.dataFeedback),
      assinaturas: {
        regente: str((payload.assinaturas || {}).regente, (o.assinaturas || {}).regente),
        coordenadorArea: str((payload.assinaturas || {}).coordenadorArea, (o.assinaturas || {}).coordenadorArea),
        pedagoga: str((payload.assinaturas || {}).pedagoga, (o.assinaturas || {}).pedagoga),
        coordenadoraPedagogica: str((payload.assinaturas || {}).coordenadoraPedagogica, (o.assinaturas || {}).coordenadoraPedagogica),
      },
      criterios: emptyCriterios(),
    };
    const src = Array.isArray(payload.criterios) ? payload.criterios : (o.criterios || []);
    result.criterios = result.criterios.map((c, i) => {
      const s = src[i] || {};
      const mark = ["sim", "nao", "na"].includes(s.mark) ? s.mark : "";
      return { mark, evidencias: s.evidencias != null ? String(s.evidencias) : "" };
    });
    return result;
  }

  function getObservations() {
    return clone(state.observations).sort((a, b) => {
      const ka = a.dataObservacao || "";
      const kb = b.dataObservacao || "";
      if (ka !== kb) return kb.localeCompare(ka);
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });
  }

  function getObservation(id) {
    const o = state.observations.find((x) => x.id === id);
    return o ? clone(o) : null;
  }

  function addObservation(payload) {
    const obs = sanitizeObservation(payload, {});
    obs.id = uid("o_");
    obs.createdAt = new Date().toISOString();
    obs.updatedAt = obs.createdAt;
    state.observations.push(obs);
    rememberObsDefaults(obs);
    persist();
    return clone(obs);
  }

  function updateObservation(id, payload) {
    const existing = state.observations.find((x) => x.id === id);
    if (!existing) return null;
    const updated = sanitizeObservation(payload, existing);
    updated.id = id;
    updated.createdAt = existing.createdAt;
    updated.updatedAt = new Date().toISOString();
    const idx = state.observations.indexOf(existing);
    state.observations[idx] = updated;
    rememberObsDefaults(updated);
    persist();
    return clone(updated);
  }

  function deleteObservation(id) {
    state.observations = state.observations.filter((x) => x.id !== id);
    persist();
  }

  // Cria uma observação em branco já com os defaults do cabeçalho.
  function newObservationDraft() {
    const defaults = getObsDefaults();
    return Object.assign(
      {
        id: null,
        teacherId: "",
        disciplina: "",
        professor: "",
        serieTurma: "",
        dataObservacao: new Date().toISOString().slice(0, 10),
        horario: "",
        observacoes: "",
        registroEvidencias: "",
        sugestoes: "",
        dataFeedback: "",
        assinaturas: { regente: "", coordenadorArea: "", pedagoga: "", coordenadoraPedagogica: "" },
        criterios: emptyCriterios(),
      },
      defaults
    );
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
      observations: state.observations.length,
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
    if (!incoming || (!Array.isArray(incoming.teachers) && !Array.isArray(incoming.tasks) && !Array.isArray(incoming.observations))) {
      throw new Error("Arquivo inválido: estrutura não reconhecida.");
    }
    const next = normalize(incoming);
    if (merge) {
      const teacherIds = new Set(state.teachers.map((t) => t.id));
      const taskIds = new Set(state.tasks.map((t) => t.id));
      const obsIds = new Set(state.observations.map((o) => o.id));
      next.teachers.forEach((t) => { if (!teacherIds.has(t.id)) state.teachers.push(t); });
      next.tasks.forEach((t) => { if (!taskIds.has(t.id)) state.tasks.push(t); });
      next.observations.forEach((o) => { if (!obsIds.has(o.id)) state.observations.push(o); });
      state.obsDefaults = Object.assign({}, next.obsDefaults, state.obsDefaults);
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
      { name: "Ana Souza", email: "ana@escola.edu", phone: "(27) 99999-0001", subjects: ["Programação Web", "Lógica de Programação"] },
      { name: "Bruno Lima", email: "bruno@escola.edu", phone: "(27) 99999-0002", subjects: ["Banco de Dados"] },
      { name: "Carla Mendes", email: "carla@escola.edu", phone: "", subjects: ["Redes de Computadores", "Sistemas Operacionais"] },
      { name: "Diego Rocha", email: "", phone: "", subjects: ["Front-end", "UX/UI"] },
    ].map((p) => addTeacher(p));

    const month = new Date().toISOString().slice(0, 7);
    addTask({
      title: "Diário de classe — entrega mensal",
      description: "Enviar o diário de classe preenchido até a sexta-feira da primeira semana do mês.",
      type: "monthly",
      referenceMonth: month,
      dueRule: "firstFriday",
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

    // Observação de aula de exemplo.
    const marks = ["sim", "sim", "na", "nao", "sim", "sim", "nao", "sim", "sim", "na"];
    addObservation({
      teacherId: profs[0].id,
      professor: profs[0].name,
      disciplina: (profs[0].subjects && profs[0].subjects[0]) || "Programação Web",
      serieTurma: "2º Ano — Turma B",
      dataObservacao: new Date().toISOString().slice(0, 10),
      horario: "15h-15h50",
      area: "Área Técnica — Informática",
      criterios: marks.map((m, i) => ({
        mark: m,
        evidencias: i === 0 ? "A professora apresentou a habilidade na folha de atividade." : "",
      })),
      observacoes: "Registro da frequência no início da aula. Boa interação com a turma.",
      registroEvidencias: "Revisão de conteúdo e exercícios projetados, com resolução no caderno.",
      sugestoes: "Recomenda-se apresentar a habilidade correspondente e atentar-se ao tempo da aula.",
      dataFeedback: new Date().toISOString().slice(0, 10),
      assinaturas: { regente: profs[0].name, coordenadorArea: "", pedagoga: "", coordenadoraPedagogica: "" },
    });

    return getStats();
  }

  // --- API pública --------------------------------------------------------
  global.Store = {
    // professores
    getTeachers, getTeacher, addTeacher, updateTeacher, deleteTeacher,
    // tarefas
    getTasks, getTask, addTask, updateTask, deleteTask, setDelivery, firstFridayOf,
    // observações de aula
    getObservations, getObservation, addObservation, updateObservation,
    deleteObservation, newObservationDraft, getObsDefaults,
    // relatórios
    getMonthlyReport, getMonthsWithTasks, getStats, taskMonth,
    // configurações / integrações
    getSettings, setSettings,
    // backup
    exportData, importData, clearAll, loadSampleData,
  };
})(window);
