// Dados de demonstração (usados na tela de Backup).
import { clearAll } from "../core/db.js";
import { addTeacher } from "../features/teachers/teachers.store.js";
import { addTask, setDelivery } from "../features/tasks/tasks.store.js";
import { addObservation } from "../features/observations/observations.store.js";

export function loadSampleData() {
  clearAll();
  const profs = [
    { name: "Ana Souza", email: "ana@escola.edu", phone: "(27) 99999-0001", subjects: ["Programação Web", "Lógica de Programação"] },
    { name: "Bruno Lima", email: "bruno@escola.edu", phone: "(27) 99999-0002", subjects: ["Banco de Dados"] },
    { name: "Carla Mendes", email: "carla@escola.edu", phone: "", subjects: ["Redes de Computadores", "Sistemas Operacionais"] },
    { name: "Diego Rocha", email: "", phone: "", subjects: ["Front-end", "UX/UI"] },
  ].map((p) => addTeacher(p));

  const month = new Date().toISOString().slice(0, 7);
  const monthlyTask = addTask({
    title: "Diário de classe — entrega mensal",
    description: "Enviar o diário de classe preenchido até a sexta-feira da primeira semana do mês.",
    type: "monthly",
    referenceMonth: month,
    dueRule: "firstFriday",
    teacherIds: profs.map((p) => p.id),
  });
  const singleTask = addTask({
    title: "Plano de aula do bimestre",
    description: "Entregar o plano de aula atualizado.",
    type: "single",
    dueDate: month + "-15",
    teacherIds: [profs[0].id, profs[1].id],
  });

  setDelivery(singleTask.id, profs[0].id, true);
  setDelivery(monthlyTask.id, profs[1].id, true);
  setDelivery(monthlyTask.id, profs[2].id, true);

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
}
