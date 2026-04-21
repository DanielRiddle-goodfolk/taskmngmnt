// ── Business brand colors (GoodFolk palette) ───────────────
const BIZ_COLORS = {
  'Good Folk':   { bg:'#E8F0EC', border:'#BBCEC2', text:'#2D5045' },
  '714':         { bg:'#F5E8E8', border:'#A14A4F', text:'#7a2730' },
  'Riddle & Co': { bg:'#ECEAE8', border:'#404040', text:'#2a2a2a' },
  '_default':    { bg:'#F0EDEA', border:'#9A9490', text:'#5a5550' },
};
function bizColor(n){ return BIZ_COLORS[n] || BIZ_COLORS['_default']; }

// ── State ──────────────────────────────────────────────────
let tasks        = [];
let PEOPLE       = [];
let BUSINESSES   = [];
let currentTab   = 'active';
let filterPerson   = null;
let filterBusiness = null;
let activePicker   = null;
let formOpen  = false;
let detailOpen = false;
let detailTaskId = null;
let pollTimer = null;
let formPersonIds = [];
let editPersonIds = [];

// ── DOM ────────────────────────────────────────────────────
const mainEl       = document.getElementById('main');
const taskListEl   = document.getElementById('task-list');
const filterStrip  = document.getElementById('filter-strip');
const picker       = document.getElementById('filter-picker');
const pickerTitle  = document.getElementById('picker-title');
const pickerOpts   = document.getElementById('picker-options');
const btnPeople    = document.getElementById('btn-people');
const btnBusiness  = document.getElementById('btn-business');
const fab          = document.getElementById('fab');
const taskSheet    = document.getElementById('task-sheet');
const detailSheet  = document.getElementById('detail-sheet');
const detailContent= document.getElementById('detail-content');
const backdrop     = document.getElementById('backdrop');
const taskForm     = document.getElementById('task-form');
const fName        = document.getElementById('f-name');
const fBiz         = document.getElementById('f-biz');
const fPersonWrap  = document.getElementById('f-person-wrap');
const fDate        = document.getElementById('f-date');
const fNotes       = document.getElementById('f-notes');
const fSubmit      = document.getElementById('f-submit');

// ── Init ───────────────────────────────────────────────────
function setHeaderHeight(){
  const h = document.getElementById('header').offsetHeight;
  document.documentElement.style.setProperty('--head-h', h+'px');
}
setHeaderHeight();
window.addEventListener('resize', setHeaderHeight);

async function init() {
  taskListEl.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading tasks…</p></div>';
  await Promise.all([loadPeople(), loadBusinesses()]);
  await loadTasks();
  pollTimer = setInterval(loadTasks, 12000);
}

// ── API calls ──────────────────────────────────────────────
async function loadTasks() {
  try {
    const res = await fetch('/.netlify/functions/get-tasks');
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    tasks = data.tasks || data;
    render();
  } catch(err) {
    console.error('loadTasks:', err);
    if (!tasks.length) taskListEl.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Could not load tasks</p></div>';
  }
}

async function loadPeople() {
  try {
    const res = await fetch('/.netlify/functions/get-users');
    if (!res.ok) return;
    const data = await res.json();
    PEOPLE = data.users || data;
    renderFormPersonPicker();
  } catch(err) { console.warn('loadPeople:', err); }
}

// ── Person multi-select pickers ────────────────────────────
function renderFormPersonPicker() {
  if (!fPersonWrap) return;
  fPersonWrap.innerHTML = PEOPLE.map(p => {
    const sel = formPersonIds.includes(p.id);
    return `<button type="button" class="pick-person ${sel?'selected':''}" onclick="toggleFormPerson('${esc(p.id)}')">
      <span class="pick-avatar" style="width:36px;height:36px;font-size:.72rem">${ini(p.name)}</span>
      <span class="pick-name">${esc(p.name)}</span>
    </button>`;
  }).join('');
}
function toggleFormPerson(id) {
  const i = formPersonIds.indexOf(id);
  if (i > -1) formPersonIds.splice(i, 1); else formPersonIds.push(id);
  renderFormPersonPicker();
}
window.toggleFormPerson = toggleFormPerson;

function renderEditPersonPicker() {
  const wrap = document.getElementById('e-person-wrap');
  if (!wrap) return;
  wrap.innerHTML = PEOPLE.map(p => {
    const sel = editPersonIds.includes(p.id);
    return `<button type="button" class="pick-person ${sel?'selected':''}" onclick="toggleEditPerson('${esc(p.id)}')">
      <span class="pick-avatar" style="width:36px;height:36px;font-size:.72rem">${ini(p.name)}</span>
      <span class="pick-name">${esc(p.name)}</span>
    </button>`;
  }).join('');
}
function toggleEditPerson(id) {
  const i = editPersonIds.indexOf(id);
  if (i > -1) editPersonIds.splice(i, 1); else editPersonIds.push(id);
  renderEditPersonPicker();
}
window.toggleEditPerson = toggleEditPerson;

async function loadBusinesses() {
  try {
    const res = await fetch('/.netlify/functions/get-entities');
    if (!res.ok) return;
    const data = await res.json();
    const raw = data.entities || data;
    BUSINESSES = raw.map(e => (typeof e === 'string' ? e : e.name));
    fBiz.innerHTML = '<option value="">None</option>' +
      BUSINESSES.map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join('');
  } catch(err) { console.warn('loadBusinesses:', err); }
}

async function callUpdateTask(payload) {
  const res = await fetch('/.netlify/functions/update-task', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
}

// ── Tab switching ──────────────────────────────────────────
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  render();
}
window.switchTab = switchTab;

// ── Render ─────────────────────────────────────────────────
function render() {
  let base = tasks.filter(t => {
    if (currentTab === 'active')   return (t.statusGroup === 'To-do' || t.statusGroup === 'In progress') && t.status !== 'Needs Feedback';
    if (currentTab === 'feedback') return t.status === 'Needs Feedback';
    if (currentTab === 'archive')  return t.statusGroup === 'Complete';
    return true;
  });
  const filtered = base.filter(t => {
    if (filterPerson   && !t.person.some(p=>p.id===filterPerson)) return false;
    if (filterBusiness && t.entity !== filterBusiness)             return false;
    return true;
  });

  renderFilterStrip();
  if (activePicker) renderPickerOpts(activePicker);

  if (!filtered.length) {
    const labels = {active:'active tasks',feedback:'tasks needing feedback',archive:'archived tasks'};
    taskListEl.innerHTML=`<div class="empty-state"><div class="empty-icon">📋</div><p>No ${labels[currentTab]} here</p></div>`;
    return;
  }

  if (!filterBusiness) {
    const groupOrder = [];
    const groups = {};
    filtered.forEach(t => {
      const key = t.entity || '—';
      if (!groups[key]) { groups[key] = []; groupOrder.push(key); }
      groups[key].push(t);
    });
    taskListEl.innerHTML = groupOrder.map(biz => {
      const c = bizColor(biz);
      const cnt = groups[biz].length;
      const head = `<div class="biz-group-head" style="border-left:4px solid ${c.border};background:${c.bg}">
        <span class="biz-group-name" style="color:${c.text}">${esc(biz)}</span>
        <span class="biz-group-count" style="color:${c.text}">${cnt} task${cnt!==1?'s':''}</span>
      </div>`;
      return head + groups[biz].map(cardHTML).join('');
    }).join('');
  } else {
    taskListEl.innerHTML = filtered.map(cardHTML).join('');
  }
}

function cardHTML(t) {
  const skMap = {'Not started':'not-started','In progress':'in-progress','Done':'done','Needs Feedback':'needs-feedback'};
  const groupMap = {'To-do':'not-started','In progress':'in-progress','Complete':'done'};
  const sk = skMap[t.status] || groupMap[t.statusGroup] || 'not-started';
  const done = t.status === 'Done';
  const persons = t.person.length
    ? t.person.map(p=>`<span class="avatar">${ini(p.name)}</span>`).join('')
    : `<span class="avatar none">–</span>`;
  const pName = t.person.length ? `<span class="person-name">${esc(t.person[0].name)}</span>` : '';
  const biz   = t.entity ? `<span class="biz-tag">${esc(t.entity)}</span>` : '';
  const due   = t.dueDate ? `<span class="due ${pastDue(t.dueDate)&&!done?'overdue':''}">📅 ${fmtDate(t.dueDate)}</span>` : '';
  const notes = t.notes ? `<div class="card-notes">${esc(t.notes)}</div>` : '';
  return `<div class="task-card ${done?'done':''}" onclick="openDetail('${esc(t.id)}')">
    <div class="card-top">
      <span class="task-name">${esc(t.taskName)}</span>
      <span class="status-badge s-${sk}">${esc(t.status)}</span>
    </div>
    <div class="card-meta">${persons}${pName}${biz}${due}</div>
    ${notes}
  </div>`;
}

// ── Detail view ────────────────────────────────────────────
function openDetail(id) {
  if (formOpen) return;
  const t = tasks.find(x=>x.id===id);
  if (!t) return;
  detailTaskId = id;
  const skMap = {'Not started':'not-started','In progress':'in-progress','Done':'done','Needs Feedback':'needs-feedback'};
  const sk = skMap[t.status] || 'not-started';
  const persons = t.person.length
    ? t.person.map(p=>`<span class="avatar" style="width:28px;height:28px;font-size:.75rem">${ini(p.name)}</span> <span style="font-size:.88rem;font-weight:500">${esc(p.name)}</span>`).join(', ')
    : `<span style="color:var(--muted);font-size:.88rem">Unassigned</span>`;
  const due = t.dueDate
    ? `<span class="${pastDue(t.dueDate)&&t.status!=='Done'?'due overdue':'due'}">${fmtDate(t.dueDate)}</span>`
    : `<span style="color:var(--muted);font-size:.85rem">No date</span>`;
  detailContent.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;margin-bottom:.5rem">
      <h2 class="sheet-title" style="margin-bottom:0;flex:1">${esc(t.taskName)}</h2>
      <button onclick="openEditMode('${esc(t.id)}')" style="flex-shrink:0;padding:.35rem .75rem;background:var(--dust);color:var(--charcoal);border:1.5px solid var(--border);border-radius:8px;font-size:.78rem;font-weight:600;font-family:var(--font);cursor:pointer;margin-top:.15rem">Edit</button>
    </div>
    <div style="margin-bottom:1rem"><span class="status-badge s-${sk}">${esc(t.status)}</span></div>
    <div class="detail-divider" style="margin-top:.25rem"></div>
    <div class="detail-meta-item">
      <span class="detail-meta-label">Assigned</span>
      <div style="display:flex;align-items:center;gap:.4rem">${persons}</div>
    </div>
    <div class="detail-meta-item">
      <span class="detail-meta-label">Business</span>
      ${t.entity ? `<span class="biz-tag">${esc(t.entity)}</span>` : `<span style="color:var(--muted);font-size:.85rem">—</span>`}
    </div>
    <div class="detail-meta-item">
      <span class="detail-meta-label">Due Date</span>${due}
    </div>
    <div class="detail-divider"></div>
    <span class="detail-notes-label">Notes</span>
    <textarea id="detail-notes" style="width:100%;padding:.65rem .8rem;border:1.5px solid var(--border);border-radius:10px;font-size:.93rem;font-family:var(--font);color:var(--black);background:var(--white);outline:none;resize:none;min-height:110px;line-height:1.55;-webkit-appearance:none;transition:border-color .15s"
      placeholder="Add notes…">${esc(t.notes)}</textarea>
    <button class="btn-save" id="detail-save-btn" style="margin-top:.75rem" onclick="saveNotes('${esc(t.id)}')">Save Notes</button>
  `;
  const ta = document.getElementById('detail-notes');
  if (ta) {
    ta.addEventListener('focus', ()=>{ ta.style.borderColor='var(--mint-dark)'; ta.style.boxShadow='0 0 0 3px rgba(139,173,159,.18)'; });
    ta.addEventListener('blur',  ()=>{ ta.style.borderColor='var(--border)'; ta.style.boxShadow='none'; });
  }
  detailOpen = true;
  detailSheet.classList.add('open');
  backdrop.classList.add('show');
}
window.openDetail = openDetail;

// ── Edit mode ──────────────────────────────────────────────
function openEditMode(id) {
  const t = tasks.find(x=>x.id===id);
  if (!t) return;
  editPersonIds = t.person.map(p=>p.id);
  const bizOpts = BUSINESSES.map(b =>
    `<option value="${esc(b)}" ${t.entity===b?'selected':''}>${esc(b)}</option>`
  ).join('');
  detailContent.innerHTML = `
    <h2 class="sheet-title">Edit Task</h2>
    <div class="field">
      <label>Task Name</label>
      <input type="text" id="e-name" value="${esc(t.taskName)}" autocomplete="off"/>
    </div>
    <div class="field">
      <label>Business</label>
      <select id="e-biz"><option value="">None</option>${bizOpts}</select>
    </div>
    <div class="field">
      <label>Assign To</label>
      <div id="e-person-wrap" style="display:flex;gap:.35rem;flex-wrap:wrap;min-height:48px;align-items:center;padding:.1rem 0"></div>
    </div>
    <div class="field">
      <label>Due Date</label>
      <input type="date" id="e-date" value="${t.dueDate||''}"/>
    </div>
    <div class="field">
      <label>Notes</label>
      <textarea id="e-notes" rows="3">${esc(t.notes)}</textarea>
    </div>
    <button class="btn-save apple" id="e-submit" onclick="saveEdit('${esc(t.id)}')">Save Changes</button>
    <button onclick="openDetail('${esc(t.id)}')" style="width:100%;padding:.7rem;margin-top:.5rem;background:none;color:var(--muted);border:1.5px solid var(--border);border-radius:12px;font-size:.9rem;font-weight:600;font-family:var(--font);cursor:pointer">Cancel</button>
  `;
  renderEditPersonPicker();
  detailContent.querySelectorAll('input, select, textarea').forEach(el => {
    el.addEventListener('focus', ()=>{ el.style.borderColor='var(--mint-dark)'; el.style.boxShadow='0 0 0 3px rgba(139,173,159,.18)'; });
    el.addEventListener('blur',  ()=>{ el.style.borderColor=''; el.style.boxShadow=''; });
  });
  setTimeout(()=>document.getElementById('e-name')?.focus(), 100);
}
window.openEditMode = openEditMode;

async function saveEdit(id) {
  const nameEl  = document.getElementById('e-name');
  const bizEl   = document.getElementById('e-biz');
  const dateEl  = document.getElementById('e-date');
  const notesEl = document.getElementById('e-notes');
  const btn     = document.getElementById('e-submit');
  const taskName = nameEl?.value.trim();
  if (!taskName) { nameEl?.focus(); return; }
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    await callUpdateTask({
      id,
      taskName,
      entity:    bizEl.value  || '',
      dueDate:   dateEl.value || '',
      notes:     notesEl.value.trim(),
      personIds: [...editPersonIds],
    });
    // Update local state
    const t = tasks.find(x=>x.id===id);
    if (t) {
      t.taskName = taskName;
      t.entity   = bizEl.value || '';
      t.dueDate  = dateEl.value || null;
      t.notes    = notesEl.value.trim();
      t.person   = editPersonIds.map(pid => {
        const p = PEOPLE.find(x=>x.id===pid);
        return p ? { id: p.id, name: p.name } : null;
      }).filter(Boolean);
      render();
    }
    closeDetail();
    toast('Task updated ✓');
  } catch(err) {
    btn.disabled = false;
    btn.textContent = 'Save Changes';
    toast('Save failed — try again');
    console.error(err);
  }
}
window.saveEdit = saveEdit;

async function saveNotes(id) {
  const ta  = document.getElementById('detail-notes');
  const btn = document.getElementById('detail-save-btn');
  if (!ta) return;
  const newNotes = ta.value.trim();
  const t = tasks.find(x=>x.id===id);
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    await callUpdateTask({ id, notes: newNotes });
    if (t) { t.notes = newNotes; render(); }
    closeDetail();
    toast('Notes saved ✓');
  } catch(err) {
    btn.disabled = false;
    btn.textContent = 'Save Notes';
    toast('Save failed — try again');
    console.error(err);
  }
}
window.saveNotes = saveNotes;

function closeDetail() {
  detailOpen = false;
  detailTaskId = null;
  detailSheet.classList.remove('open');
  backdrop.classList.remove('show');
}

// ── Filter strip ───────────────────────────────────────────
function renderFilterStrip() {
  const chips = [];
  if (filterPerson)   { const p=PEOPLE.find(x=>x.id===filterPerson); chips.push(`<button class="chip" onclick="clearFilter('person')">${esc(p?p.name:'?')} <span class="chip-x">✕</span></button>`); }
  if (filterBusiness) { chips.push(`<button class="chip" onclick="clearFilter('business')">${esc(filterBusiness)} <span class="chip-x">✕</span></button>`); }
  filterStrip.innerHTML = chips.join('');
  const has = !!(filterPerson||filterBusiness);
  filterStrip.classList.toggle('on', has);
  mainEl.classList.toggle('strip-on', has);
}
function clearFilter(type) {
  if(type==='person')   filterPerson=null;
  if(type==='business') filterBusiness=null;
  btnPeople.classList.toggle('filtered',   !!filterPerson);
  btnBusiness.classList.toggle('filtered', !!filterBusiness);
  render();
}
window.clearFilter = clearFilter;

// ── Filter picker ──────────────────────────────────────────
btnPeople.addEventListener('click',   ()=>togglePicker('people'));
btnBusiness.addEventListener('click', ()=>togglePicker('business'));

function togglePicker(type) {
  if (formOpen || detailOpen) return;
  if (activePicker===type) { closePicker(); return; }
  activePicker = type;
  btnPeople.classList.toggle('active', type==='people');
  btnBusiness.classList.toggle('active', type==='business');
  pickerTitle.textContent = type==='people' ? 'Filter by Person' : 'Filter by Business';
  renderPickerOpts(type);
  picker.classList.add('open');
}
function closePicker() {
  activePicker=null;
  picker.classList.remove('open');
  btnPeople.classList.remove('active');
  btnBusiness.classList.remove('active');
}
function renderPickerOpts(type) {
  if (type==='people') {
    pickerOpts.innerHTML =
      `<button class="pick-person ${!filterPerson?'selected':''}" onclick="selectPerson(null)"><span class="pick-avatar all-icon">👥</span><span class="pick-name">All</span></button>` +
      PEOPLE.map(p=>`<button class="pick-person ${filterPerson===p.id?'selected':''}" onclick="selectPerson('${esc(p.id)}')"><span class="pick-avatar">${ini(p.name)}</span><span class="pick-name">${esc(p.name)}</span></button>`).join('');
  } else {
    pickerOpts.innerHTML =
      `<button class="pick-biz all ${!filterBusiness?'selected':''}" onclick="selectBusiness(null)">All</button>` +
      BUSINESSES.map(b=>`<button class="pick-biz ${filterBusiness===b?'selected':''}" onclick="selectBusiness('${b.replace(/'/g,"\\'")}')"> ${esc(b)}</button>`).join('');
  }
}
function selectPerson(id)  { filterPerson=id;  btnPeople.classList.toggle('filtered',!!id);  closePicker(); render(); }
function selectBusiness(n) { filterBusiness=n; btnBusiness.classList.toggle('filtered',!!n); closePicker(); render(); }
window.selectPerson   = selectPerson;
window.selectBusiness = selectBusiness;

// ── FAB / Form sheet ───────────────────────────────────────
fab.addEventListener('click', ()=>{
  if (activePicker) { closePicker(); return; }
  if (detailOpen)   { closeDetail(); return; }
  formOpen ? closeForm() : openForm();
});
function openForm() {
  formOpen=true;
  taskSheet.classList.add('open');
  backdrop.classList.add('show');
  fab.classList.add('open');
  setTimeout(()=>fName.focus(), 350);
}
function closeForm() {
  formOpen=false;
  taskSheet.classList.remove('open');
  backdrop.classList.remove('show');
  fab.classList.remove('open');
  taskForm.reset();
  formPersonIds = [];
  renderFormPersonPicker();
  fSubmit.disabled=false;
  fSubmit.textContent='Add Task';
}
backdrop.addEventListener('click', ()=>{ closePicker(); if(formOpen) closeForm(); if(detailOpen) closeDetail(); });

taskForm.addEventListener('submit', async e=>{
  e.preventDefault();
  const name = fName.value.trim();
  if (!name) { fName.focus(); return; }
  fSubmit.disabled=true;
  fSubmit.textContent='Adding…';
  try {
    const personIds = [...formPersonIds];
    const body = { taskName: name, entity: fBiz.value||'', dueDate: fDate.value||'', notes: fNotes.value.trim(), personIds };
    const res = await fetch('/.netlify/functions/create-task', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    if (!res.ok) throw new Error((await res.json()).error || res.statusText);
    closeForm();
    await loadTasks();
    if (currentTab !== 'active') switchTab('active');
    toast('Task added ✓');
  } catch(err) {
    fSubmit.disabled=false;
    fSubmit.textContent='Add Task';
    toast('Could not add task');
    console.error(err);
  }
});

// ── Toast ──────────────────────────────────────────────────
function toast(msg) {
  const t=document.createElement('div');
  t.style.cssText='position:fixed;bottom:calc(82px + var(--safe-b));left:50%;transform:translateX(-50%) translateY(8px);background:var(--charcoal);color:#fff;padding:.55rem 1.1rem;border-radius:30px;font-size:.82rem;font-weight:600;z-index:500;opacity:0;transition:opacity .22s,transform .22s;white-space:nowrap;font-family:var(--font)';
  t.textContent=msg;
  document.body.appendChild(t);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{t.style.opacity='1';t.style.transform='translateX(-50%) translateY(0)'}));
  setTimeout(()=>{t.style.opacity='0';setTimeout(()=>t.remove(),250)},2600);
}

// ── Utils ──────────────────────────────────────────────────
function ini(n){return(n||'?').split(' ').slice(0,2).map(x=>x[0]||'').join('').toUpperCase()}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function fmtDate(s){const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
function pastDue(s){if(!s)return false;const[y,m,d]=s.split('-').map(Number);const n=new Date();n.setHours(0,0,0,0);return new Date(y,m-1,d)<n}

init();
