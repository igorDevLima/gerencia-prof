// Dados das observações de aula.
import {
  getState, commit, uid, clone,
  DEFAULT_OBS_HEADER, OBS_HEADER_KEYS, OBS_CRITERIA_COUNT,
} from "../../core/db.js";

function emptyCriterios() {
  const arr = [];
  for (let i = 0; i < OBS_CRITERIA_COUNT; i++) arr.push({ mark: "", evidencias: "" });
  return arr;
}

export function getObsDefaults() {
  return Object.assign({}, DEFAULT_OBS_HEADER, getState().obsDefaults || {});
}

function rememberObsDefaults(obs) {
  const state = getState();
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

export function getObservations() {
  return clone(getState().observations).sort((a, b) => {
    const ka = a.dataObservacao || "";
    const kb = b.dataObservacao || "";
    if (ka !== kb) return kb.localeCompare(ka);
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });
}

export function getObservation(id) {
  const o = getState().observations.find((x) => x.id === id);
  return o ? clone(o) : null;
}

export function addObservation(payload) {
  const obs = sanitizeObservation(payload, {});
  obs.id = uid("o_");
  obs.createdAt = new Date().toISOString();
  obs.updatedAt = obs.createdAt;
  getState().observations.push(obs);
  rememberObsDefaults(obs);
  commit();
  return clone(obs);
}

export function updateObservation(id, payload) {
  const state = getState();
  const existing = state.observations.find((x) => x.id === id);
  if (!existing) return null;
  const updated = sanitizeObservation(payload, existing);
  updated.id = id;
  updated.createdAt = existing.createdAt;
  updated.updatedAt = new Date().toISOString();
  state.observations[state.observations.indexOf(existing)] = updated;
  rememberObsDefaults(updated);
  commit();
  return clone(updated);
}

export function deleteObservation(id) {
  const state = getState();
  state.observations = state.observations.filter((x) => x.id !== id);
  commit();
}

export function newObservationDraft() {
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
    getObsDefaults()
  );
}
