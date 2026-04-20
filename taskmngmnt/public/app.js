// ── Config ────────────────────────────────────────────────────────────────────
const POLL_MS = 12000; // poll Notion every 12 seconds

// ── State ─────────────────────────────────────────────────────────────────────
let allTasks    = [];
let allUsers    = [];
let allEntities = [];
let pollTimer   = null;
let isSubmitting = false;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const formToggle    = document.getElementById('form-toggle');
const formPanel     = document.getElementById('form-panel');
const formCancel    = document.getElementById('form-cancel');
const taskForm      = document.getElementById('task-form');
const taskNameInput = document.getElementById('task-name');
const entitySelect  = document.getElementById('entity-select');
const personSelect  = document.getElementById('person-select');
const dueDateInput  = document.getElementById('due-date');
const notesInput    = document.getElementById('notes');
const submitBtn     = document.getElementById('submit-btn');
const submitLabel   = submitBtn.querySelector('.btn-label');
const submitSpinner = submitBtn.querySelector('.btn-spinner');

const taskList    = document.getElementById('task-list');
const filterPerson = document.getElementById('filter-person');
const filterEntity = document.getElementById('filter-entity');
const filterStatus = document.getElementById('filter-status');
const clearFilters = document.getElementById('clear-filters');
const taskCount    = document.getElementById('task-count');
const lastUpdated  = document.getElementById('last-updated');
const liveDot      = document.getElementById('live-dot');

// ── Boot ──────────────────────────────────────────────────────────────────────
async function init() {
  await Promise.all([loadUsers(), loadEntities()]);
  await loadTasks();
  startPolling();
}

// ── Data fetching ─────────────────────────────────────────────────────────────
async function loadUsers() {
  try {
    const res  = await fetch('/.netlify/functions/get-users');
    const data = await res.json();
    allUsers   = data.users || [];
    populateSelect(personSelect,  allUsers,    u => u.id,   u => u.name, '— Unassigned —');
    populateSelect(filterPerson, allUsers,    u => u.id,   u => u.name, 'All People');
  } catch (e) {
    console.warn('Could not load users:', e.message);
  }
}

async function loadEntities() {
  try {
    const res  = await fetch('/.netlify/functions/get-entities');
    const data = await res.json();
    allEntities = (data.entities || []).map(e => e.name || e);
    populateSelect(entitySelect,  allEntities, e => e,   e => e, '— None —');
    populateSelect(filterEntity, allEntities, e => e,   e => e, 'All Entities');
  } catch (e) {
    console.warn('Could not load entities:', e.message);
  }
}

async function loadTasks(silent = false) {
  try {
    if (!silent) renderSkeletons();
    const res  = await fetch('/.netlify/functions/get-tasks');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allTasks   = data.tasks || [];
    setLiveStatus(true);
    updateLastUpdated();
    renderTasks();
  } catch (e) {
    console.error('Could not load tasks:', e.message);
    setLiveStatus(false);
    if (!silent) renderError();
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => loadTasks(true), POLL_MS);
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderTasks() {
  const pFilter = filterPerson.value;
  const eFilter = filterEntity.value;
  const sFilter = filterStatus.value;

  const filtered = allTasks.filter(t => {
    if (pFilter && !t.person.some(p => p.id === pFilter)) return false;
    if (eFilter && t.entity !== eFilter)                   return false;
    if (sFilter && t.status !== sFilter)                   return false;
    return true;
  });

  taskCount.textContent = filtered.length;
  clearFilters.classList.toggle('hidden', !pFilter && !eFilter && !sFilter);

  if (filtered.length === 0) {
    taskList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <p>${allTasks.length === 0 ? 'No tasks yet' : 'No tasks match these filters'}</p>
        <small>${allTasks.length === 0 ? 'Add your first task above.' : 'Try adjusting the filters.'}</small>
      </div>`;
    return;
  }

  taskList.innerHTML = filtered.map(renderCard).join('');
}

function renderCard(task) {
  const statusKey = slugify(task.status);
  const isDone    = task.status === 'Done';

  const personsHtml = task.person.length
    ? '<div class="person-badges">' + task.person.map(p => avatarHtml(p)).join('') + '</div>'
    : '<div class="person-badges">' + avatarHtml(null) + '</div>';

  const entityHtml = task.entity
    ? `<span class="entity-tag">${esc(task.entity)}</span>`
    : '';

  const dueDateHtml = task.dueDate
    ? `<span class="due-date ${isPastDue(task.dueDate) && !isDone ? 'past-due' : ''}">📅 ${fmtDate(task.dueDate)}</span>`
    : '';

  const notesHtml = task.notes
    ? `<p class="task-notes">${esc(task.notes)}</p>`
    : '';

  return `
    <div class="task-card ${isDone ? 'done' : ''}">
      <div class="task-header">
        <div class="task-title-row">
          <h3 class="task-name">${esc(task.taskName) || '<em>Untitled</em>'}</h3>
          <span class="status-badge status-${statusKey}">${esc(task.status)}</span>
        </div>
        <div class="task-meta">
          ${personsHtml}
          ${entityHtml}
          ${dueDateHtml}
        </div>
      </div>
      ${notesHtml}
      <div class="task-footer">
        <a href="${task.url}" target="_blank" rel="noopener" class="notion-link">Open in Notion ↗</a>
        <span class="created-time">${timeAgo(task.createdTime)}</span>
      </div>
    </div>`;
}

function avatarHtml(person) {
  if (!person) {
    return `<span class="avatar unassigned" title="Unassigned">?</span>`;
  }
  if (person.avatarUrl) {
    return `<span class="avatar" title="${esc(person.name)}"><img src="${esc(person.avatarUrl)}" alt="${esc(person.name)}" /></span>`;
  }
  return `<span class="avatar" title="${esc(person.name)}">${initials(person.name)}</span>`;
}

function renderSkeletons() {
  taskList.innerHTML = `
    <div class="skeleton-list">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </div>`;
}

function renderError() {
  taskList.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">⚠️</div>
      <p>Couldn't reach Notion</p>
      <small>Check your API key and database sharing settings.</small>
    </div>`;
}

// ── Form ──────────────────────────────────────────────────────────────────────
formToggle.addEventListener('click', () => {
  const open = formPanel.classList.toggle('collapsed') === false;
  formPanel.classList.toggle('collapsed', !open);
  formToggle.setAttribute('aria-expanded', String(open));
  formToggle.textContent = open ? '− Hide' : '+ Add Task';
  if (open) setTimeout(() => taskNameInput.focus(), 280);
});

formCancel.addEventListener('click', () => {
  collapseForm();
});

function collapseForm() {
  formPanel.classList.add('collapsed');
  formToggle.setAttribute('aria-expanded', 'false');
  formToggle.textContent = '+ Add Task';
  taskForm.reset();
  taskNameInput.classList.remove('error');
}

taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (isSubmitting) return;

  const name = taskNameInput.value.trim();
  if (!name) {
    taskNameInput.classList.add('error');
    taskNameInput.focus();
    return;
  }
  taskNameInput.classList.remove('error');

  isSubmitting = true;
  submitBtn.disabled = true;
  submitLabel.textContent = 'Adding…';
  submitSpinner.classList.remove('hidden');

  try {
    const payload = {
      taskName:  name,
      entity:    entitySelect.value  || null,
      dueDate:   dueDateInput.value  || null,
      notes:     notesInput.value.trim() || null,
      personIds: personSelect.value  ? [personSelect.value] : [],
    };

    const res = await fetch('/.netlify/functions/create-task', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    collapseForm();
    showToast('✓ Task added', 'success');
    await loadTasks(true);

  } catch (err) {
    console.error('create-task failed:', err.message);
    showToast('Failed to add task — ' + err.message, 'error');
  } finally {
    isSubmitting = false;
    submitBtn.disabled = false;
    submitLabel.textContent = 'Add Task';
    submitSpinner.classList.add('hidden');
  }
});

// ── Filters ───────────────────────────────────────────────────────────────────
[filterPerson, filterEntity, filterStatus].forEach(el =>
  el.addEventListener('change', renderTasks)
);

clearFilters.addEventListener('click', () => {
  filterPerson.value = '';
  filterEntity.value = '';
  filterStatus.value = '';
  renderTasks();
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function populateSelect(el, items, valueOf, labelOf, placeholder) {
  const first = el.options[0];
  el.innerHTML = '';
  const opt = document.createElement('option');
  opt.value = '';
  opt.textContent = placeholder;
  el.appendChild(opt);
  items.forEach(item => {
    const o = document.createElement('option');
    o.value       = valueOf(item);
    o.textContent = labelOf(item);
    el.appendChild(o);
  });
}

function setLiveStatus(ok) {
  liveDot.classList.toggle('error', !ok);
  liveDot.title = ok ? 'Live — polling every 12s' : 'Connection error';
}

function updateLastUpdated() {
  lastUpdated.textContent = 'Updated ' + new Date().toLocaleTimeString();
}

function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  container.appendChild(t);
  requestAnimationFrame(() => { requestAnimationFrame(() => t.classList.add('show')); });
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

function slugify(str) {
  return (str || '').toLowerCase().replace(/\s+/g, '-');
}

function initials(name) {
  return (name || '?')
    .split(' ')
    .slice(0, 2)
    .map(n => n[0] || '')
    .join('')
    .toUpperCase();
}

function fmtDate(dateStr) {
  // dateStr is YYYY-MM-DD
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function isPastDue(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const due   = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Go ────────────────────────────────────────────────────────────────────────
init();
