/* ===========================================================================
   app.js — roteador + telas (painel, professores, tarefas, relatórios, backup)
   =========================================================================== */
(function (global) {
  "use strict";

  const { escapeHtml, formatMonth, formatDate, formatDateTime, pluralize, toast,
          openModal, closeModal, onModalClose, confirmDialog, downloadFile } = global.UI;

  const view = document.getElementById("view");
  const pageTitle = document.getElementById("pageTitle");

  const ROUTES = {
    painel: { title: "Painel", render: renderDashboard },
    professores: { title: "Professores", render: renderTeachers },
    tarefas: { title: "Tarefas", render: renderTasks },
    observacoes: { title: "Observação de aula", render: renderObservations },
    relatorios: { title: "Relatórios", render: renderReports },
    backup: { title: "Backup e dados", render: renderBackup },
  };

  // Estado de interface que sobrevive a re-renders da tela de tarefas.
  const expandedTasks = new Set();
  let tasksFilterMonth = "";
  let reportsMonth = "";
  // null = lista; "new" = nova observação; id = editando observação.
  let editingObsId = null;

  // ======================================================================
  //  Roteamento
  // ======================================================================
  function currentRoute() {
    const hash = (location.hash || "").replace(/^#\//, "");
    return ROUTES[hash] ? hash : "painel";
  }

  function router() {
    const routeKey = currentRoute();
    const route = ROUTES[routeKey];
    // Navegar pelo menu sempre mostra a lista de observações (fecha o formulário).
    editingObsId = null;
    pageTitle.textContent = route.title;
    document.querySelectorAll("[data-route]").forEach((el) => {
      el.classList.toggle("active", el.getAttribute("data-route") === routeKey);
    });
    closeSidebar();
    view.scrollTop = 0;
    route.render();
    view.focus({ preventScroll: true });
  }

  function navigate(routeKey) {
    if (location.hash === "#/" + routeKey) router();
    else location.hash = "#/" + routeKey;
  }

  // ======================================================================
  //  Painel
  // ======================================================================
  function renderDashboard() {
    const s = Store.getStats();
    const report = Store.getMonthlyReport(s.currentMonth);

    let html = `
      <div class="stats">
        <div class="stat stat--primary">
          <div class="stat__value">${s.teachers}</div>
          <div class="stat__label">${pluralize(s.teachers, "Professor cadastrado", "Professores cadastrados")}</div>
        </div>
        <div class="stat">
          <div class="stat__value">${s.tasks}</div>
          <div class="stat__label">${pluralize(s.tasks, "Tarefa criada", "Tarefas criadas")}</div>
        </div>
        <div class="stat stat--warning">
          <div class="stat__value">${s.pendingDeliveries}</div>
          <div class="stat__label">${pluralize(s.pendingDeliveries, "Entrega pendente", "Entregas pendentes")} (total)</div>
        </div>
        <div class="stat stat--danger">
          <div class="stat__value">${s.currentMonthPendingTeachers}</div>
          <div class="stat__label">Com pendência em ${escapeHtml(formatMonth(s.currentMonth))}</div>
        </div>
      </div>`;

    if (s.teachers === 0) {
      html += emptyCard("👋", "Bem-vindo!",
        "Comece cadastrando seus professores e as matérias que cada um leciona.",
        `<button class="btn" data-go="professores">Cadastrar professores</button>`);
      view.innerHTML = html;
      bindGoButtons();
      return;
    }

    // Resumo do mês atual.
    html += `
      <div class="card">
        <div class="card__body">
          <div class="section-head">
            <div>
              <h2 class="mt-0 mb-0">Situação de ${escapeHtml(formatMonth(s.currentMonth))}</h2>
              <p>Entregas das tarefas com referência neste mês.</p>
            </div>
            <button class="btn btn--ghost btn--sm" data-go="relatorios">Ver relatório completo →</button>
          </div>
          ${renderMonthSummary(report)}
        </div>
      </div>`;

    // Próximas pendências (até 5 tarefas com pendência).
    const tasksWithPending = report.tasks.filter((t) => t.pendingCount > 0).slice(0, 5);
    if (tasksWithPending.length) {
      html += `<div class="card"><div class="card__body">
        <h2 class="mt-0">Tarefas com pendências este mês</h2>
        <div class="list">`;
      tasksWithPending.forEach((tr) => {
        html += `
          <div class="delivery">
            <div class="delivery__info">
              <div class="delivery__name">${escapeHtml(tr.task.title)}</div>
              <div class="delivery__sub">${tr.deliveredCount}/${tr.total} entregaram</div>
            </div>
            <span class="badge badge--danger">${tr.pendingCount} ${pluralize(tr.pendingCount, "pendente", "pendentes")}</span>
          </div>`;
      });
      html += `</div></div></div>`;
    }

    view.innerHTML = html;
    bindGoButtons();
  }

  function renderMonthSummary(report) {
    if (report.totalTasks === 0) {
      return `<p class="muted mb-0">Nenhuma tarefa com referência neste mês.
        <a href="#/tarefas">Criar uma tarefa</a>.</p>`;
    }
    if (report.pendingTeachers.length === 0) {
      return `<div class="badge badge--success" style="font-size:.9rem;padding:8px 14px;">
        ✓ Todos os professores entregaram as tarefas deste mês.</div>`;
    }
    let html = `<p class="text-sm muted mt-0">Professores com alguma entrega pendente:</p>
      <div class="list">`;
    report.pendingTeachers.forEach((p) => {
      html += `
        <div class="delivery">
          <div class="delivery__info">
            <div class="delivery__name">${escapeHtml(p.teacher.name)}</div>
            <div class="delivery__sub">${escapeHtml(p.tasks.join(" • "))}</div>
          </div>
          <span class="badge badge--danger">${p.tasks.length} ${pluralize(p.tasks.length, "tarefa", "tarefas")}</span>
        </div>`;
    });
    html += `</div>`;
    return html;
  }

  // ======================================================================
  //  Professores
  // ======================================================================
  function renderTeachers() {
    const teachers = Store.getTeachers();
    let html = `
      <div class="section-head">
        <div>
          <h2 class="mt-0 mb-0">Professores</h2>
          <p>${teachers.length} ${pluralize(teachers.length, "professor cadastrado", "professores cadastrados")}.</p>
        </div>
        <button class="btn" data-new-teacher>+ Novo professor</button>
      </div>`;

    if (teachers.length === 0) {
      html += emptyCard("👩‍🏫", "Nenhum professor ainda",
        "Cadastre os professores e informe as matérias que cada um leciona.",
        `<button class="btn" data-new-teacher>Cadastrar professor</button>`);
      view.innerHTML = html;
      bindTeacherActions();
      return;
    }

    html += `<div class="list">`;
    teachers.forEach((t) => {
      const subjects = t.subjects.length
        ? `<div class="tags" style="margin-top:10px">${t.subjects.map((s) => `<span class="tag">${escapeHtml(s)}</span>`).join("")}</div>`
        : `<div class="muted text-sm" style="margin-top:8px">Sem matérias informadas</div>`;
      html += `
        <div class="item">
          <div class="item__head">
            <div>
              <h3 class="item__title">${escapeHtml(t.name)}</h3>
              ${(t.email || t.phone) ? `<div class="item__meta">${t.email ? `<span>✉️ ${escapeHtml(t.email)}</span>` : ""}${t.phone ? `<span>📱 ${escapeHtml(t.phone)}</span>` : ""}</div>` : ""}
            </div>
            <div class="item__actions">
              <button class="btn-icon" title="Editar" data-edit-teacher="${t.id}">✏️</button>
              <button class="btn-icon btn-icon--danger" title="Excluir" data-del-teacher="${t.id}">🗑️</button>
            </div>
          </div>
          ${subjects}
        </div>`;
    });
    html += `</div>`;
    view.innerHTML = html;
    bindTeacherActions();
  }

  function bindTeacherActions() {
    view.querySelectorAll("[data-new-teacher]").forEach((b) =>
      b.addEventListener("click", () => openTeacherForm()));
    view.querySelectorAll("[data-edit-teacher]").forEach((b) =>
      b.addEventListener("click", () => openTeacherForm(b.getAttribute("data-edit-teacher"))));
    view.querySelectorAll("[data-del-teacher]").forEach((b) =>
      b.addEventListener("click", () => deleteTeacherFlow(b.getAttribute("data-del-teacher"))));
  }

  function openTeacherForm(id) {
    const teacher = id ? Store.getTeacher(id) : null;
    const subjects = teacher ? teacher.subjects.slice() : [];

    const html = `
      <form id="teacherForm">
        <div class="field">
          <label for="tName">Nome *</label>
          <input class="input" id="tName" required maxlength="120"
                 value="${escapeHtml(teacher ? teacher.name : "")}" placeholder="Ex.: Maria Silva" />
        </div>
        <div class="form-row">
          <div class="field">
            <label for="tEmail">E-mail (opcional)</label>
            <input class="input" id="tEmail" type="email" maxlength="160"
                   value="${escapeHtml(teacher ? teacher.email : "")}" placeholder="maria@escola.edu" />
          </div>
          <div class="field">
            <label for="tPhone">WhatsApp (opcional)</label>
            <input class="input" id="tPhone" type="tel" maxlength="30"
                   value="${escapeHtml(teacher ? teacher.phone || "" : "")}" placeholder="Ex.: (27) 99999-8888" />
            <div class="hint">Com DDD. Usado para enviar avisos pelo WhatsApp.</div>
          </div>
        </div>
        <div class="field">
          <label for="tSubject">Matérias</label>
          <div class="flex gap">
            <input class="input grow" id="tSubject" maxlength="80"
                   placeholder="Digite uma matéria e tecle Enter" />
            <button class="btn btn--ghost" type="button" id="addSubject">Adicionar</button>
          </div>
          <div class="tags" id="subjectTags" style="margin-top:10px"></div>
          <div class="hint">Adicione quantas matérias o professor leciona.</div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn--ghost" data-close-modal>Cancelar</button>
          <button type="submit" class="btn">${id ? "Salvar alterações" : "Cadastrar"}</button>
        </div>
      </form>`;

    openModal(id ? "Editar professor" : "Novo professor", html, (body) => {
      body.querySelector("[data-close-modal]").addEventListener("click", closeModal);
      const tagsEl = body.querySelector("#subjectTags");
      const subjectInput = body.querySelector("#tSubject");

      function renderTags() {
        tagsEl.innerHTML = subjects.map((s, i) =>
          `<span class="tag">${escapeHtml(s)}<button type="button" class="tag__remove" data-rm="${i}" aria-label="Remover">×</button></span>`
        ).join("");
        tagsEl.querySelectorAll("[data-rm]").forEach((btn) =>
          btn.addEventListener("click", () => {
            subjects.splice(Number(btn.getAttribute("data-rm")), 1);
            renderTags();
          }));
      }
      function addSubject() {
        const val = subjectInput.value.trim();
        if (!val) return;
        const exists = subjects.some((s) => s.toLocaleLowerCase("pt-BR") === val.toLocaleLowerCase("pt-BR"));
        if (!exists) subjects.push(val);
        subjectInput.value = "";
        subjectInput.focus();
        renderTags();
      }
      body.querySelector("#addSubject").addEventListener("click", addSubject);
      subjectInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSubject(); }
      });
      renderTags();

      body.querySelector("#teacherForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const name = body.querySelector("#tName").value.trim();
        if (!name) { toast("Informe o nome do professor.", "danger"); return; }
        const email = body.querySelector("#tEmail").value.trim();
        const phone = body.querySelector("#tPhone").value.trim();
        const payload = { name, email, phone, subjects };
        if (id) { Store.updateTeacher(id, payload); toast("Professor atualizado.", "success"); }
        else { Store.addTeacher(payload); toast("Professor cadastrado.", "success"); }
        closeModal();
        renderTeachers();
      });
    });
  }

  async function deleteTeacherFlow(id) {
    const teacher = Store.getTeacher(id);
    if (!teacher) return;
    const tasks = Store.getTasks();
    const inTasks = tasks.filter((t) => t.assignments.some((a) => a.teacherId === id)).length;
    const extra = inTasks
      ? ` Ele será removido de ${inTasks} ${pluralize(inTasks, "tarefa", "tarefas")}.`
      : "";
    const ok = await confirmDialog({
      title: "Excluir professor",
      message: `Excluir "${teacher.name}"?${extra} Esta ação não pode ser desfeita.`,
      confirmText: "Excluir",
      danger: true,
    });
    if (!ok) return;
    Store.deleteTeacher(id);
    toast("Professor excluído.", "success");
    renderTeachers();
  }

  // ======================================================================
  //  Tarefas
  // ======================================================================
  function renderTasks() {
    const teachers = Store.getTeachers();
    let tasks = Store.getTasks();
    const months = Store.getMonthsWithTasks();

    let html = `
      <div class="section-head">
        <div>
          <h2 class="mt-0 mb-0">Tarefas</h2>
          <p>Crie tarefas e marque quem já entregou.</p>
        </div>
        <button class="btn" data-new-task ${teachers.length ? "" : "disabled title='Cadastre um professor antes'"}>+ Nova tarefa</button>
      </div>`;

    if (teachers.length === 0) {
      html += emptyCard("📝", "Cadastre professores primeiro",
        "As tarefas são atribuídas aos professores. Cadastre ao menos um professor para começar.",
        `<button class="btn" data-go="professores">Ir para professores</button>`);
      view.innerHTML = html;
      bindGoButtons();
      view.querySelectorAll("[data-new-task]").forEach((b) => b.setAttribute("disabled", ""));
      return;
    }

    // Filtro por mês.
    if (tasksFilterMonth && !months.includes(tasksFilterMonth)) tasksFilterMonth = "";
    if (months.length) {
      html += `<div class="card" style="margin-bottom:16px"><div class="card__body" style="padding:12px 16px">
        <div class="flex gap center wrap">
          <label for="taskMonthFilter" class="text-sm" style="font-weight:600">Filtrar por mês:</label>
          <select class="select" id="taskMonthFilter" style="max-width:240px">
            <option value="">Todos os meses</option>
            ${months.map((m) => `<option value="${m}" ${m === tasksFilterMonth ? "selected" : ""}>${escapeHtml(formatMonth(m))}</option>`).join("")}
          </select>
        </div>
      </div></div>`;
    }

    if (tasksFilterMonth) tasks = tasks.filter((t) => Store.taskMonth(t) === tasksFilterMonth);

    if (tasks.length === 0) {
      html += emptyCard("📝",
        tasksFilterMonth ? "Nenhuma tarefa neste mês" : "Nenhuma tarefa ainda",
        tasksFilterMonth ? "Tente outro mês ou crie uma nova tarefa." : "Crie a primeira tarefa e atribua aos professores responsáveis.",
        `<button class="btn" data-new-task>Nova tarefa</button>`);
      html = wrapTasksContainer(html);
      view.innerHTML = html;
      bindTaskActions(teachers);
      return;
    }

    html += `<div class="list" id="taskList">`;
    tasks.forEach((task) => { html += renderTaskCard(task); });
    html += `</div>`;
    view.innerHTML = html;
    bindTaskActions(teachers);
  }

  function wrapTasksContainer(inner) { return inner; }

  function renderTaskCard(task) {
    const teacherMap = new Map(Store.getTeachers().map((t) => [t.id, t]));
    const total = task.assignments.length;
    const delivered = task.assignments.filter((a) => a.delivered).length;
    const pending = total - delivered;
    const pct = total ? Math.round((delivered / total) * 100) : 0;
    const expanded = expandedTasks.has(task.id);

    const typeBadge = task.type === "monthly"
      ? `<span class="badge badge--info">📅 Mensal</span>`
      : `<span class="badge badge--muted">Avulsa</span>`;
    const monthBadge = task.type === "monthly" && task.referenceMonth
      ? `<span class="badge badge--muted">${escapeHtml(formatMonth(task.referenceMonth))}</span>` : "";
    const dueBadge = task.dueDate
      ? `<span class="badge badge--muted">Entrega: ${escapeHtml(formatDate(task.dueDate))}</span>` : "";
    const ruleBadge = task.dueRule === "firstFriday"
      ? `<span class="badge badge--info">1ª sexta do mês</span>` : "";
    const statusBadge = total === 0
      ? `<span class="badge badge--muted">Sem responsáveis</span>`
      : pending === 0
        ? `<span class="badge badge--success">✓ Todos entregaram</span>`
        : `<span class="badge badge--danger">${pending} ${pluralize(pending, "pendente", "pendentes")}</span>`;

    let deliveries = "";
    if (expanded) {
      if (total === 0) {
        deliveries = `<p class="muted text-sm">Nenhum professor atribuído. Edite a tarefa para adicionar responsáveis.</p>`;
      } else {
        deliveries = task.assignments
          .map((a) => {
            const teacher = teacherMap.get(a.teacherId);
            if (!teacher) return "";
            const sub = a.delivered && a.deliveredAt
              ? `Entregue em ${escapeHtml(formatDateTime(a.deliveredAt))}`
              : "Pendente";
            return `
              <div class="delivery ${a.delivered ? "delivery--done" : ""}">
                <div class="delivery__info">
                  <div class="delivery__name">${escapeHtml(teacher.name)}</div>
                  <div class="delivery__sub">${sub}</div>
                </div>
                <label class="switch">
                  <input type="checkbox" data-delivery="${task.id}|${a.teacherId}" ${a.delivered ? "checked" : ""} />
                  <span class="switch__track"></span>
                  <span>${a.delivered ? "Entregue" : "Marcar"}</span>
                </label>
              </div>`;
          }).join("");
      }
    }

    return `
      <div class="item" data-task-card="${task.id}">
        <div class="item__head">
          <div style="min-width:0">
            <h3 class="item__title">${escapeHtml(task.title)}</h3>
            <div class="item__meta">${typeBadge}${monthBadge}${dueBadge}${ruleBadge}${statusBadge}</div>
          </div>
          <div class="item__actions">
            <button class="btn-icon" title="Editar" data-edit-task="${task.id}">✏️</button>
            <button class="btn-icon btn-icon--danger" title="Excluir" data-del-task="${task.id}">🗑️</button>
          </div>
        </div>
        ${task.description ? `<div class="item__body text-sm">${escapeHtml(task.description)}</div>` : ""}
        <div class="flex between center wrap" style="margin-top:12px;gap:12px">
          <div class="grow" style="min-width:180px">
            <div class="text-sm muted">${delivered}/${total} ${pluralize(total, "entrega", "entregas")} (${pct}%)</div>
            <div class="progress"><div class="progress__bar" style="width:${pct}%"></div></div>
          </div>
          <div class="flex gap wrap">
            <button class="btn btn--ghost btn--sm" data-share-task="${task.id}">📲 Compartilhar</button>
            <button class="btn btn--ghost btn--sm" data-toggle-task="${task.id}">
              ${expanded ? "Ocultar" : "Marcar entregas"}
            </button>
          </div>
        </div>
        ${expanded ? `<div class="item__body">${deliveries}</div>` : ""}
      </div>`;
  }

  function bindTaskActions(teachers) {
    view.querySelectorAll("[data-new-task]").forEach((b) =>
      b.addEventListener("click", () => { if (!b.disabled) openTaskForm(null, teachers); }));
    view.querySelectorAll("[data-edit-task]").forEach((b) =>
      b.addEventListener("click", () => openTaskForm(b.getAttribute("data-edit-task"), teachers)));
    view.querySelectorAll("[data-del-task]").forEach((b) =>
      b.addEventListener("click", () => deleteTaskFlow(b.getAttribute("data-del-task"))));
    view.querySelectorAll("[data-toggle-task]").forEach((b) =>
      b.addEventListener("click", () => {
        const tid = b.getAttribute("data-toggle-task");
        if (expandedTasks.has(tid)) expandedTasks.delete(tid);
        else expandedTasks.add(tid);
        refreshTaskCard(tid, teachers);
      }));
    view.querySelectorAll("[data-share-task]").forEach((b) =>
      b.addEventListener("click", () => openShareModal(b.getAttribute("data-share-task"))));
    view.querySelectorAll("[data-delivery]").forEach((chk) =>
      chk.addEventListener("change", () => {
        const [taskId, teacherId] = chk.getAttribute("data-delivery").split("|");
        Store.setDelivery(taskId, teacherId, chk.checked);
        refreshTaskCard(taskId, teachers);
      }));
    const filter = view.querySelector("#taskMonthFilter");
    if (filter) filter.addEventListener("change", () => {
      tasksFilterMonth = filter.value;
      renderTasks();
    });
    bindGoButtons();
  }

  // Re-renderiza apenas um cartão de tarefa (mantém o resto da tela).
  function refreshTaskCard(taskId, teachers) {
    const card = view.querySelector(`[data-task-card="${taskId}"]`);
    const task = Store.getTask(taskId);
    if (!card || !task) { renderTasks(); return; }
    const tmp = document.createElement("div");
    tmp.innerHTML = renderTaskCard(task);
    const fresh = tmp.firstElementChild;
    card.replaceWith(fresh);
    // Re-vincula apenas os controles do cartão novo.
    rebindCard(fresh, teachers);
  }

  function rebindCard(card, teachers) {
    card.querySelectorAll("[data-edit-task]").forEach((b) =>
      b.addEventListener("click", () => openTaskForm(b.getAttribute("data-edit-task"), teachers)));
    card.querySelectorAll("[data-del-task]").forEach((b) =>
      b.addEventListener("click", () => deleteTaskFlow(b.getAttribute("data-del-task"))));
    card.querySelectorAll("[data-toggle-task]").forEach((b) =>
      b.addEventListener("click", () => {
        const tid = b.getAttribute("data-toggle-task");
        if (expandedTasks.has(tid)) expandedTasks.delete(tid);
        else expandedTasks.add(tid);
        refreshTaskCard(tid, teachers);
      }));
    card.querySelectorAll("[data-share-task]").forEach((b) =>
      b.addEventListener("click", () => openShareModal(b.getAttribute("data-share-task"))));
    card.querySelectorAll("[data-delivery]").forEach((chk) =>
      chk.addEventListener("change", () => {
        const [taskId, teacherId] = chk.getAttribute("data-delivery").split("|");
        Store.setDelivery(taskId, teacherId, chk.checked);
        refreshTaskCard(taskId, teachers);
      }));
  }

  function openTaskForm(id, teachers) {
    const task = id ? Store.getTask(id) : null;
    const selected = new Set(task ? task.assignments.map((a) => a.teacherId) : teachers.map((t) => t.id));
    const isMonthly = task ? task.type === "monthly" : true;
    const defaultMonth = (task && task.referenceMonth) || new Date().toISOString().slice(0, 7);

    const html = `
      <form id="taskForm">
        <div class="field">
          <label for="kTitle">Título *</label>
          <input class="input" id="kTitle" required maxlength="140"
                 value="${escapeHtml(task ? task.title : "")}" placeholder="Ex.: Diário de classe — entrega mensal" />
        </div>
        <div class="field">
          <label for="kDesc">Descrição (opcional)</label>
          <textarea class="textarea" id="kDesc" maxlength="600" placeholder="Detalhes da tarefa...">${escapeHtml(task ? task.description : "")}</textarea>
        </div>
        <div class="form-row">
          <div class="field">
            <label for="kType">Tipo</label>
            <select class="select" id="kType">
              <option value="monthly" ${isMonthly ? "selected" : ""}>Mensal (repete todo mês)</option>
              <option value="single" ${!isMonthly ? "selected" : ""}>Avulsa (uma vez)</option>
            </select>
          </div>
          <div class="field" id="monthField" ${isMonthly ? "" : 'style="display:none"'}>
            <label for="kMonth">Mês de referência</label>
            <input class="input" id="kMonth" type="month" value="${escapeHtml(defaultMonth)}" />
          </div>
          <div class="field">
            <label for="kDue">Data de entrega (opcional)</label>
            <input class="input" id="kDue" type="date" value="${escapeHtml(task ? task.dueDate : "")}" />
          </div>
        </div>
        <div class="field" id="firstFridayField" ${isMonthly ? "" : 'style="display:none"'}>
          <label class="checkbox-row">
            <input type="checkbox" id="kFirstFriday" ${task && task.dueRule === "firstFriday" ? "checked" : ""} />
            <span>Entrega sempre na <strong>sexta-feira da primeira semana do mês</strong> (a data é calculada automaticamente)</span>
          </label>
        </div>
        <div class="field">
          <div class="flex between center">
            <label class="mb-0">Professores responsáveis</label>
            <div class="flex gap">
              <button type="button" class="btn btn--ghost btn--sm" id="selAll">Todos</button>
              <button type="button" class="btn btn--ghost btn--sm" id="selNone">Nenhum</button>
            </div>
          </div>
          <div id="teacherChecks" style="margin-top:10px;display:flex;flex-direction:column;gap:8px;max-height:240px;overflow:auto">
            ${teachers.map((t) => `
              <label class="checkbox-row">
                <input type="checkbox" value="${t.id}" ${selected.has(t.id) ? "checked" : ""} />
                <span>${escapeHtml(t.name)}${t.subjects.length ? ` <span class="muted text-sm">— ${escapeHtml(t.subjects.join(", "))}</span>` : ""}</span>
              </label>`).join("")}
          </div>
          <div class="hint">Marque quem deve entregar esta tarefa.</div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn--ghost" data-close-modal>Cancelar</button>
          <button type="submit" class="btn">${id ? "Salvar alterações" : "Criar tarefa"}</button>
        </div>
      </form>`;

    openModal(id ? "Editar tarefa" : "Nova tarefa", html, (body) => {
      body.querySelector("[data-close-modal]").addEventListener("click", closeModal);
      const typeSel = body.querySelector("#kType");
      const monthField = body.querySelector("#monthField");
      const monthInput = body.querySelector("#kMonth");
      const dueInput = body.querySelector("#kDue");
      const fridayField = body.querySelector("#firstFridayField");
      const fridayChk = body.querySelector("#kFirstFriday");

      // Quando a regra "1ª sexta" está ativa, calcula a data e trava o campo.
      function applyFirstFriday() {
        if (typeSel.value === "monthly" && fridayChk.checked) {
          const d = Store.firstFridayOf(monthInput.value);
          if (d) dueInput.value = d;
          dueInput.readOnly = true;
          dueInput.style.opacity = "0.6";
        } else {
          dueInput.readOnly = false;
          dueInput.style.opacity = "";
        }
      }
      function syncType() {
        const monthly = typeSel.value === "monthly";
        monthField.style.display = monthly ? "" : "none";
        fridayField.style.display = monthly ? "" : "none";
        if (!monthly) fridayChk.checked = false;
        applyFirstFriday();
      }
      typeSel.addEventListener("change", syncType);
      fridayChk.addEventListener("change", applyFirstFriday);
      monthInput.addEventListener("change", applyFirstFriday);
      applyFirstFriday();

      const checks = () => Array.from(body.querySelectorAll('#teacherChecks input[type="checkbox"]'));
      body.querySelector("#selAll").addEventListener("click", () => checks().forEach((c) => (c.checked = true)));
      body.querySelector("#selNone").addEventListener("click", () => checks().forEach((c) => (c.checked = false)));

      body.querySelector("#taskForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const title = body.querySelector("#kTitle").value.trim();
        if (!title) { toast("Informe o título da tarefa.", "danger"); return; }
        const type = typeSel.value;
        const referenceMonth = body.querySelector("#kMonth").value;
        if (type === "monthly" && !referenceMonth) {
          toast("Informe o mês de referência.", "danger"); return;
        }
        const payload = {
          title,
          description: body.querySelector("#kDesc").value.trim(),
          type,
          referenceMonth,
          dueDate: body.querySelector("#kDue").value,
          dueRule: type === "monthly" && fridayChk.checked ? "firstFriday" : "",
          teacherIds: checks().filter((c) => c.checked).map((c) => c.value),
        };
        if (id) { Store.updateTask(id, payload); toast("Tarefa atualizada.", "success"); }
        else { Store.addTask(payload); toast("Tarefa criada.", "success"); }
        closeModal();
        renderTasks();
      });
    });
  }

  async function deleteTaskFlow(id) {
    const task = Store.getTask(id);
    if (!task) return;
    const ok = await confirmDialog({
      title: "Excluir tarefa",
      message: `Excluir a tarefa "${task.title}"? Os registros de entrega serão perdidos.`,
      confirmText: "Excluir",
      danger: true,
    });
    if (!ok) return;
    Store.deleteTask(id);
    expandedTasks.delete(id);
    toast("Tarefa excluída.", "success");
    renderTasks();
  }

  // ---------------------------------------------- Compartilhar (WhatsApp)
  // Saudação conforme o horário atual.
  function greetingNow() {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  }

  // Texto da data final de entrega da tarefa (ou referência mensal).
  function taskDueText(task) {
    if (task.dueDate) return { text: formatDate(task.dueDate), hasDate: true };
    if (task.type === "monthly" && task.referenceMonth) {
      return { text: formatMonth(task.referenceMonth).toLowerCase(), hasDate: false };
    }
    return { text: "", hasDate: false };
  }

  // Monta a mensagem profissional (sem emojis) para o WhatsApp.
  function buildShareMessage(task, teacherName) {
    const g = greetingNow();
    const who = teacherName ? teacherName.trim() : "professor(a)";
    const due = taskDueText(task);
    const lines = [];
    lines.push(`${g}, ${who}.`);
    lines.push("");
    if (due.hasDate) {
      lines.push(`Gostaria de lembrar sobre a entrega da tarefa "${task.title}", cujo prazo final é ${due.text}.`);
    } else if (due.text) {
      lines.push(`Gostaria de lembrar sobre a entrega da tarefa "${task.title}", referente ao mês de ${due.text}.`);
    } else {
      lines.push(`Gostaria de lembrar sobre a entrega da tarefa "${task.title}".`);
    }
    lines.push("");
    lines.push("Por gentileza, realize o envio dentro do prazo. Caso já tenha entregado, favor desconsiderar esta mensagem.");
    lines.push("");
    lines.push("Atenciosamente,");
    lines.push("Coordenação.");
    return lines.join("\n");
  }

  // Normaliza o telefone para o formato do WhatsApp (só dígitos, com DDI).
  function normalizeWhatsPhone(raw) {
    let d = String(raw || "").replace(/\D/g, "");
    if (!d) return "";
    if (d.length <= 11) d = "55" + d; // acrescenta o DDI do Brasil se veio só com DDD
    return d;
  }

  function waLink(phone, text) {
    const base = phone ? `https://wa.me/${phone}` : "https://wa.me/";
    return base + "?text=" + encodeURIComponent(text);
  }

  function openShareModal(taskId) {
    const task = Store.getTask(taskId);
    if (!task) return;
    const teacherMap = new Map(Store.getTeachers().map((t) => [t.id, t]));
    const assigned = task.assignments.map((a) => teacherMap.get(a.teacherId)).filter(Boolean);
    const genericMsg = buildShareMessage(task, "");

    let teacherRows;
    if (!assigned.length) {
      teacherRows = `<p class="muted text-sm">Nenhum professor atribuído a esta tarefa. Edite a tarefa para adicionar responsáveis.</p>`;
    } else {
      teacherRows = assigned.map((t) => {
        const phone = normalizeWhatsPhone(t.phone);
        if (phone) {
          const msg = buildShareMessage(task, t.name);
          return `
            <div class="delivery">
              <div class="delivery__info">
                <div class="delivery__name">${escapeHtml(t.name)}</div>
                <div class="delivery__sub">${escapeHtml(t.phone)}</div>
              </div>
              <a class="btn btn--sm" target="_blank" rel="noopener" href="${escapeHtml(waLink(phone, msg))}">Enviar</a>
            </div>`;
        }
        return `
          <div class="delivery">
            <div class="delivery__info">
              <div class="delivery__name">${escapeHtml(t.name)}</div>
              <div class="delivery__sub muted">Sem WhatsApp cadastrado</div>
            </div>
            <button class="btn btn--ghost btn--sm" data-add-phone="${t.id}">Adicionar</button>
          </div>`;
      }).join("");
    }

    const html = `
      <div class="field">
        <label for="shareMsg">Mensagem</label>
        <textarea class="textarea" id="shareMsg" rows="9">${escapeHtml(genericMsg)}</textarea>
        <div class="hint">A saudação muda conforme o horário (bom dia / boa tarde / boa noite). Você pode editar antes de enviar.</div>
      </div>
      <div class="flex gap wrap" style="margin-bottom:4px">
        <button class="btn btn--ghost" id="copyMsg" type="button">Copiar mensagem</button>
        <button class="btn" id="openWa" type="button">Abrir no WhatsApp</button>
      </div>
      <hr class="divider">
      <h3 class="mt-0" style="font-size:1rem">Enviar direto para cada professor</h3>
      <p class="muted text-sm mt-0">Cada mensagem é personalizada com o nome do professor.</p>
      <div class="list">${teacherRows}</div>`;

    openModal("Compartilhar tarefa no WhatsApp", html, (body) => {
      body.querySelector("#copyMsg").addEventListener("click", async () => {
        const ok = await UI.copyText(body.querySelector("#shareMsg").value);
        toast(ok ? "Mensagem copiada." : "Não foi possível copiar.", ok ? "success" : "danger");
      });
      body.querySelector("#openWa").addEventListener("click", () => {
        const text = body.querySelector("#shareMsg").value;
        global.open(waLink("", text), "_blank", "noopener");
      });
      body.querySelectorAll("[data-add-phone]").forEach((b) =>
        b.addEventListener("click", () => {
          const tid = b.getAttribute("data-add-phone");
          closeModal();
          navigate("professores");
          openTeacherForm(tid);
        }));
    });
  }

  // ======================================================================
  //  Relatórios
  // ======================================================================
  function renderReports() {
    const months = Store.getMonthsWithTasks();
    if (months.length === 0) {
      view.innerHTML = `
        <div class="section-head"><div><h2 class="mt-0 mb-0">Relatórios</h2>
          <p>Pendências de entrega por mês.</p></div></div>` +
        emptyCard("📄", "Nada para relatar ainda",
          "Crie tarefas e atribua professores para gerar relatórios de pendências.",
          `<button class="btn" data-go="tarefas">Ir para tarefas</button>`);
      bindGoButtons();
      return;
    }

    if (!reportsMonth || !months.includes(reportsMonth)) {
      const current = new Date().toISOString().slice(0, 7);
      reportsMonth = months.includes(current) ? current : months[0];
    }
    const report = Store.getMonthlyReport(reportsMonth);

    let html = `
      <div class="section-head no-print">
        <div>
          <h2 class="mt-0 mb-0">Relatórios</h2>
          <p>Professores que não entregaram as tarefas do mês.</p>
        </div>
        <div class="flex gap wrap">
          <select class="select" id="reportMonth" style="max-width:220px">
            ${months.map((m) => `<option value="${m}" ${m === reportsMonth ? "selected" : ""}>${escapeHtml(formatMonth(m))}</option>`).join("")}
          </select>
          <button class="btn btn--ghost btn--sm" id="printReport">🖨️ Imprimir / PDF</button>
          <button class="btn btn--ghost btn--sm" id="csvReport">⬇️ CSV</button>
        </div>
      </div>

      <div class="card">
        <div class="card__body">
          <h2 class="mt-0">Relatório de ${escapeHtml(formatMonth(reportsMonth))}</h2>
          <p class="muted text-sm">
            ${report.totalTasks} ${pluralize(report.totalTasks, "tarefa", "tarefas")} no mês •
            ${report.pendingTeachers.length} ${pluralize(report.pendingTeachers.length, "professor com pendência", "professores com pendência")}
          </p>`;

    // Lista consolidada de professores com pendência.
    if (report.pendingTeachers.length === 0) {
      html += `<div class="badge badge--success" style="font-size:.95rem;padding:10px 16px;">
        ✓ Todos os professores entregaram as tarefas de ${escapeHtml(formatMonth(reportsMonth))}.</div>`;
    } else {
      html += `<h3>Professores com entregas pendentes</h3>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Professor</th><th>E-mail</th><th>Tarefas não entregues</th></tr></thead>
          <tbody>`;
      report.pendingTeachers.forEach((p) => {
        html += `<tr>
          <td><strong>${escapeHtml(p.teacher.name)}</strong></td>
          <td>${escapeHtml(p.teacher.email || "—")}</td>
          <td>${p.tasks.map((t) => escapeHtml(t)).join("<br>")}</td>
        </tr>`;
      });
      html += `</tbody></table></div>`;
    }
    html += `</div></div>`;

    // Detalhamento por tarefa.
    html += `<div class="card"><div class="card__body">
      <h2 class="mt-0">Detalhamento por tarefa</h2>`;
    if (report.tasks.length === 0) {
      html += `<p class="muted mb-0">Nenhuma tarefa neste mês.</p>`;
    } else {
      report.tasks.forEach((tr) => {
        const statusBadge = tr.total === 0
          ? `<span class="badge badge--muted">Sem responsáveis</span>`
          : tr.pendingCount === 0
            ? `<span class="badge badge--success">✓ Completa</span>`
            : `<span class="badge badge--danger">${tr.pendingCount} ${pluralize(tr.pendingCount, "pendente", "pendentes")}</span>`;
        html += `
          <div style="margin-bottom:18px">
            <div class="flex between center wrap" style="gap:8px">
              <h3 class="mb-0">${escapeHtml(tr.task.title)}</h3>
              ${statusBadge}
            </div>
            <div class="text-sm muted" style="margin:4px 0 8px">
              ${tr.task.type === "monthly" ? "Mensal" : "Avulsa"}
              ${tr.task.dueDate ? " • Entrega: " + escapeHtml(formatDate(tr.task.dueDate)) : ""}
              • ${tr.deliveredCount}/${tr.total} entregaram
            </div>
            ${tr.pendingCount > 0
              ? `<div class="text-sm"><strong>Não entregaram:</strong> ${tr.pending.map((p) => escapeHtml(p.teacher.name)).join(", ")}</div>`
              : tr.total > 0 ? `<div class="text-sm muted">Todos entregaram.</div>` : ""}
          </div>`;
      });
    }
    html += `</div></div>`;

    view.innerHTML = html;
    view.querySelector("#reportMonth").addEventListener("change", (e) => {
      reportsMonth = e.target.value;
      renderReports();
    });
    view.querySelector("#printReport").addEventListener("click", () => global.print());
    view.querySelector("#csvReport").addEventListener("click", () => exportReportCsv(report));
    bindGoButtons();
  }

  function exportReportCsv(report) {
    const rows = [["Professor", "E-mail", "Tarefa nao entregue", "Mes de referencia"]];
    report.pendingTeachers.forEach((p) => {
      p.tasks.forEach((task) => {
        rows.push([p.teacher.name, p.teacher.email || "", task, formatMonth(report.month)]);
      });
    });
    if (rows.length === 1) rows.push(["(nenhuma pendencia)", "", "", formatMonth(report.month)]);
    const csv = rows.map((r) => r.map(csvCell).join(";")).join("\r\n");
    // BOM (﻿) garante acentuação correta ao abrir no Excel.
    deliverFile(`pendencias-${report.month}.csv`, "﻿" + csv, "text/csv;charset=utf-8", "CSV");
  }

  function csvCell(value) {
    const s = String(value == null ? "" : value);
    return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  // ======================================================================
  //  Observação de Aula
  // ======================================================================
  function renderObservations() {
    if (editingObsId) renderObsForm();
    else renderObsList();
  }

  function markSummary(o) {
    const c = { sim: 0, nao: 0, na: 0, vazio: 0 };
    (o.criterios || []).forEach((x) => {
      if (x.mark === "sim") c.sim++;
      else if (x.mark === "nao") c.nao++;
      else if (x.mark === "na") c.na++;
      else c.vazio++;
    });
    return c;
  }

  function renderObsList() {
    view.scrollTop = 0;
    const observations = Store.getObservations();
    let html = `
      <div class="section-head">
        <div>
          <h2 class="mt-0 mb-0">Observação de Aula</h2>
          <p>Assista à aula, preencha o protocolo e exporte no template oficial (.docx).</p>
        </div>
        <button class="btn" data-new-obs>+ Nova observação</button>
      </div>`;

    if (!observations.length) {
      html += emptyCard("👁️", "Nenhuma observação registrada",
        "Registre a observação de uma aula e exporte o documento .docx no mesmo template do modelo oficial.",
        `<button class="btn" data-new-obs>Nova observação</button>`);
      view.innerHTML = html;
      bindObsListActions();
      return;
    }

    html += `<div class="list">`;
    observations.forEach((o) => {
      const s = markSummary(o);
      const meta = [
        o.disciplina,
        o.serieTurma,
        (formatDate(o.dataObservacao) || "") + (o.horario ? ` (${o.horario})` : ""),
      ].filter((x) => x && x.trim());
      html += `
        <div class="item">
          <div class="item__head">
            <div style="min-width:0">
              <h3 class="item__title">${escapeHtml(o.professor || "(sem professor)")}</h3>
              <div class="item__meta">${meta.map((m) => `<span>${escapeHtml(m)}</span>`).join("")}</div>
            </div>
            <div class="item__actions">
              <button class="btn-icon" title="Editar" data-edit-obs="${o.id}">✏️</button>
              <button class="btn-icon btn-icon--danger" title="Excluir" data-del-obs="${o.id}">🗑️</button>
            </div>
          </div>
          <div class="item__body flex gap wrap center">
            <span class="badge badge--success">Sim: ${s.sim}</span>
            <span class="badge badge--danger">Não: ${s.nao}</span>
            <span class="badge badge--muted">N/D: ${s.na}</span>
            ${s.vazio ? `<span class="badge badge--pending">Em branco: ${s.vazio}</span>` : ""}
            <span class="grow"></span>
            <button class="btn btn--sm" data-export-obs="${o.id}">⬇️ Exportar .docx</button>
          </div>
        </div>`;
    });
    html += `</div>`;
    view.innerHTML = html;
    bindObsListActions();
  }

  function bindObsListActions() {
    view.querySelectorAll("[data-new-obs]").forEach((b) =>
      b.addEventListener("click", () => { editingObsId = "new"; renderObservations(); }));
    view.querySelectorAll("[data-edit-obs]").forEach((b) =>
      b.addEventListener("click", () => { editingObsId = b.getAttribute("data-edit-obs"); renderObservations(); }));
    view.querySelectorAll("[data-del-obs]").forEach((b) =>
      b.addEventListener("click", () => deleteObservationFlow(b.getAttribute("data-del-obs"))));
    view.querySelectorAll("[data-export-obs]").forEach((b) =>
      b.addEventListener("click", () => exportObservationDocx(b.getAttribute("data-export-obs"))));
  }

  function renderObsForm() {
    view.scrollTop = 0;
    const isNew = editingObsId === "new";
    const obs = isNew ? Store.newObservationDraft() : Store.getObservation(editingObsId);
    if (!obs) { editingObsId = null; renderObsList(); return; }
    pageTitle.textContent = isNew ? "Nova observação" : "Editar observação";

    const teachers = Store.getTeachers();
    const allSubjects = Array.from(new Set(teachers.flatMap((t) => t.subjects || [])))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
    const CRITERIA = DocxExport.CRITERIA;
    const GUIDANCE = DocxExport.GUIDANCE;

    const teacherOpts = `<option value="">— Selecione um cadastrado —</option>` +
      teachers.map((t) => `<option value="${t.id}" ${obs.teacherId === t.id ? "selected" : ""}>${escapeHtml(t.name)}</option>`).join("") +
      `<option value="__manual__">Outro (digitar manualmente)</option>`;

    const critBlocks = CRITERIA.map((text, i) => {
      const d = obs.criterios[i] || { mark: "", evidencias: "" };
      const lab = (val, cls, label) =>
        `<label class="radio radio--${cls}${d.mark === val ? " radio--on" : ""}">
           <input type="radio" name="crit-${i}" value="${val}" ${d.mark === val ? "checked" : ""}><span>${label}</span>
         </label>`;
      return `
        <div class="obs-crit" data-crit="${i}">
          <div class="obs-crit__text">${i + 1}. ${escapeHtml(text)}</div>
          <div class="obs-crit__marks">
            ${lab("sim", "sim", "Sim")}
            ${lab("nao", "nao", "Não")}
            ${lab("na", "na", "Não foi possível observar")}
            <button type="button" class="linklike" data-clear-crit="${i}">limpar</button>
          </div>
          <textarea class="textarea" id="ev-${i}" rows="2" placeholder="${escapeHtml(GUIDANCE[i] || "Indicadores / evidências…")}">${escapeHtml(d.evidencias)}</textarea>
        </div>`;
    }).join("");

    const field = (id, label, value, type, ph) =>
      `<div class="field"><label for="${id}">${label}</label>
        <input class="input" id="${id}" ${type ? `type="${type}"` : ""} value="${escapeHtml(value || "")}" ${ph ? `placeholder="${escapeHtml(ph)}"` : ""}/></div>`;

    view.innerHTML = `
      <div class="section-head no-print">
        <div>
          <h2 class="mt-0 mb-0">${isNew ? "Nova observação de aula" : "Editar observação"}</h2>
          <p>Preencha o protocolo. Ao final, exporte no template oficial (.docx).</p>
        </div>
        <button class="btn btn--ghost btn--sm" data-cancel-obs>← Voltar</button>
      </div>

      <div class="card"><div class="card__body">
        <h2 class="mt-0">1. Identificação</h2>
        <div class="form-row">
          <div class="field">
            <label for="obsTeacher">Professor(a) observado(a)</label>
            <select class="select" id="obsTeacher">${teacherOpts}</select>
            <div class="hint">Escolha um cadastrado (preenche o nome) ou digite ao lado.</div>
          </div>
          ${field("obsProfessor", "Nome do professor(a) *", obs.professor, "", "Ex.: Maria Silva")}
        </div>
        <div class="form-row">
          <div class="field">
            <label for="obsDisciplina">Disciplina</label>
            <input class="input" id="obsDisciplina" list="discList" value="${escapeHtml(obs.disciplina || "")}" placeholder="Ex.: Desenvolvimento Web"/>
            <datalist id="discList">${allSubjects.map((s) => `<option value="${escapeHtml(s)}"></option>`).join("")}</datalist>
          </div>
          ${field("obsSerie", "Série/Turma", obs.serieTurma, "", "Ex.: 2º Ano — Turma B")}
        </div>
        <div class="form-row">
          ${field("obsData", "Data da observação *", obs.dataObservacao, "date")}
          ${field("obsHorario", "Horário", obs.horario, "", "Ex.: 15h-15h50")}
        </div>
        <details class="obs-advanced">
          <summary>Dados do cabeçalho (escola, etapa, modalidade…)</summary>
          ${field("hdrEscola", "Escola", obs.escola)}
          <div class="form-row">
            ${field("hdrEtapa", "Etapa", obs.etapa)}
            ${field("hdrTurno", "Turno", obs.turno, "", "Ex.: Vespertino")}
          </div>
          ${field("hdrModalidade", "Modalidade", obs.modalidade)}
          ${field("hdrArea", "Área de Conhecimento / Área Técnica", obs.area)}
          <div class="form-row">
            ${field("hdrCoordPed", "Coordenadora Pedagógica", obs.coordenadoraPedagogica)}
            ${field("hdrCoordArea", "Coord. de Área / Curso Técnico", obs.coordenadorArea)}
          </div>
          <div class="hint">Estes dados são lembrados para as próximas observações.</div>
        </details>
      </div></div>

      <div class="card"><div class="card__body">
        <h2 class="mt-0">2. Protocolo de Observação</h2>
        <p class="muted text-sm">Para cada critério, marque <strong>Sim / Não / Não foi possível observar</strong> e registre as evidências.</p>
        ${critBlocks}
        <div class="field" style="margin-top:16px">
          <label for="obsObservacoes">Observações gerais</label>
          <textarea class="textarea" id="obsObservacoes" rows="3" placeholder="Registros gerais da aula…">${escapeHtml(obs.observacoes || "")}</textarea>
        </div>
      </div></div>

      <div class="card"><div class="card__body">
        <h2 class="mt-0">3. Protocolo do Feedback</h2>
        <div class="field">
          <label for="obsRegistro">Registro de Evidências</label>
          <textarea class="textarea" id="obsRegistro" rows="3">${escapeHtml(obs.registroEvidencias || "")}</textarea>
        </div>
        <div class="field">
          <label for="obsSugestoes">Sugestões/Orientações</label>
          <textarea class="textarea" id="obsSugestoes" rows="4" placeholder="${escapeHtml(DocxExport.FEEDBACK_HINTS)}">${escapeHtml(obs.sugestoes || "")}</textarea>
        </div>
        <div class="field" style="max-width:260px">
          <label for="obsDataFeedback">Data do Feedback</label>
          <input class="input" type="date" id="obsDataFeedback" value="${escapeHtml(obs.dataFeedback || "")}"/>
        </div>
        <hr class="divider">
        <h3 class="mt-0">Assinaturas (opcional)</h3>
        <p class="muted text-sm">Os nomes aparecem acima da linha de assinatura no documento exportado.</p>
        <div class="form-row">
          ${field("sigRegente", "Professor(a) Regente", (obs.assinaturas || {}).regente)}
          ${field("sigCoordArea", "Coord. de Área / Curso Técnico", (obs.assinaturas || {}).coordenadorArea)}
        </div>
        <div class="form-row">
          ${field("sigPedagoga", "Pedagoga", (obs.assinaturas || {}).pedagoga)}
          ${field("sigCoordPed", "Coordenadora Pedagógica", (obs.assinaturas || {}).coordenadoraPedagogica)}
        </div>
      </div></div>

      <div class="card"><div class="card__body flex gap wrap between center">
        <button class="btn btn--ghost" data-cancel-obs>← Voltar sem salvar</button>
        <div class="flex gap wrap">
          <button class="btn btn--ghost" data-save-obs>Salvar</button>
          <button class="btn" data-save-export-obs>💾 Salvar e exportar .docx</button>
        </div>
      </div></div>`;

    bindObsForm(teachers, allSubjects);
  }

  function bindObsForm(teachers, allSubjects) {
    const teacherSel = view.querySelector("#obsTeacher");
    teacherSel.addEventListener("change", () => {
      const t = teachers.find((x) => x.id === teacherSel.value);
      if (t) view.querySelector("#obsProfessor").value = t.name;
      const dl = view.querySelector("#discList");
      const subs = t && t.subjects && t.subjects.length ? t.subjects : allSubjects;
      dl.innerHTML = subs.map((s) => `<option value="${escapeHtml(s)}"></option>`).join("");
    });

    view.querySelectorAll("[data-crit]").forEach((block) => {
      const i = block.getAttribute("data-crit");
      block.querySelectorAll(`input[name="crit-${i}"]`).forEach((radio) =>
        radio.addEventListener("change", () => updateCritLabels(block)));
      const clr = block.querySelector("[data-clear-crit]");
      clr.addEventListener("click", () => {
        block.querySelectorAll(`input[name="crit-${i}"]`).forEach((r) => (r.checked = false));
        updateCritLabels(block);
      });
    });

    view.querySelectorAll("[data-cancel-obs]").forEach((b) =>
      b.addEventListener("click", () => { editingObsId = null; renderObservations(); }));
    view.querySelector("[data-save-obs]").addEventListener("click", () => saveObservation(false));
    view.querySelector("[data-save-export-obs]").addEventListener("click", () => saveObservation(true));
  }

  function updateCritLabels(block) {
    block.querySelectorAll(".radio").forEach((label) => {
      const input = label.querySelector("input");
      label.classList.toggle("radio--on", !!(input && input.checked));
    });
  }

  function collectObsPayload() {
    const val = (id) => { const el = view.querySelector("#" + id); return el ? el.value : ""; };
    const teacherSel = view.querySelector("#obsTeacher");
    const teacherId = teacherSel && /^t_/.test(teacherSel.value) ? teacherSel.value : "";
    const criterios = [];
    for (let i = 0; i < DocxExport.CRITERIA.length; i++) {
      const checked = view.querySelector(`input[name="crit-${i}"]:checked`);
      criterios.push({ mark: checked ? checked.value : "", evidencias: val("ev-" + i) });
    }
    return {
      teacherId,
      professor: val("obsProfessor"),
      disciplina: val("obsDisciplina"),
      serieTurma: val("obsSerie"),
      dataObservacao: val("obsData"),
      horario: val("obsHorario"),
      escola: val("hdrEscola"),
      etapa: val("hdrEtapa"),
      modalidade: val("hdrModalidade"),
      turno: val("hdrTurno"),
      area: val("hdrArea"),
      coordenadoraPedagogica: val("hdrCoordPed"),
      coordenadorArea: val("hdrCoordArea"),
      criterios,
      observacoes: val("obsObservacoes"),
      registroEvidencias: val("obsRegistro"),
      sugestoes: val("obsSugestoes"),
      dataFeedback: val("obsDataFeedback"),
      assinaturas: {
        regente: val("sigRegente"),
        coordenadorArea: val("sigCoordArea"),
        pedagoga: val("sigPedagoga"),
        coordenadoraPedagogica: val("sigCoordPed"),
      },
    };
  }

  function saveObservation(exportAfter) {
    const payload = collectObsPayload();
    if (!payload.professor.trim()) { toast("Informe o nome do professor(a).", "danger"); return; }
    if (!payload.dataObservacao) { toast("Informe a data da observação.", "danger"); return; }
    let saved;
    if (editingObsId && editingObsId !== "new") saved = Store.updateObservation(editingObsId, payload);
    else saved = Store.addObservation(payload);
    if (!saved) { toast("Não foi possível salvar.", "danger"); return; }
    toast("Observação salva.", "success");
    if (exportAfter) exportObservationDocx(saved.id);
    editingObsId = null;
    renderObservations();
  }

  async function deleteObservationFlow(id) {
    const obs = Store.getObservation(id);
    if (!obs) return;
    const ok = await confirmDialog({
      title: "Excluir observação",
      message: `Excluir a observação de "${obs.professor || "(sem professor)"}"${obs.dataObservacao ? " de " + formatDate(obs.dataObservacao) : ""}? Esta ação não pode ser desfeita.`,
      confirmText: "Excluir",
      danger: true,
    });
    if (!ok) return;
    Store.deleteObservation(id);
    toast("Observação excluída.", "success");
    renderObservations();
  }

  function obsSlug(s) {
    return String(s || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "")
      .toLowerCase().slice(0, 40) || "professor";
  }

  function obsFilename(obs) {
    return `observacao-aula-${obsSlug(obs.professor)}-${obs.dataObservacao || "sem-data"}.docx`;
  }

  function exportObservationDocx(id) {
    const obs = Store.getObservation(id);
    if (!obs) { toast("Observação não encontrada.", "danger"); return; }
    if (typeof DocxExport === "undefined" || !DocxExport.buildDocx) {
      toast("Módulo de exportação indisponível.", "danger");
      return;
    }
    const lh = global.LETTERHEAD_JPEG_BASE64
      ? { base64: global.LETTERHEAD_JPEG_BASE64, w: global.LETTERHEAD_JPEG_W || 726, h: global.LETTERHEAD_JPEG_H || 144 }
      : null;
    try {
      const bytes = DocxExport.buildDocx(obs, { letterhead: lh });
      deliverFile(
        obsFilename(obs),
        bytes,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Documento .docx"
      );
    } catch (err) {
      console.error("Falha ao gerar .docx:", err);
      toast("Falha ao gerar o documento .docx.", "danger");
    }
  }

  // ======================================================================
  //  Backup e dados
  // ======================================================================
  function renderBackup() {
    const s = Store.getStats();
    const settings = Store.getSettings();
    view.innerHTML = `
      <div class="section-head">
        <div>
          <h2 class="mt-0 mb-0">Backup e dados</h2>
          <p>Seus dados ficam salvos apenas neste navegador. Faça backups periódicos.</p>
        </div>
      </div>

      <div class="card"><div class="card__body">
        <h3 class="mt-0">⚠️ Importante</h3>
        <p class="text-sm">
          Este aplicativo é 100% gratuito e funciona sem internet. Os dados são gravados
          no armazenamento local deste dispositivo/navegador. Se você limpar os dados do
          navegador, trocar de aparelho ou reinstalar, <strong>perderá as informações</strong>.
          Por isso, exporte um arquivo de backup com frequência.
        </p>
        <p class="text-sm muted mb-0">
          Atualmente: ${s.teachers} ${pluralize(s.teachers, "professor", "professores")},
          ${s.tasks} ${pluralize(s.tasks, "tarefa", "tarefas")},
          ${s.observations} ${pluralize(s.observations, "observação", "observações")}.
        </p>
      </div></div>

      <div class="card"><div class="card__body">
        <h3 class="mt-0">Exportar (backup)</h3>
        <p class="text-sm">Baixe um arquivo <code>.json</code> com todos os dados.</p>
        <button class="btn" id="btnExport">⬇️ Exportar backup</button>
      </div></div>

      <div class="card"><div class="card__body">
        <h3 class="mt-0">Importar (restaurar)</h3>
        <p class="text-sm">Carregue um arquivo de backup. Você pode substituir tudo ou mesclar.</p>
        <div class="field">
          <input class="input" type="file" id="fileImport" accept="application/json,.json" />
        </div>
        <label class="checkbox-row" style="margin-bottom:14px">
          <input type="checkbox" id="mergeImport" />
          <span>Mesclar com os dados atuais (em vez de substituir)</span>
        </label>
        <button class="btn" id="btnImport">⬆️ Importar</button>
      </div></div>

      <div class="card"><div class="card__body">
        <h3 class="mt-0">☁️ Google Drive (opcional)</h3>
        <p class="text-sm">
          Envie automaticamente as exportações (.docx, CSV e backup) para o seu Google Drive.
          O app usa o acesso <strong>mínimo</strong> (<code>drive.file</code>): só vê os arquivos
          que ele mesmo cria — nunca o resto do seu Drive.
        </p>
        ${driveProtocolWarning()}
        <div class="field">
          <label for="driveClientId">Client ID do OAuth (Google Cloud)</label>
          <input class="input" id="driveClientId" placeholder="000000-xxxx.apps.googleusercontent.com"
                 value="${escapeHtml(settings.googleClientId || "")}" />
          <div class="hint">Como obter: veja o passo a passo no README (seção Google Drive).</div>
        </div>
        <div class="form-row">
          <div class="field">
            <label for="driveFolder">Pasta no Drive</label>
            <input class="input" id="driveFolder" value="${escapeHtml(settings.driveFolder || "Gerência Prof")}" />
          </div>
        </div>
        <label class="checkbox-row" style="margin-bottom:10px">
          <input type="checkbox" id="driveEnabled" ${settings.driveEnabled ? "checked" : ""} />
          <span>Enviar as exportações para o Google Drive</span>
        </label>
        <label class="checkbox-row" style="margin-bottom:14px">
          <input type="checkbox" id="driveKeepLocal" ${settings.driveKeepLocal ? "checked" : ""} />
          <span>Também manter uma cópia local (download)</span>
        </label>
        <div class="flex gap wrap">
          <button class="btn btn--ghost" id="driveSave">Salvar configuração</button>
          <button class="btn" id="driveConnect">Conectar / testar</button>
        </div>
        <p class="text-sm ${settings.driveEnabled ? "" : "muted"}" id="driveStatus" style="margin-bottom:0;margin-top:12px">
          ${settings.driveEnabled ? "Envio ao Drive ativado. Use \"Conectar / testar\" para autorizar." : "Envio ao Drive desativado."}
        </p>
      </div></div>

      <div class="card"><div class="card__body">
        <h3 class="mt-0">Outras ações</h3>
        <div class="flex gap wrap">
          <button class="btn btn--ghost" id="btnSample">Carregar dados de exemplo</button>
          <button class="btn btn--danger" id="btnClear">Apagar todos os dados</button>
        </div>
      </div></div>`;

    view.querySelector("#btnExport").addEventListener("click", () => {
      const stamp = new Date().toISOString().slice(0, 10);
      deliverFile(`gerencia-prof-backup-${stamp}.json`, Store.exportData(), "application/json", "Backup");
    });

    view.querySelector("#btnImport").addEventListener("click", () => {
      const fileInput = view.querySelector("#fileImport");
      const merge = view.querySelector("#mergeImport").checked;
      const file = fileInput.files && fileInput.files[0];
      if (!file) { toast("Selecione um arquivo de backup.", "danger"); return; }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          Store.importData(reader.result, { merge });
          toast("Dados importados com sucesso.", "success");
          navigate("painel");
        } catch (err) {
          toast(err.message || "Falha ao importar.", "danger");
        }
      };
      reader.onerror = () => toast("Não foi possível ler o arquivo.", "danger");
      reader.readAsText(file);
    });

    view.querySelector("#btnSample").addEventListener("click", async () => {
      const ok = await confirmDialog({
        title: "Carregar dados de exemplo",
        message: "Isto substituirá os dados atuais por um conjunto de demonstração. Continuar?",
        confirmText: "Carregar exemplo",
        danger: true,
      });
      if (!ok) return;
      Store.loadSampleData();
      toast("Dados de exemplo carregados.", "success");
      navigate("painel");
    });

    view.querySelector("#btnClear").addEventListener("click", async () => {
      const ok = await confirmDialog({
        title: "Apagar todos os dados",
        message: "Todos os professores e tarefas serão apagados deste dispositivo. Esta ação não pode ser desfeita. Tem certeza?",
        confirmText: "Apagar tudo",
        danger: true,
      });
      if (!ok) return;
      Store.clearAll();
      toast("Todos os dados foram apagados.", "success");
      navigate("painel");
    });

    // --- Google Drive ---
    function readDriveFields() {
      return {
        googleClientId: view.querySelector("#driveClientId").value.trim(),
        driveFolder: view.querySelector("#driveFolder").value.trim() || "Gerência Prof",
        driveEnabled: view.querySelector("#driveEnabled").checked,
        driveKeepLocal: view.querySelector("#driveKeepLocal").checked,
      };
    }
    const driveStatus = view.querySelector("#driveStatus");

    view.querySelector("#driveSave").addEventListener("click", () => {
      Store.setSettings(readDriveFields());
      toast("Configuração do Drive salva.", "success");
    });

    view.querySelector("#driveConnect").addEventListener("click", async () => {
      const cfg = Store.setSettings(readDriveFields()); // salva antes de conectar
      if (!cfg.googleClientId) { toast("Informe o Client ID do OAuth.", "danger"); return; }
      if (typeof DriveSync === "undefined") { toast("Módulo do Drive indisponível.", "danger"); return; }
      if (!DriveSync.isSupported()) {
        toast("Abra o app por http/https (localhost ou site) para usar o Drive.", "danger");
        return;
      }
      driveStatus.textContent = "Conectando ao Google…";
      driveStatus.classList.remove("muted");
      try {
        await DriveSync.connect();
        driveStatus.textContent = "Conectado ao Google Drive com sucesso. As exportações irão para a pasta \"" + cfg.driveFolder + "\".";
        toast("Conectado ao Google Drive.", "success");
      } catch (err) {
        console.error(err);
        driveStatus.textContent = "Falha ao conectar: " + (err && err.message ? err.message : "erro desconhecido");
        toast("Falha ao conectar ao Drive.", "danger");
      }
    });
  }

  // Aviso quando o app está em file:// (Drive exige http/https).
  function driveProtocolWarning() {
    if (typeof DriveSync !== "undefined" && DriveSync.isSupported()) return "";
    return `<p class="text-sm" style="color:var(--warning)">
      ⚠️ Para usar o Google Drive, abra o app por <strong>http/https</strong>
      (ex.: <code>npm start</code> ou GitHub Pages). Não funciona abrindo o arquivo direto (file://).
    </p>`;
  }

  // ======================================================================
  //  Entrega de arquivos (Google Drive ou download local)
  // ======================================================================
  // Envia ao Google Drive quando habilitado; senão (ou em caso de falha)
  // baixa localmente. content = string ou Uint8Array.
  function deliverFile(filename, content, mime, label) {
    label = label || "Arquivo";
    const drive = typeof DriveSync !== "undefined" ? DriveSync : null;
    if (drive && drive.isEnabled()) {
      toast("Enviando para o Google Drive…");
      drive.upload(filename, content, mime)
        .then(() => {
          toast(label + " enviado ao Google Drive.", "success");
          if (Store.getSettings().driveKeepLocal) downloadFile(filename, content, mime);
        })
        .catch((err) => {
          console.error("Falha no envio ao Drive:", err);
          toast("Falha ao enviar ao Drive — baixando localmente.", "danger");
          downloadFile(filename, content, mime);
        });
      return;
    }
    downloadFile(filename, content, mime);
    toast(label + " gerado.", "success");
  }

  // ======================================================================
  //  Componentes auxiliares
  // ======================================================================
  function emptyCard(icon, title, text, actionHtml) {
    return `
      <div class="card"><div class="card__body">
        <div class="empty">
          <div class="empty__icon">${icon}</div>
          <h3 class="mb-0">${escapeHtml(title)}</h3>
          <p>${escapeHtml(text)}</p>
          ${actionHtml || ""}
        </div>
      </div></div>`;
  }

  function bindGoButtons() {
    view.querySelectorAll("[data-go]").forEach((b) =>
      b.addEventListener("click", () => navigate(b.getAttribute("data-go"))));
  }

  // ======================================================================
  //  Menu lateral (mobile)
  // ======================================================================
  function openSidebar() { document.getElementById("sidebar").classList.add("open"); }
  function closeSidebar() { document.getElementById("sidebar").classList.remove("open"); }

  function initSidebar() {
    const toggle = document.getElementById("menuToggle");
    if (toggle) toggle.addEventListener("click", () => {
      document.getElementById("sidebar").classList.toggle("open");
    });
    // Fecha ao clicar fora no modo mobile.
    document.addEventListener("click", (e) => {
      const sidebar = document.getElementById("sidebar");
      if (!sidebar.classList.contains("open")) return;
      if (sidebar.contains(e.target) || e.target.id === "menuToggle") return;
      closeSidebar();
    });
  }

  // ======================================================================
  //  Inicialização
  // ======================================================================
  function init() {
    UI.initModalDismissal();
    initSidebar();
    global.addEventListener("hashchange", router);
    if (!location.hash) location.hash = "#/painel";
    else router();

    // Registra o service worker (funciona quando servido via http/https).
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      global.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").catch(() => { /* offline opcional */ });
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);
