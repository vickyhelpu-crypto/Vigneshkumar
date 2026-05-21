const STORAGE_KEYS = {
  users: 'taskflow-users',
  tasks: 'taskflow-tasks',
  adminNotifications: 'taskflow-admin-notifications',
};

const taskStatuses = ['Upcoming', 'In Progress', 'Closed'];
const priorities = ['Low', 'Medium', 'High'];
const ADMIN_USER_ID = 'u-1';
const ADMIN_NAME = 'Vigneshkumar Rajendran';

const appState = {
  users: readStorage(STORAGE_KEYS.users, getDefaultUsers()),
  tasks: readStorage(STORAGE_KEYS.tasks, getDefaultTasks()),
  adminNotifications: readStorage(STORAGE_KEYS.adminNotifications, []),
  activeTab: 'hub',
  currentUserId: '',
  editingUserId: null,
  editingTaskId: null,
  userDraft: createEmptyUser(),
  taskDraft: createEmptyTask(),
  confirmation: null,
  filters: { userId: 'all', status: 'all', overdue: 'all' },
  reportFilters: { period: 'weekly', userId: 'all', status: 'all', priority: 'all', chartType: 'pie' },
  toastTimer: null,
};

migrateSeedData();
appState.currentUserId = appState.users.find((user) => user.id === ADMIN_USER_ID)?.id ?? appState.users.find((user) => user.active)?.id ?? appState.users[0]?.id ?? '';
appState.taskDraft.assigneeId = '';

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
  localStorage.setItem(STORAGE_KEYS.adminNotifications, JSON.stringify(appState.adminNotifications));
}

function getDefaultUsers() {
  return [
    { id: ADMIN_USER_ID, name: ADMIN_NAME, email: 'vigneshkumar.rajendran@example.com', role: 'Project Manager & Admin', active: true },
    { id: 'u-2', name: 'Ananya Rao', email: 'ananya@example.com', role: 'Designer', active: true },
    { id: 'u-3', name: 'Rahul Sharma', email: 'rahul@example.com', role: 'Developer', active: true },
    { id: 'u-4', name: 'Meera Nair', email: 'meera@example.com', role: 'QA Analyst', active: true },
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


function migrateSeedData() {
  appState.users = appState.users.map((user) => ({
    ...user,
    active: typeof user.active === 'boolean' ? user.active : user.isActive !== false,
    role: user.role || 'Team member',
  }));

  const adminIndex = appState.users.findIndex((user) => user.id === ADMIN_USER_ID || user.email === 'vignesh@example.com');
  if (adminIndex >= 0) {
    appState.users[adminIndex] = {
      ...appState.users[adminIndex],
      id: ADMIN_USER_ID,
      name: ADMIN_NAME,
      email: 'vigneshkumar.rajendran@example.com',
      role: 'Project Manager & Admin',
      active: true,
    };
  } else {
    appState.users.unshift({ id: ADMIN_USER_ID, name: ADMIN_NAME, email: 'vigneshkumar.rajendran@example.com', role: 'Project Manager & Admin', active: true });
  }
  if (!appState.users.some((user) => user.id === 'u-4')) {
    appState.users.push({ id: 'u-4', name: 'Meera Nair', email: 'meera@example.com', role: 'QA Analyst', active: true });
  }
  appState.adminNotifications = Array.isArray(appState.adminNotifications) ? appState.adminNotifications : [];
  enforceInactiveUserTaskRules();
  persist();
}

function getActiveUsers() {
  return appState.users.filter((user) => user.active);
}

function getCurrentUser() {
  return appState.users.find((user) => user.id === appState.currentUserId);
}

function isCurrentUserAdmin() {
  const currentUser = getCurrentUser();
  return currentUser?.id === ADMIN_USER_ID || currentUser?.name === ADMIN_NAME || currentUser?.role.toLowerCase().includes('admin');
}

function canViewTab(tab) {
  return ['hub', 'my-tasks'].includes(tab) || isCurrentUserAdmin();
}

function canManageTask(task, action) {
  if (isCurrentUserAdmin()) return true;
  if (action === 'delete') return false;
  return task.assigneeId === appState.currentUserId;
}

function isTaskOverdue(task) {
  if (!task.dueDate || task.status === 'Closed') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${task.dueDate}T00:00:00`) < today;
}

function getReassignableTasksForUser(userId) {
  return appState.tasks.filter((task) => task.assigneeId === userId && task.status !== 'Closed');
}

function addAdminNotification(message, options = {}) {
  appState.adminNotifications = [
    { id: createId('n'), message, createdAt: new Date().toISOString(), read: false, ...options },
    ...appState.adminNotifications,
  ].slice(0, 8);
}

// When a user is reactivated, offer to restore their tasks if there are any pending notifications about them


function getInactiveTaskNotificationsForUser(userId) {
  return appState.adminNotifications.filter((notification) => (
    !notification.read
    && notification.type === 'inactive-user-tasks'
    && notification.userId === userId
    && Array.isArray(notification.taskIds)
  ));
}

function restoreInactiveUserTasks(userId) {
  const notifications = getInactiveTaskNotificationsForUser(userId);
  if (!notifications.length) return 0;

  const taskIds = new Set(notifications.flatMap((notification) => notification.taskIds));
  let restoredCount = 0;
  const now = new Date().toISOString();
  appState.tasks = appState.tasks.map((task) => {
    if (!taskIds.has(task.id) || task.assigneeId || task.status === 'Closed') return task;
    restoredCount += 1;
    return { ...task, assigneeId: userId, updatedAt: now };
  });
  appState.adminNotifications = appState.adminNotifications.map((notification) => (
    notifications.some((item) => item.id === notification.id) ? { ...notification, read: true } : notification
  ));
  return restoredCount;
}

function refreshInactiveTaskNotifications() {
  appState.adminNotifications = appState.adminNotifications.map((notification) => {
    if (notification.read || notification.type !== 'inactive-user-tasks' || !Array.isArray(notification.taskIds)) return notification;
    const pendingTasks = appState.tasks.filter((task) => (
      notification.taskIds.includes(task.id) && !task.assigneeId && task.status !== 'Closed'
    ));
    if (!pendingTasks.length) return { ...notification, read: true };

    const user = appState.users.find((item) => item.id === notification.userId);
    return {
      ...notification,
      taskIds: pendingTasks.map((task) => task.id),
      message: `${user?.name ?? 'Inactive user'} was marked inactive. ${pendingTasks.length} open task(s) are now unassigned and need reassignment.`,
    };
  });
}

function enforceInactiveUserTaskRules() {
  const inactiveUsersWithTasks = appState.users
    .filter((user) => !user.active)
    .map((user) => ({ user, tasks: getReassignableTasksForUser(user.id) }))
    .filter((item) => item.tasks.length);
  if (!inactiveUsersWithTasks.length) return;

  const now = new Date().toISOString();
  const inactiveUserIds = new Set(inactiveUsersWithTasks.map((item) => item.user.id));
  appState.tasks = appState.tasks.map((task) => (
    inactiveUserIds.has(task.assigneeId) && task.status !== 'Closed' ? { ...task, assigneeId: '', updatedAt: now } : task
  ));
  inactiveUsersWithTasks.forEach(({ user, tasks }) => {
    addAdminNotification(`${user.name} is inactive. ${tasks.length} open task(s) are now unassigned and need reassignment.`, {
      type: 'inactive-user-tasks',
      userId: user.id,
      taskIds: tasks.map((task) => task.id),
    });
  });
}

function render() {
  if (!root) return;
  if (!canViewTab(appState.activeTab)) appState.activeTab = 'hub';
  const stats = calculateStats();
  const isAdmin = isCurrentUserAdmin();
  const activeUsers = getActiveUsers();
  root.innerHTML = `
    <div class="app-shell">
      <header class="hero">
        <div>
          <p class="eyebrow animated-eyebrow"><span>Team productivity workspace</span><span>Tasks Management</span><span>Smart utilization</span></p>
          <h1><span>Tasks Management Hub</span></h1>
          <p class="hero-copy">Manage users, plan upcoming work, assign ownership, and keep every task status synchronized.</p>
        </div>
        <label class="current-user-card">
          <span>Signed in as</span>
          <select data-action="change-current-user" ${activeUsers.length ? '' : 'disabled'}>
            ${activeUsers.map((user) => `<option value="${escapeHtml(user.id)}" ${user.id === appState.currentUserId ? 'selected' : ''}>${escapeHtml(user.name)}</option>`).join('')}
          </select>
        </label>
      </header>
      ${isAdmin ? `<section class="stats-grid" aria-label="Task and user summary">
        ${statCard('👥', 'Users', stats.users, 'blue')}
        ${statCard('📋', 'Upcoming', stats.upcoming, 'purple')}
        ${statCard('▶', 'In Progress', stats.inProgress, 'amber')}
        ${statCard('✅', 'Closed', stats.closed, 'green')}
      </section>` : ''}
      <nav class="tabs" aria-label="Main sections">
        ${isAdmin ? tabButton('users', '👥', 'Users Master') : ''}
        ${tabButton('hub', '📊', 'Tasks Hub')}
        ${tabButton('my-tasks', '🙋', 'My Tasks')}
        ${isAdmin ? tabButton('team-dashboard', '📈', 'Team Dashboard') : ''}
        ${isAdmin ? tabButton('reports', '📑', 'Reports') : ''}
      </nav>
      ${isAdmin ? renderAdminNotifications() : ''}
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
  if (appState.activeTab === 'team-dashboard') return renderTeamDashboardTab();
  if (appState.activeTab === 'reports') return renderReportsTab();
  return renderTasksHubTab();
}

function renderAdminNotifications() {
  const unreadNotifications = appState.adminNotifications.filter((notification) => !notification.read);
  if (!unreadNotifications.length) return '';
  return `
    <section class="admin-alerts" aria-label="Admin notifications">
      ${unreadNotifications.map((notification) => `
        <div class="admin-alert">
          <span>${escapeHtml(notification.message)}</span>
          <button class="ghost small" data-action="dismiss-notification" data-id="${escapeAttr(notification.id)}">Dismiss</button>
        </div>
      `).join('')}
    </section>
  `;
}

function renderUsersTab() {
  return `
    <main class="workspace two-column">
      ${panel(appState.editingUserId ? 'Edit User' : 'Add User', 'Maintain the Users Master list.', renderUserForm())}
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
        <button class="primary" type="submit">➕ ${appState.editingUserId ? 'Save User' : 'Add User'}</button>
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
  const visibleTasks = getFilteredTasks(appState.tasks);
  const hubPanel = panel('Tasks Hub', 'All task assignments and live statuses. Use filters to focus by user, status, or overdue work.', `${renderTaskFilters()}${renderTaskBoard(visibleTasks)}`);
  if (!isCurrentUserAdmin()) {
    const editingTask = appState.tasks.find((task) => task.id === appState.editingTaskId);
    if (editingTask && canManageTask(editingTask, 'edit')) {
      return `<main class="workspace two-column wide-left">${panel('Edit My Task', 'Update only work assigned to you. Admin-only options stay hidden.', renderTaskForm())}${hubPanel}</main>`;
    }
    return `<main class="workspace">${hubPanel}</main>`;
  }
  return `
    <main class="workspace two-column wide-left">
      ${panel(appState.editingTaskId ? 'Edit Task' : 'Create Upcoming Task', 'Admins can create work now and assign an owner later based on resource availability.', renderTaskForm())}
      ${hubPanel}
    </main>
  `;
}

function renderMyTasksTab() {
  const myTasks = appState.tasks.filter((task) => task.assigneeId === appState.currentUserId);
  return `<main class="workspace">${panel('My Tasks', 'Start assigned tasks, move them to in-progress, and close them when done.', renderTaskBoard(myTasks, true))}</main>`;
}


function renderTaskFilters() {
  return `
    <form class="filters" aria-label="Task filters">
      <label>User<select data-filter="userId"><option value="all" ${appState.filters.userId === 'all' ? 'selected' : ''}>All Users</option><option value="unassigned" ${appState.filters.userId === 'unassigned' ? 'selected' : ''}>Unassigned</option>${appState.users.map((user) => `<option value="${escapeAttr(user.id)}" ${appState.filters.userId === user.id ? 'selected' : ''}>${escapeHtml(user.name)}</option>`).join('')}</select></label>
      <label>Status<select data-filter="status"><option value="all" ${appState.filters.status === 'all' ? 'selected' : ''}>All Statuses</option>${taskStatuses.map((status) => `<option value="${escapeAttr(status)}" ${appState.filters.status === status ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('')}</select></label>
      <label>Overdue<select data-filter="overdue"><option value="all" ${appState.filters.overdue === 'all' ? 'selected' : ''}>All Tasks</option><option value="overdue" ${appState.filters.overdue === 'overdue' ? 'selected' : ''}>Overdue only</option><option value="not-overdue" ${appState.filters.overdue === 'not-overdue' ? 'selected' : ''}>Not overdue</option></select></label>
    </form>
  `;
}

function getFilteredTasks(tasks) {
  return tasks.filter((task) => {
    const userMatch = appState.filters.userId === 'all' || (appState.filters.userId === 'unassigned' ? !task.assigneeId : task.assigneeId === appState.filters.userId);
    const statusMatch = appState.filters.status === 'all' || task.status === appState.filters.status;
    const overdue = isTaskOverdue(task);
    const overdueMatch = appState.filters.overdue === 'all' || (appState.filters.overdue === 'overdue' ? overdue : !overdue);
    return userMatch && statusMatch && overdueMatch;
  });
}

function renderTaskActions(task) {
  const canEdit = canManageTask(task, 'edit');
  const canStatus = canManageTask(task, 'status');
  const canDelete = isCurrentUserAdmin();
  const buttons = [
    task.status === 'Upcoming' && canStatus ? `<button class="primary small" data-action="status" data-status="In Progress" data-id="${escapeAttr(task.id)}">▶ Start</button>` : '',
    task.status !== 'Closed' && canStatus ? `<button class="success small" data-action="status" data-status="Closed" data-id="${escapeAttr(task.id)}">✅ Close</button>` : '',
    canEdit ? `<button class="ghost small" data-action="edit-task" data-id="${escapeAttr(task.id)}">✏️ Edit</button>` : '',
    canDelete ? `<button class="ghost danger small" data-action="delete-task" data-id="${escapeAttr(task.id)}">🗑️ Delete</button>` : '',
  ].filter(Boolean);
  if (!buttons.length) return '<div class="task-actions readonly">View only — actions are available on your own tasks.</div>';
  return `<div class="task-actions">${buttons.join('')}</div>`;
}

function renderTeamDashboardTab() {
  const openTasks = appState.tasks.filter((task) => task.status !== 'Closed');
  const unassigned = appState.tasks.filter((task) => !task.assigneeId);
  const activeUsers = getActiveUsers();
  const maxAssigned = Math.max(1, ...activeUsers.map((user) => openTasks.filter((task) => task.assigneeId === user.id).length));
  const statusCounts = taskStatuses.map((status) => ({ status, count: appState.tasks.filter((task) => task.status === status).length }));
  const totalTasks = Math.max(1, appState.tasks.length);
  const upcomingDeg = (statusCounts[0].count / totalTasks) * 360;
  const progressDeg = upcomingDeg + (statusCounts[1].count / totalTasks) * 360;
  return `
    <main class="workspace dashboard-grid">
      ${panel('Team Capacity', 'Open workload by active team member.', `<div class="bar-chart">${activeUsers.map((user) => {
        const count = openTasks.filter((task) => task.assigneeId === user.id).length;
        return `<div class="bar-row"><span>${escapeHtml(user.name)}</span><div class="bar-track"><strong style="width:${Math.max(8, (count / maxAssigned) * 100)}%">${count}</strong></div></div>`;
      }).join('')}</div>`)}
      ${panel('Productivity Movement', 'Current task status distribution.', `<div class="donut-card"><div class="donut" style="--upcoming-deg:${upcomingDeg}deg; --progress-deg:${progressDeg}deg"></div><div class="legend">${statusCounts.map((item) => `<span><i class="legend-dot ${item.status.toLowerCase().replace(' ', '-')}"></i>${item.status}: ${item.count}</span>`).join('')}</div></div>`)}
      ${panel('Unassigned Tasks', 'Work waiting for admin assignment.', unassigned.length ? renderTaskBoard(unassigned, true) : emptyState('No unassigned tasks', 'Every task currently has an owner.'))}
    </main>
  `;
}

function renderReportsTab() {
  const reportTasks = getReportTasks();
  const summary = getReportSummary(reportTasks);
  const periodLabel = appState.reportFilters.period === 'weekly' ? 'Weekly Report' : (appState.reportFilters.period === 'monthly' ? 'Monthly Report' : 'Yearly Report');
  return `
    <main class="workspace reports-layout">
      ${panel('Reports', 'Review weekly or monthly task performance, filter the result set, and export it.', `
        ${renderReportControls()}
        <section class="report-summary" aria-label="Report summary">
          ${statCard('Total', 'Tasks', summary.total, 'blue')}
          ${statCard('Open', 'Open', summary.open, 'amber')}
          ${statCard('Done', 'Closed', summary.closed, 'green')}
          ${statCard('Late', 'Overdue', summary.overdue, 'purple')}
        </section>
      `)}
      ${panel(`${periodLabel} Chart`, 'Switch between pie and bar chart views.', renderReportChart(reportTasks))}
      ${panel(`${periodLabel} Details`, 'Filtered task records included in the selected report.', renderReportTable(reportTasks))}
    </main>
  `;
}

function renderReportControls() {
  const filters = appState.reportFilters;
  return `
    <form class="filters report-controls" aria-label="Report filters">
      <label>Report Type<select data-report-filter="period">
        <option value="weekly" ${filters.period === 'weekly' ? 'selected' : ''}>Weekly</option>
        <option value="monthly" ${filters.period === 'monthly' ? 'selected' : ''}>Monthly Report</option>
        <option value="yearly" ${filters.period === 'yearly' ? 'selected' : ''}>Yearly Report</option>
      </select></label>
      <label>User<select data-report-filter="userId">
        <option value="all" ${filters.userId === 'all' ? 'selected' : ''}>All Users</option>
        <option value="unassigned" ${filters.userId === 'unassigned' ? 'selected' : ''}>Unassigned</option>
        ${appState.users.map((user) => `<option value="${escapeAttr(user.id)}" ${filters.userId === user.id ? 'selected' : ''}>${escapeHtml(user.name)}</option>`).join('')}
      </select></label>
      <label>Status<select data-report-filter="status">
        <option value="all" ${filters.status === 'all' ? 'selected' : ''}>All Statuses</option>
        ${taskStatuses.map((status) => `<option value="${escapeAttr(status)}" ${filters.status === status ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('')}
      </select></label>
      <label>Priority<select data-report-filter="priority">
        <option value="all" ${filters.priority === 'all' ? 'selected' : ''}>All Priorities</option>
        ${priorities.map((priority) => `<option value="${escapeAttr(priority)}" ${filters.priority === priority ? 'selected' : ''}>${escapeHtml(priority)}</option>`).join('')}
      </select></label>
      <label>Chart<select data-report-filter="chartType">
        <option value="pie" ${filters.chartType === 'pie' ? 'selected' : ''}>Pie Chart</option>
        <option value="bar" ${filters.chartType === 'bar' ? 'selected' : ''}>Bar Chart</option>
      </select></label>
      <div class="export-actions" aria-label="Export report">
        <button class="ghost small" type="button" data-action="export-report" data-format="excel">Excel</button>
        <button class="ghost small" type="button" data-action="export-report" data-format="pdf">PDF</button>
        <button class="ghost small" type="button" data-action="export-report" data-format="word">Word</button>
      </div>
    </form>
  `;
}

function getReportTasks() {
  const { start, end } = getReportDateRange(appState.reportFilters.period);
  return appState.tasks.filter((task) => {
    const dueDate = new Date(`${task.dueDate}T00:00:00`);
    const inPeriod = dueDate >= start && dueDate <= end;
    const userMatch = appState.reportFilters.userId === 'all' || (appState.reportFilters.userId === 'unassigned' ? !task.assigneeId : task.assigneeId === appState.reportFilters.userId);
    const statusMatch = appState.reportFilters.status === 'all' || task.status === appState.reportFilters.status;
    const priorityMatch = appState.reportFilters.priority === 'all' || task.priority === appState.reportFilters.priority;
    return inPeriod && userMatch && statusMatch && priorityMatch;
  });
}

function getReportDateRange(period) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === 'monthly') {
    start.setDate(1);
  } else if (period === 'yearly') {
    start.setMonth(0, 1);
  } else {
    const day = start.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + mondayOffset);
  }
  const end = new Date(start);
  if (period === 'monthly') {
    end.setDate(start.getDate() + daysInMonth(start) - 1);
  } else if (period === 'yearly') {
    end.setMonth(11, 31);
  } else {
    end.setDate(start.getDate() + 6);
  }
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function daysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function getReportSummary(tasks) {
  return {
    total: tasks.length,
    open: tasks.filter((task) => task.status !== 'Closed').length,
    closed: tasks.filter((task) => task.status === 'Closed').length,
    overdue: tasks.filter(isTaskOverdue).length,
  };
}

function renderReportChart(tasks) {
  const statusCounts = taskStatuses.map((status) => ({ status, count: tasks.filter((task) => task.status === status).length }));
  if (!tasks.length) return emptyState('No report data', 'Adjust the filters or add tasks due in this reporting period.');
  if (appState.reportFilters.chartType === 'bar') {
    const maxCount = Math.max(1, ...statusCounts.map((item) => item.count));
    return `<div class="report-chart bar-chart">${statusCounts.map((item) => `
      <div class="bar-row">
        <span>${escapeHtml(item.status)}</span>
        <div class="bar-track"><strong style="width:${Math.max(10, (item.count / maxCount) * 100)}%">${item.count}</strong></div>
      </div>
    `).join('')}</div>`;
  }

  const totalTasks = Math.max(1, tasks.length);
  const upcomingDeg = (statusCounts[0].count / totalTasks) * 360;
  const progressDeg = upcomingDeg + (statusCounts[1].count / totalTasks) * 360;
  return `<div class="donut-card report-chart">
    <div class="donut" style="--upcoming-deg:${upcomingDeg}deg; --progress-deg:${progressDeg}deg"></div>
    <div class="legend">${statusCounts.map((item) => `<span><i class="legend-dot ${item.status.toLowerCase().replace(' ', '-')}"></i>${item.status}: ${item.count}</span>`).join('')}</div>
  </div>`;
}

function renderReportTable(tasks) {
  if (!tasks.length) return emptyState('No tasks found', 'The current report filters do not match any task records.');
  return `
    <div class="report-table-wrap">
      <table class="report-table">
        <thead><tr><th>Task</th><th>Assignee</th><th>Status</th><th>Priority</th><th>Due Date</th><th>Overdue</th></tr></thead>
        <tbody>${tasks.map((task) => {
          const assignee = appState.users.find((user) => user.id === task.assigneeId);
          return `<tr>
            <td>${escapeHtml(task.title)}</td>
            <td>${escapeHtml(assignee?.name ?? 'Unassigned')}</td>
            <td>${escapeHtml(task.status)}</td>
            <td>${escapeHtml(task.priority)}</td>
            <td>${formatDate(task.dueDate)}</td>
            <td>${isTaskOverdue(task) ? 'Yes' : 'No'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>
  `;
}

function renderTaskForm() {
  const draft = appState.taskDraft;
  const selectedInactiveAssignee = appState.users.find((user) => user.id === draft.assigneeId && !user.active);
  const assigneeUsers = selectedInactiveAssignee ? [...getActiveUsers(), selectedInactiveAssignee] : getActiveUsers();
  const assigneeOptions = `<option value="">Unassigned</option>${assigneeUsers.map((user) => `<option value="${escapeAttr(user.id)}" ${user.id === draft.assigneeId ? 'selected' : ''}>${escapeHtml(user.name)}${user.active ? '' : ' (Inactive)'}</option>`).join('')}`;
  const assigneeControl = isCurrentUserAdmin() ? `<label>Assignee<select name="assigneeId">${assigneeOptions}</select></label>` : `<label>Assignee<select name="assigneeId" disabled>${assigneeOptions}</select></label>`;
  return `
    <form class="form-grid" data-form="task">
      <label>Title<input name="title" value="${escapeAttr(draft.title)}" placeholder="Task title" /></label>
      ${assigneeControl}
      <label>Due Date<input name="dueDate" type="date" value="${escapeAttr(draft.dueDate)}" /></label>
      <label>Priority<select name="priority">${priorities.map((priority) => `<option ${priority === draft.priority ? 'selected' : ''}>${priority}</option>`).join('')}</select></label>
      ${appState.editingTaskId ? `<label>Status<select name="status">${taskStatuses.map((status) => `<option ${status === draft.status ? 'selected' : ''}>${status}</option>`).join('')}</select></label>` : ''}
      <label class="full">Description<textarea name="description" placeholder="Describe what needs to be done" rows="4">${escapeHtml(draft.description)}</textarea></label>
      <div class="form-actions">
        <button class="primary" type="submit">➕ ${appState.editingTaskId ? 'Save Task' : 'Create Task'}</button>
        ${appState.editingTaskId ? '<button class="ghost" type="button" data-action="cancel-task">Cancel</button>' : ''}
      </div>
    </form>
  `;
}

function renderTaskBoard(tasks, compact = false) {
  if (!tasks.length) return emptyState('No tasks found', 'Create or assign tasks to see them here.');
  return `<div class="task-grid ${compact ? 'compact' : ''}">${tasks.map((task) => renderTaskCard(task, compact)).join('')}</div>`;
}

function renderTaskCard(task, compact = false) {
  const assignee = appState.users.find((user) => user.id === task.assigneeId);
  const statusClass = task.status.toLowerCase().replace(' ', '-');
  const overdue = isTaskOverdue(task);
  const actions = renderTaskActions(task);
  return `
    <article class="task-card">
      <div class="task-top"><span class="status ${statusClass}">${task.status}</span><span class="priority ${task.priority.toLowerCase()}">${task.priority}</span>${overdue ? '<span class="pill overdue">Overdue</span>' : ''}</div>
      <h3>${escapeHtml(task.title)}</h3>
      <p>${escapeHtml(task.description)}</p>
      <div class="task-meta"><span>👤 ${escapeHtml(assignee?.name ?? 'Unassigned')}</span><span>📅 ${formatDate(task.dueDate)}</span></div>
      ${actions}
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
    resetTaskForm(false);
    render();
  });
  root.querySelectorAll('[data-filter]').forEach((element) => {
    element.addEventListener('change', (event) => {
      appState.filters[event.target.dataset.filter] = event.target.value;
      render();
    });
  });
  root.querySelectorAll('[data-report-filter]').forEach((element) => {
    element.addEventListener('change', (event) => {
      appState.reportFilters[event.target.dataset.reportFilter] = event.target.value;
      render();
    });
  });
  root.querySelector('[data-form="user"]')?.addEventListener('submit', saveUser);
  root.querySelector('[data-form="task"]')?.addEventListener('submit', saveTask);
}

function handleAction(event) {
  const actionElement = event.currentTarget;
  const action = actionElement.dataset.action;
  const id = actionElement.dataset.id;
  if (action === 'tab') {
    const requestedTab = actionElement.dataset.tab;
    if (!canViewTab(requestedTab)) return showToast('This area is available only for the admin.');
    appState.activeTab = requestedTab;
    render();
  }
  if (action === 'cancel-user') resetUserForm();
  if (action === 'cancel-task') resetTaskForm();
  if (action === 'edit-user' && isCurrentUserAdmin()) editUser(id);
  if (action === 'delete-user' && isCurrentUserAdmin()) deleteUser(id);
  if (action === 'edit-task') editTask(id);
  if (action === 'delete-task') deleteTask(id);
  if (action === 'status') updateTaskStatus(id, actionElement.dataset.status);
  if (action === 'dismiss-notification') dismissNotification(id);
  if (action === 'export-report') exportReport(actionElement.dataset.format);
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
  const existingUser = appState.users.find((user) => user.id === appState.editingUserId);
  const reassignableTasks = existingUser && existingUser.active && !draft.active ? getReassignableTasksForUser(existingUser.id) : [];
  const restorableNotifications = existingUser && !existingUser.active && draft.active ? getInactiveTaskNotificationsForUser(existingUser.id) : [];
  const restorableTaskIds = new Set(restorableNotifications.flatMap((notification) => notification.taskIds));
  const restorableTaskCount = appState.tasks.filter((task) => restorableTaskIds.has(task.id) && !task.assigneeId && task.status !== 'Closed').length;
  appState.confirmation = {
    title: appState.editingUserId ? 'Save User Changes?' : 'Create New User?',
    message: appState.editingUserId && reassignableTasks.length
      ? `Update ${draft.name}'s details? ${reassignableTasks.length} open task(s) will be unassigned and the admin will be notified to reassign them. Closed tasks will stay assigned.`
      : appState.editingUserId && restorableNotifications.length
        ? `Update ${draft.name}'s details? ${restorableTaskCount} task(s) still unassigned from the inactive period will be assigned back to this user. Tasks already reassigned to someone else will stay there.`
      : appState.editingUserId ? `Update ${draft.name}'s details?` : `Add ${draft.name} to the Users Master?`,
    confirmLabel: appState.editingUserId ? 'Save Changes' : 'Create User',
    onConfirm: () => {
      if (appState.editingUserId) {
        appState.users = appState.users.map((user) => user.id === appState.editingUserId ? { ...user, ...draft, id: user.id } : user);
        if (reassignableTasks.length) {
          const now = new Date().toISOString();
          appState.tasks = appState.tasks.map((task) => task.assigneeId === appState.editingUserId && task.status !== 'Closed' ? { ...task, assigneeId: '', updatedAt: now } : task);
          addAdminNotification(`${draft.name} was marked inactive. ${reassignableTasks.length} open task(s) are now unassigned and need reassignment.`, {
            type: 'inactive-user-tasks',
            userId: appState.editingUserId,
            taskIds: reassignableTasks.map((task) => task.id),
          });
          if (appState.currentUserId === appState.editingUserId) appState.currentUserId = appState.users.find((item) => item.active)?.id ?? appState.users[0]?.id ?? '';
          showToast('User updated. Open tasks were unassigned for admin reassignment.', false);
        } else if (restorableNotifications.length) {
          const restoredCount = restoreInactiveUserTasks(appState.editingUserId);
          showToast(restoredCount ? `${restoredCount} unassigned task(s) restored to ${draft.name}.` : 'User updated. Previous reassignment notification was cleared.', false);
        } else {
          showToast('User updated successfully.', false);
        }
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

function dismissNotification(id) {
  appState.adminNotifications = appState.adminNotifications.map((notification) => (
    notification.id === id ? { ...notification, read: true } : notification
  ));
  persist();
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
  const assignedCount = getReassignableTasksForUser(user.id).length;
  appState.confirmation = {
    title: 'Delete User?',
    message: assignedCount ? `${user.name} has ${assignedCount} open task(s). Delete anyway and unassign those tasks?` : `Delete ${user.name} from Users Master?`,
    confirmLabel: 'Delete User',
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
    assigneeId: isCurrentUserAdmin() ? String(formData.get('assigneeId') ?? '') : existing?.assigneeId ?? appState.currentUserId,
    status: appState.editingTaskId ? String(formData.get('status') ?? existing?.status ?? 'Upcoming') : 'Upcoming',
    createdAt: existing?.createdAt ?? '',
    updatedAt: existing?.updatedAt ?? '',
  };
  if (!isCurrentUserAdmin() && (!existing || !canManageTask(existing, 'edit'))) return showToast('You can edit only your assigned tasks.');
  if (!draft.title || !draft.description || !draft.dueDate) return showToast('Please complete task title, description, and due date. Assignee can remain unassigned.');
  const assignedUser = appState.users.find((user) => user.id === draft.assigneeId);
  if (assignedUser && !assignedUser.active && draft.status !== 'Closed') return showToast('Inactive users can be assigned only to closed tasks.');
  appState.confirmation = {
    title: appState.editingTaskId ? 'Save Task Changes?' : 'Create Task?',
    message: appState.editingTaskId ? `Update “${draft.title}” in Tasks Hub?` : `Add “${draft.title}” to upcoming tasks?`,
    confirmLabel: appState.editingTaskId ? 'Save Task' : 'Create Task',
    onConfirm: () => {
      const now = new Date().toISOString();
      if (appState.editingTaskId) {
        appState.tasks = appState.tasks.map((task) => task.id === appState.editingTaskId ? { ...task, ...draft, id: task.id, createdAt: task.createdAt, updatedAt: now } : task);
        refreshInactiveTaskNotifications();
        showToast('Task updated successfully.', false);
      } else {
        appState.tasks = [...appState.tasks, { ...draft, id: createId('t'), status: 'Upcoming', createdAt: now, updatedAt: now }];
        refreshInactiveTaskNotifications();
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
  if (!canManageTask(task, 'edit')) return showToast('You can edit only your assigned tasks.');
  appState.taskDraft = { ...task };
  appState.editingTaskId = task.id;
  appState.activeTab = 'hub';
  render();
}

function deleteTask(id) {
  const task = appState.tasks.find((item) => item.id === id);
  if (!task) return;
  if (!isCurrentUserAdmin()) return showToast('Only the admin can delete tasks.');
  appState.confirmation = {
    title: 'Delete Task?',
    message: `Permanently remove “${task.title}” from Tasks Hub?`,
    confirmLabel: 'Delete Task',
    danger: true,
    onConfirm: () => {
      appState.tasks = appState.tasks.filter((item) => item.id !== task.id);
      refreshInactiveTaskNotifications();
      if (appState.editingTaskId === task.id) resetTaskForm(false);
      showToast('Task deleted.', false);
    },
  };
  render();
}

function updateTaskStatus(id, status) {
  const task = appState.tasks.find((item) => item.id === id);
  if (!task) return;
  if (!canManageTask(task, 'status')) return showToast('You can start or close only your assigned tasks.');
  appState.confirmation = {
    title: status === 'In Progress' ? 'Start Task?' : 'Close Task?',
    message: `Do you want to ${status === 'In Progress' ? 'start' : 'close'} “${task.title}”? This will update the status everywhere.`,
    confirmLabel: status === 'In Progress' ? 'Start Task' : 'Close Task and mark as done',
    onConfirm: () => {
      appState.tasks = appState.tasks.map((item) => item.id === task.id ? { ...item, status, updatedAt: new Date().toISOString() } : item);
      refreshInactiveTaskNotifications();
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

function exportReport(format) {
  if (!isCurrentUserAdmin()) return showToast('Reports are available only for the admin.');
  const tasks = getReportTasks();
  if (!tasks.length) return showToast('No report data to export.');

  const reportName = appState.reportFilters.period === 'weekly' ? 'Weekly Report' : (appState.reportFilters.period === 'monthly' ? 'Monthly Report' : 'Yearly Report');
  const fileBase = `${reportName.toLowerCase().replaceAll(' ', '-')}-${new Date().toISOString().slice(0, 10)}`;
  const tableHtml = buildReportExportTable(tasks);
  if (format === 'excel') {
    downloadTextFile(`${fileBase}.xls`, `application/vnd.ms-excel`, `<html><body>${tableHtml}</body></html>`);
    return showToast('Excel report exported.', false);
  }
  if (format === 'word') {
    downloadTextFile(`${fileBase}.doc`, 'application/msword', `<html><body><h1>${escapeHtml(reportName)}</h1>${tableHtml}</body></html>`);
    return showToast('Word report exported.', false);
  }
  if (format === 'pdf') {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return showToast('Allow pop-ups to export PDF.');
    printWindow.document.write(`<html><head><title>${escapeHtml(reportName)}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#172033}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}th{background:#eef2ff}</style></head><body><h1>${escapeHtml(reportName)}</h1>${tableHtml}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    return showToast('PDF export opened in print view.', false);
  }
  return showToast('Unsupported export format.');
}

function buildReportExportTable(tasks) {
  const rows = tasks.map((task) => {
    const assignee = appState.users.find((user) => user.id === task.assigneeId);
    return `<tr><td>${escapeHtml(task.title)}</td><td>${escapeHtml(assignee?.name ?? 'Unassigned')}</td><td>${escapeHtml(task.status)}</td><td>${escapeHtml(task.priority)}</td><td>${formatDate(task.dueDate)}</td><td>${isTaskOverdue(task) ? 'Yes' : 'No'}</td><td>${escapeHtml(task.description)}</td></tr>`;
  }).join('');
  return `<table><thead><tr><th>Task</th><th>Assignee</th><th>Status</th><th>Priority</th><th>Due Date</th><th>Overdue</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function downloadTextFile(filename, type, content) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
