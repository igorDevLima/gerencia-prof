// ===========================================================================
// db.js — camada de persistência (localStorage) compartilhada pelas features.
// Guarda o estado bruto { teachers, tasks, observations, obsDefaults } e as
// configurações (integrações). As features leem/gravam via getState()+commit().
// ===========================================================================
const STORAGE_KEY = "gerencia-prof:v1";
const SETTINGS_KEY = "gerencia-prof:settings";
export const SCHEMA_VERSION = 1;

export const DEFAULT_OBS_HEADER = {
  escola: "Escola Estadual de Ensino Médio “Nossa Senhora de Lourdes”",
  etapa: "Ensino Médio",
  modalidade: "Curso Técnico em Informática para Internet Integrado ao Ensino Médio",
  turno: "",
  area: "",
  coordenadoraPedagogica: "Wiviane Fabris Fávaro Dondoni",
  coordenadorArea: "",
};
export const OBS_HEADER_KEYS = Object.keys(DEFAULT_OBS_HEADER);
export const OBS_CRITERIA_COUNT = 10;

const DEFAULT_SETTINGS = {
  googleClientId: "",
  driveEnabled: false,
  driveFolder: "Gerência Prof",
  driveKeepLocal: false,
};

export function emptyState() {
  return {
    version: SCHEMA_VERSION,
    teachers: [],
    tasks: [],
    observations: [],
    obsDefaults: Object.assign({}, DEFAULT_OBS_HEADER),
  };
}

export function uid(prefix) {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return (prefix || "") + window.crypto.randomUUID();
  }
  return (prefix || "") + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

function load() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyState();
    return normalize(parsed);
  } catch (err) {
    console.error("Falha ao ler dados salvos:", err);
    return emptyState();
  }
}

let state = load();

export function getState() {
  return state;
}

export function commit() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error("Falha ao salvar dados:", err);
    alert("Não foi possível salvar os dados (armazenamento cheio ou indisponível).");
  }
}

// --- Configurações ---------------------------------------------------------
function loadSettings() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return Object.assign({}, DEFAULT_SETTINGS, parsed || {});
  } catch (err) {
    return Object.assign({}, DEFAULT_SETTINGS);
  }
}

let settings = loadSettings();

export function getSettings() {
  return Object.assign({}, DEFAULT_SETTINGS, settings);
}

export function setSettings(patch) {
  settings = Object.assign(getSettings(), patch || {});
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error("Falha ao salvar configurações:", err);
  }
  return getSettings();
}

// --- Backup / restauração --------------------------------------------------
export function exportData() {
  return JSON.stringify(
    { version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data: state },
    null,
    2
  );
}

export function importData(json, { merge } = {}) {
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
  commit();
}

export function clearAll() {
  state = emptyState();
  commit();
}
