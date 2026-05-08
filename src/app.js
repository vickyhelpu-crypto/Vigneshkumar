const STORAGE_KEYS = {
  users: 'taskflow-users',
  tasks: 'taskflow-tasks',
};

const taskStatuses = ['Upcoming', 'In Progress', 'Closed'];
const priorities = ['Low', 'Medium', 'High'];

const appState = {
  users: readStorage(STORAGE_KEYS.users, getDefaultUsers()),
  tasks: readStorage(STORAGE_KEYS.tasks, getDefaultTasks()),
  activeTab: 'hub',
  currentUserId: '',
  editingUserId: null,
  editingTaskId: null,
  userDraft: createEmptyUser(),
  taskDraft: createEmptyTask(),
  confirmation: null,
  toastTimer: null,
};

appState.currentUserId = appState.users.find((user) => user.active)?.id ?? appState.users[0]?.id ?? '';
appState.taskDraft.assigneeId = appState.users[0]?.id ?? '';

const root = document.querySelector('#root');
render();

function nextDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function createId(prefix) {
  const randomPart = crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomPart}`;
}

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(appState.users));
  localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(appState.tasks));
}

function getDefaultUsers() {
  return [
    { id: 'u-1', name: 'Vignesh Kumar', email: 'vignesh@example.com', role: 'Project Lead', active: true },
    { id: 'u-2', name: 'Ananya Rao', email: 'ananya@example.com', role: 'Designer', active: true },
    { id: 'u-3', name: 'Rahul Sharma', email: 'rahul@example.com', role: 'Developer', active: true },
  ];
}

function getDefaultTasks() {
  const createdAt = new Date().toISOString();
  return [
    {
      id: 't-1',
      title: 'Design onboarding dashboard',
      description: 'Prepare a clear first-run experience for new team members.',
      dueDate: nextDate(2),
      priority: 'High',
      assigneeId: 'u-2',
      status: 'Upcoming',
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 't-2',
      title: 'API validation checklist',
      description: 'Document acceptance checks for the upcoming sprint release.',
      dueDate: nextDate(5),
      priority: 'Medium',
      assigneeId: 'u-3',
      status: 'Upcoming',
      createdAt,
      updatedAt: createdAt,
    },
  ];
}

function createEmptyUser() {
  return { id: '', name: '', email: '', role: '', active: true };
}

function createEmptyTask() {
  return {
    id: '',
    title: '',
    description: '',
    dueDate: nextDate(1),
    priority: 'Medium',
    assigneeId: '',
    status: 'Upcoming',
    createdAt: '',
    updatedAt: '',
  };
}

function render() {
  if (!root) return;
  const stats = calculateStats();
  root.innerHTML = `
    <div class="app-shell">
      <header class="hero">
        <div>
          <p class="eyebrow">Team productivity workspace</p>
          <h1>TaskFlow Hub</h1>
          <p class="hero-copy">Manage users, plan upcoming work, assign ownership, and keep every task status synchronized.</p>
        </div>
        <label class="current-user-card">
          <span>Viewing My Tasks as</span>
          <select data-action="change-current-user" ${appState.users.length ? '' : 'disabled'}>
            ${appState.users.map((user) => `<option value="${escapeHtml(user.id)}" ${user.id === appState.currentUserId ? 'selected' : ''}>${escapeHtml(user.name)}</option>`).join('')}
          </select>
        </label>
      </header>
      <section class="stats-grid" aria-label="Task and user summary">
        ${statCard('👥', 'Users', stats.users, 'blue')}
        ${statCard('📋', 'Upcoming', stats.upcoming, 'purple')}
        ${statCard('▶', 'In Progress', stats.inProgress, 'amber')}
        ${statCard('✅', 'Closed', stats.closed, 'green')}
      </section>
      <nav class="tabs" aria-label="Main sections">
        ${tabButton('users', '👥', 'Users Master')}
        ${tabButton('hub', '📊', 'Tasks Hub')}
        ${tabButton('my-tasks', '🙋', 'My Tasks')}
      </nav>
      ${renderActiveTab()}
      ${appState.confirmation ? renderConfirmDialog() : ''}
    </div>
  `;
  bindEvents();
}

function calculateStats() {
  return {
    users: appState.users.length,
    upcoming: appState.tasks.filter((task) => task.status === 'Upcoming').length,
    inProgress: appState.tasks.filter((task) => task.status === 'In Progress').length,
    closed: appState.tasks.filter((task) => task.status === 'Closed').length,
  };
}

function statCard(icon, label, value, accent) {
  return `<article class="stat-card ${accent}"><div>${icon}</div><span>${label}</span><strong>${value}</strong></article>`;
}

function tabButton(tab, icon, label) {
  return `<button class="tab ${appState.activeTab === tab ? 'active' : ''}" data-action="tab" data-tab="${tab}"><span>${icon}</span><span>${label}</span></button>`;
}

function renderActiveTab() {
  if (appState.activeTab === 'users') return renderUsersTab();
  if (appState.activeTab === 'my-tasks') return renderMyTasksTab();
  return renderTasksHubTab();
}

function renderUsersTab() {
  return `
    <main class="workspace two-column">
      ${panel(appState.editingUserId ? 'Edit user' : 'Add user', 'Maintain the Users Master list.', renderUserForm())}
      ${panel('Users Master', 'Edit or remove team members.', renderUsersList())}
    </main>
  `;
}

function renderUserForm() {
  const draft = appState.userDraft;
  return `
    <form class="form-grid" data-form="user">
      <label>Name<input name="name" value="${escapeAttr(draft.name)}" placeholder="Full name" /></label>
      <label>Email<input name="email" type="email" value="${escapeAttr(draft.email)}" placeholder="name@company.com" /></label>
      <label>Role<input name="role" value="${escapeAttr(draft.role)}" placeholder="Role or team" /></label>
      <label>Status<select name="active"><option value="true" ${draft.active ? 'selected' : ''}>Active</option><option value="false" ${!draft.active ? 'selected' : ''}>Inactive</option></select></label>
      <div class="form-actions">
        <button class="primary" type="submit">➕ ${appState.editingUserId ? 'Save user' : 'Add user'}</button>
        ${appState.editingUserId ? '<button class="ghost" type="button" data-action="cancel-user">Cancel</button>' : ''}
      </div>
    </form>
  `;
}

function renderUsersList() {
  if (!appState.users.length) return emptyState('No users yet', 'Add your first user to start assigning tasks.');
  return `<div class="card-list">${appState.users.map((user) => `
    <article class="user-card">
      <div class="avatar">${escapeHtml(getInitials(user.name))}</div>
      <div class="card-main">
        <h3>${escapeHtml(user.name)}</h3>
        <p>${escapeHtml(user.email)}</p>
        <span class="pill neutral">${escapeHtml(user.role)}</span>
        ${user.active ? '' : '<span class="pill muted">Inactive</span>'}
      </div>
      <div class="row-actions">
        <button class="icon-btn" data-action="edit-user" data-id="${escapeAttr(user.id)}" aria-label="Edit ${escapeAttr(user.name)}">✏️</button>
        <button class="icon-btn danger" data-action="delete-user" data-id="${escapeAttr(user.id)}" aria-label="Delete ${escapeAttr(user.name)}">🗑️</button>
      </div>
    </article>`).join('')}</div>`;
}

function renderTasksHubTab() {
  return `
    <main class="workspace two-column wide-left">
      ${panel(appState.editingTaskId ? 'Edit task' : 'Create upcoming task', 'Every new task lands in Tasks Hub with Upcoming status.', renderTaskForm())}
      ${panel('Tasks Hub', 'All task assignments and live statuses.', renderTaskBoard(appState.tasks))}
    </main>
  `;
}

function renderMyTasksTab() {
  const myTasks = appState.tasks.filter((task) => task.assigneeId === appState.currentUserId);
  return `<main class="workspace">${panel('My Tasks', 'Start assigned tasks, move them to in-progress, and close them when done.', renderTaskBoard(myTasks, true))}</main>`;
}

function renderTaskForm() {
  const draft = appState.taskDraft;
  return `
    <form class="form-grid" data-form="task">
      <label>Title<input name="title" value="${escapeAttr(draft.title)}" placeholder="Task title" /></label>
      <label>Assignee<select name="assigneeId"><option value="">Choose user</option>${appState.users.filter((user) => user.active).map((user) => `<option value="${escapeAttr(user.id)}" ${user.id === draft.assigneeId ? 'selected' : ''}>${escapeHtml(user.name)}</option>`).join('')}</select></label>
      <label>Due date<input name="dueDate" type="date" value="${escapeAttr(draft.dueDate)}" /></label>
      <label>Priority<select name="priority">${priorities.map((priority) => `<option ${priority === draft.priority ? 'selected' : ''}>${priority}</option>`).join('')}</select></label>
      ${appState.editingTaskId ? `<label>Status<select name="status">${taskStatuses.map((status) => `<option ${status === draft.status ? 'selected' : ''}>${status}</option>`).join('')}</select></label>` : ''}
      <label class="full">Description<textarea name="description" placeholder="Describe what needs to be done" rows="4">${escapeHtml(draft.description)}</textarea></label>
      <div class="form-actions">
        <button class="primary" type="submit">➕ ${appState.editingTaskId ? 'Save task' : 'Create task'}</button>
        ${appState.editingTaskId ? '<button class="ghost" type="button" data-action="cancel-task">Cancel</button>' : ''}
      </div>
    </form>
  `;
}

function renderTaskBoard(tasks, compact = false) {
  if (!tasks.length) return emptyState('No tasks found', 'Create or assign tasks to see them here.');
  return `<div class="task-grid ${compact ? 'compact' : ''}">${tasks.map(renderTaskCard).join('')}</div>`;
}

function renderTaskCard(task) {
  const assignee = appState.users.find((user) => user.id === task.assigneeId);
  const statusClass = task.status.toLowerCase().replace(' ', '-');
  return `
    <article class="task-card">
      <div class="task-top"><span class="status ${statusClass}">${task.status}</span><span class="priority ${task.priority.toLowerCase()}">${task.priority}</span></div>
      <h3>${escapeHtml(task.title)}</h3>
      <p>${escapeHtml(task.description)}</p>
      <div class="task-meta"><span>👤 ${escapeHtml(assignee?.name ?? 'Unassigned')}</span><span>📅 ${formatDate(task.dueDate)}</span></div>
      <div class="task-actions">
        ${task.status === 'Upcoming' ? `<button class="primary small" data-action="status" data-status="In Progress" data-id="${escapeAttr(task.id)}">▶ Start</button>` : ''}
        ${task.status !== 'Closed' ? `<button class="success small" data-action="status" data-status="Closed" data-id="${escapeAttr(task.id)}">✅ Close</button>` : ''}
        <button class="ghost small" data-action="edit-task" data-id="${escapeAttr(task.id)}">✏️ Edit</button>
        <button class="ghost danger small" data-action="delete-task" data-id="${escapeAttr(task.id)}">🗑️ Delete</button>
      </div>
    </article>
  `;
}

function panel(title, subtitle, content) {
  return `<section class="panel"><div class="panel-heading"><h2>${title}</h2><p>${subtitle}</p></div>${content}</section>`;
}

function emptyState(title, message) {
  return `<div class="empty"><div class="empty-icon">📋</div><h3>${title}</h3><p>${message}</p></div>`;
}

function renderConfirmDialog() {
  const state = appState.confirmation;
  return `
    <div class="modal-backdrop" role="presentation">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <button class="modal-close" data-action="cancel-confirm" aria-label="Close confirmation">×</button>
        <h2 id="confirm-title">${escapeHtml(state.title)}</h2>
        <p>${escapeHtml(state.message)}</p>
        <div class="modal-actions">
          <button class="ghost" data-action="cancel-confirm">Cancel</button>
          <button class="${state.danger ? 'danger solid' : 'primary'}" data-action="accept-confirm">${escapeHtml(state.confirmLabel ?? 'Confirm')}</button>
        </div>
      </section>
    </div>
  `;
}

function bindEvents() {
  root.querySelectorAll('[data-action]').forEach((element) => {
    element.addEventListener('click', handleAction);
  });
  root.querySelector('[data-action="change-current-user"]')?.addEventListener('change', (event) => {
    appState.currentUserId = event.target.value;
    render();
  });
  root.querySelector('[data-form="user"]')?.addEventListener('submit', saveUser);
  root.querySelector('[data-form="task"]')?.addEventListener('submit', saveTask);
}

function handleAction(event) {
  const actionElement = event.currentTarget;
  const action = actionElement.dataset.action;
  const id = actionElement.dataset.id;
  if (action === 'tab') {
    appState.activeTab = actionElement.dataset.tab;
    render();
  }
  if (action === 'cancel-user') resetUserForm();
  if (action === 'cancel-task') resetTaskForm();
  if (action === 'edit-user') editUser(id);
  if (action === 'delete-user') deleteUser(id);
  if (action === 'edit-task') editTask(id);
  if (action === 'delete-task') deleteTask(id);
  if (action === 'status') updateTaskStatus(id, actionElement.dataset.status);
  if (action === 'cancel-confirm') {
    appState.confirmation = null;
    render();
  }
  if (action === 'accept-confirm') {
    appState.confirmation?.onConfirm();
    appState.confirmation = null;
    persist();
    render();
  }
}

function saveUser(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const draft = {
    id: appState.editingUserId ?? '',
    name: String(formData.get('name') ?? '').trim(),
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    role: String(formData.get('role') ?? '').trim(),
    active: formData.get('active') === 'true',
  };
  if (!draft.name || !draft.email || !draft.role) return showToast('Please complete user name, email, and role.');
  if (appState.users.some((user) => user.email.toLowerCase() === draft.email && user.id !== appState.editingUserId)) return showToast('A user with this email already exists.');
  appState.confirmation = {
    title: appState.editingUserId ? 'Save user changes?' : 'Create new user?',
    message: appState.editingUserId ? `Update ${draft.name}'s details?` : `Add ${draft.name} to the Users Master?`,
    confirmLabel: appState.editingUserId ? 'Save changes' : 'Create user',
    onConfirm: () => {
      if (appState.editingUserId) {
        appState.users = appState.users.map((user) => user.id === appState.editingUserId ? { ...user, ...draft, id: user.id } : user);
        showToast('User updated successfully.', false);
      } else {
        const user = { ...draft, id: createId('u') };
        appState.users = [...appState.users, user];
        if (!appState.currentUserId) appState.currentUserId = user.id;
        showToast('User created successfully.', false);
      }
      resetUserForm(false);
    },
  };
  render();
}

function editUser(id) {
  const user = appState.users.find((item) => item.id === id);
  if (!user) return;
  appState.userDraft = { ...user };
  appState.editingUserId = user.id;
  appState.activeTab = 'users';
  render();
}

function deleteUser(id) {
  const user = appState.users.find((item) => item.id === id);
  if (!user) return;
  const assignedCount = appState.tasks.filter((task) => task.assigneeId === user.id && task.status !== 'Closed').length;
  appState.confirmation = {
    title: 'Delete user?',
    message: assignedCount ? `${user.name} has ${assignedCount} open task(s). Delete anyway and unassign those tasks?` : `Delete ${user.name} from Users Master?`,
    confirmLabel: 'Delete user',
    danger: true,
    onConfirm: () => {
      appState.users = appState.users.filter((item) => item.id !== user.id);
      appState.tasks = appState.tasks.map((task) => task.assigneeId === user.id ? { ...task, assigneeId: '', updatedAt: new Date().toISOString() } : task);
      if (appState.currentUserId === user.id) appState.currentUserId = appState.users.find((item) => item.active)?.id ?? appState.users[0]?.id ?? '';
      if (appState.editingUserId === user.id) resetUserForm(false);
      showToast('User deleted. Related tasks are now unassigned.', false);
    },
  };
  render();
}

function saveTask(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const existing = appState.tasks.find((task) => task.id === appState.editingTaskId);
  const draft = {
    id: appState.editingTaskId ?? '',
    title: String(formData.get('title') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim(),
    dueDate: String(formData.get('dueDate') ?? ''),
    priority: String(formData.get('priority') ?? 'Medium'),
    assigneeId: String(formData.get('assigneeId') ?? ''),
    status: appState.editingTaskId ? String(formData.get('status') ?? existing?.status ?? 'Upcoming') : 'Upcoming',
    createdAt: existing?.createdAt ?? '',
    updatedAt: existing?.updatedAt ?? '',
  };
  if (!draft.title || !draft.description || !draft.dueDate || !draft.assigneeId) return showToast('Please complete task title, description, due date, and assignee.');
  appState.confirmation = {
    title: appState.editingTaskId ? 'Save task changes?' : 'Create task?',
    message: appState.editingTaskId ? `Update “${draft.title}” in Tasks Hub?` : `Add “${draft.title}” to upcoming tasks?`,
    confirmLabel: appState.editingTaskId ? 'Save task' : 'Create task',
    onConfirm: () => {
      const now = new Date().toISOString();
      if (appState.editingTaskId) {
        appState.tasks = appState.tasks.map((task) => task.id === appState.editingTaskId ? { ...task, ...draft, id: task.id, createdAt: task.createdAt, updatedAt: now } : task);
        showToast('Task updated successfully.', false);
      } else {
        appState.tasks = [...appState.tasks, { ...draft, id: createId('t'), status: 'Upcoming', createdAt: now, updatedAt: now }];
        showToast('Task added to Tasks Hub.', false);
      }
      resetTaskForm(false);
    },
  };
  render();
}

function editTask(id) {
  const task = appState.tasks.find((item) => item.id === id);
  if (!task) return;
  appState.taskDraft = { ...task };
  appState.editingTaskId = task.id;
  appState.activeTab = 'hub';
  render();
}

function deleteTask(id) {
  const task = appState.tasks.find((item) => item.id === id);
  if (!task) return;
  appState.confirmation = {
    title: 'Delete task?',
    message: `Permanently remove “${task.title}” from Tasks Hub?`,
    confirmLabel: 'Delete task',
    danger: true,
    onConfirm: () => {
      appState.tasks = appState.tasks.filter((item) => item.id !== task.id);
      if (appState.editingTaskId === task.id) resetTaskForm(false);
      showToast('Task deleted.', false);
    },
  };
  render();
}

function updateTaskStatus(id, status) {
  const task = appState.tasks.find((item) => item.id === id);
  if (!task) return;
  appState.confirmation = {
    title: status === 'In Progress' ? 'Start task?' : 'Close task?',
    message: `Do you want to ${status === 'In Progress' ? 'start' : 'close'} “${task.title}”? This will update the status everywhere.`,
    confirmLabel: status === 'In Progress' ? 'Start task' : 'Close task',
    onConfirm: () => {
      appState.tasks = appState.tasks.map((item) => item.id === task.id ? { ...item, status, updatedAt: new Date().toISOString() } : item);
      showToast(status === 'In Progress' ? 'Task moved to In Progress.' : 'Task closed successfully.', false);
    },
  };
  render();
}

function resetUserForm(shouldRender = true) {
  appState.userDraft = createEmptyUser();
  appState.editingUserId = null;
  if (shouldRender) render();
}

function resetTaskForm(shouldRender = true) {
  appState.taskDraft = createEmptyTask();
  appState.editingTaskId = null;
  if (shouldRender) render();
}

function showToast(message, shouldRender = true) {
  const existing = document.querySelector('.toast');
  existing?.remove();
  clearTimeout(appState.toastTimer);
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.role = 'status';
  toast.textContent = message;
  document.body.append(toast);
  appState.toastTimer = setTimeout(() => toast.remove(), 2600);
  if (shouldRender) render();
}

function getInitials(name) {
  return name.split(' ').map((part) => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

function formatDate(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}
