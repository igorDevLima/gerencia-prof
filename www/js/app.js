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
    relatorios: { title: "Relatórios", render: renderReports },
    backup: { title: "Backup e dados", render: renderBackup },
  };

  // Estado de interface que sobrevive a re-renders da tela de tarefas.
  const expandedTasks = new Set();
  let tasksFilterMonth = "";
  let reportsMonth = "";

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
              ${t.email ? `<div class="item__meta"><span>✉️ ${escapeHtml(t.email)}</span></div>` : ""}
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
        <div class="field">
          <label for="tEmail">E-mail (opcional)</label>
          <input class="input" id="tEmail" type="email" maxlength="160"
                 value="${escapeHtml(teacher ? teacher.email : "")}" placeholder="maria@escola.edu" />
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
        const payload = { name, email, subjects };
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
            <div class="item__meta">${typeBadge}${monthBadge}${dueBadge}${statusBadge}</div>
          </div>
          <div class="item__actions">
            <button class="btn-icon" title="Editar" data-edit-task="${task.id}">✏️</button>
            <button class="btn-icon btn-icon--danger" title="Excluir" data-del-task="${task.id}">🗑️</button>
          </div>
        </div>
        ${task.description ? `<div class="item__body text-sm">${escapeHtml(task.description)}</div>` : ""}
        <div class="flex between center" style="margin-top:12px;gap:12px">
          <div class="grow">
            <div class="text-sm muted">${delivered}/${total} ${pluralize(total, "entrega", "entregas")} (${pct}%)</div>
            <div class="progress"><div class="progress__bar" style="width:${pct}%"></div></div>
          </div>
          <button class="btn btn--ghost btn--sm" data-toggle-task="${task.id}">
            ${expanded ? "Ocultar" : "Marcar entregas"}
          </button>
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
      typeSel.addEventListener("change", () => {
        monthField.style.display = typeSel.value === "monthly" ? "" : "none";
      });
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
    downloadFile(`pendencias-${report.month}.csv`, "﻿" + csv, "text/csv;charset=utf-8");
    toast("CSV exportado.", "success");
  }

  function csvCell(value) {
    const s = String(value == null ? "" : value);
    return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  // ======================================================================
  //  Backup e dados
  // ======================================================================
  function renderBackup() {
    const s = Store.getStats();
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
          ${s.tasks} ${pluralize(s.tasks, "tarefa", "tarefas")}.
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
        <h3 class="mt-0">Outras ações</h3>
        <div class="flex gap wrap">
          <button class="btn btn--ghost" id="btnSample">Carregar dados de exemplo</button>
          <button class="btn btn--danger" id="btnClear">Apagar todos os dados</button>
        </div>
      </div></div>`;

    view.querySelector("#btnExport").addEventListener("click", () => {
      const stamp = new Date().toISOString().slice(0, 10);
      downloadFile(`gerencia-prof-backup-${stamp}.json`, Store.exportData(), "application/json");
      toast("Backup exportado.", "success");
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
