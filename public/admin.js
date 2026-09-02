const API = '/.netlify/functions';
const app = document.getElementById('app');
const topbarActions = document.getElementById('topbarActions');

let state = {
  token: sessionStorage.getItem('quizz_admin_token') || null,
  tab: 'sets', // sets | create | students
};

function saveToken(t) {
  state.token = t;
  sessionStorage.setItem('quizz_admin_token', t);
}
function logout() {
  state.token = null;
  sessionStorage.removeItem('quizz_admin_token');
  render();
}

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers.Authorization = 'Bearer ' + state.token;
  const res = await fetch(`${API}/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, ...data };
  return data;
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}

function render() {
  topbarActions.innerHTML = state.token ? `<button id="logoutBtn">Log out</button>` : '';
  if (!state.token) return renderLogin();
  renderHome();
  const lb = document.getElementById('logoutBtn');
  if (lb) lb.onclick = logout;
}

function renderLogin() {
  app.innerHTML = `
    <div class="card">
      <h2>Admin login</h2>
      <p class="lede">Only the person who set the admin ID and password can sign in here.</p>
      <label>Admin ID</label>
      <input id="id" type="text" />
      <label>Password</label>
      <input id="password" type="password" />
      <button class="btn-primary" id="loginBtn">Log in</button>
      <div id="msg"></div>
    </div>
  `;
  document.getElementById('loginBtn').onclick = async () => {
    const id = document.getElementById('id').value.trim();
    const password = document.getElementById('password').value;
    const msg = document.getElementById('msg');
    msg.innerHTML = '';
    try {
      const data = await api('admin-login', { method: 'POST', body: { id, password } });
      saveToken(data.token);
      render();
    } catch (e) {
      msg.innerHTML = `<div class="error-msg">${esc(e.error || 'Login failed')}</div>`;
    }
  };
}

function renderHome() {
  app.innerHTML = `
    <div class="tabs">
      <button data-tab="sets" class="${state.tab === 'sets' ? 'active' : ''}">Question Sets</button>
      <button data-tab="create" class="${state.tab === 'create' ? 'active' : ''}">+ New Set</button>
      <button data-tab="students" class="${state.tab === 'students' ? 'active' : ''}">Students</button>
    </div>
    <div id="tabBody"><div class="loading">Loading…</div></div>
  `;
  app.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { state.tab = b.dataset.tab; render(); }; });

  if (state.tab === 'sets') loadSets();
  else if (state.tab === 'create') renderCreateSet();
  else loadStudents();
}

// ---------- SETS LIST ----------
async function loadSets() {
  const body = document.getElementById('tabBody');
  try {
    const { sets } = await api('list-sets');
    body.innerHTML = `
      <div class="card">
        <button class="btn-outline btn-block" id="recomputeBtn">Recompute ranking now</button>
        <div id="recomputeMsg"></div>
      </div>
      <div class="card">
        <h2>All sets</h2>
        ${sets.length === 0 ? `<div class="empty-state">No sets yet. Create one from the "+ New Set" tab.</div>` : sets.map((s) => `
          <div class="set-row">
            <div>
              <div class="set-name">${esc(s.name)}</div>
              <div class="set-meta">${s.question_count} questions · ${new Date(s.created_at).toLocaleDateString()}</div>
            </div>
            <div style="display:flex; gap:6px;">
              <button class="btn-outline btn-sm" data-view="${s.id}">View</button>
              <button class="btn-danger btn-sm" data-del="${s.id}">Delete</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    document.getElementById('recomputeBtn').onclick = async () => {
      const m = document.getElementById('recomputeMsg');
      m.innerHTML = '<p class="lede">Recomputing…</p>';
      try {
        const r = await api('recompute-ranking');
        m.innerHTML = `<div class="ok-msg">Done — ${r.students_ranked} student(s) ranked.</div>`;
      } catch (e) {
        m.innerHTML = `<div class="error-msg">${esc(e.error || 'Failed')}</div>`;
      }
    };
    body.querySelectorAll('[data-view]').forEach((b) => { b.onclick = () => viewSet(b.dataset.view); });
    body.querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = async () => {
        if (!confirm('Delete this entire set and all its questions?')) return;
        try {
          await api('delete-set', { method: 'POST', body: { setId: b.dataset.del } });
          loadSets();
        } catch (e) {
          alert(e.error || 'Could not delete');
        }
      };
    });
  } catch (e) {
    body.innerHTML = `<div class="error-msg">${esc(e.error || 'Could not load sets')}</div>`;
  }
}

async function viewSet(setId) {
  const body = document.getElementById('tabBody');
  body.innerHTML = `<div class="loading">Loading…</div>`;
  try {
    const { set, questions } = await api(`admin-get-set?setId=${encodeURIComponent(setId)}`);
    body.innerHTML = `
      <div class="card">
        <button class="link-btn" id="backBtn">&larr; Back to all sets</button>
        <h2 style="margin-top:10px;">${esc(set.name)}</h2>
        <p class="lede">${questions.length} questions</p>
        ${questions.map((q, i) => `
          <div class="q-list-item">
            <div class="qt">${i + 1}. ${esc(q.question_text)}</div>
            <div class="qo">A. ${esc(q.option_a)} ${q.correct_option === 'A' ? '<b>&larr; correct</b>' : ''}</div>
            <div class="qo">B. ${esc(q.option_b)} ${q.correct_option === 'B' ? '<b>&larr; correct</b>' : ''}</div>
            <div class="qo">C. ${esc(q.option_c)} ${q.correct_option === 'C' ? '<b>&larr; correct</b>' : ''}</div>
            <div class="qo">D. ${esc(q.option_d)} ${q.correct_option === 'D' ? '<b>&larr; correct</b>' : ''}</div>
            <button class="btn-danger btn-sm" style="margin-top:8px;" data-delq="${q.id}">Delete this question</button>
          </div>
        `).join('')}
      </div>
    `;
    document.getElementById('backBtn').onclick = loadSets;
    body.querySelectorAll('[data-delq]').forEach((b) => {
      b.onclick = async () => {
        if (!confirm('Delete this question?')) return;
        try {
          await api('delete-question', { method: 'POST', body: { setId, questionId: b.dataset.delq } });
          viewSet(setId);
        } catch (e) {
          alert(e.error || 'Could not delete');
        }
      };
    });
  } catch (e) {
    body.innerHTML = `<div class="error-msg">${esc(e.error || 'Could not load set')}</div>`;
  }
}

// ---------- CREATE SET ----------
let draftQuestions = [];

function renderCreateSet() {
  const body = document.getElementById('tabBody');
  body.innerHTML = `
    <div class="card">
      <h2>New question set</h2>
      <label>Set name</label>
      <input id="setName" type="text" placeholder="e.g. Set 3 - General Knowledge" />
    </div>
    <div class="card">
      <h3>Questions (${draftQuestions.length} added)</h3>
      <div id="draftList"></div>
      <div class="q-add-row">
        <label>Question text</label>
        <input id="qText" type="text" placeholder="Type the question" />
        <div class="opt-grid">
          <div><label>Option A</label><input id="optA" type="text" /></div>
          <div><label>Option B</label><input id="optB" type="text" /></div>
          <div><label>Option C</label><input id="optC" type="text" /></div>
          <div><label>Option D</label><input id="optD" type="text" /></div>
        </div>
        <label>Correct answer</label>
        <div class="correct-toggle">
          <button data-c="A">A</button><button data-c="B">B</button><button data-c="C">C</button><button data-c="D">D</button>
        </div>
        <button class="btn-gold btn-block" id="addQBtn" style="margin-top:12px;">Add question to set</button>
        <div id="addMsg"></div>
      </div>
      <button class="btn-primary" id="saveSetBtn">Save set (${draftQuestions.length} questions)</button>
      <div id="saveMsg"></div>
    </div>
  `;

  let correctChoice = null;
  document.querySelectorAll('.correct-toggle button').forEach((b) => {
    b.onclick = () => {
      correctChoice = b.dataset.c;
      document.querySelectorAll('.correct-toggle button').forEach((x) => x.classList.toggle('active', x === b));
    };
  });

  drawDraftList();

  document.getElementById('addQBtn').onclick = () => {
    const q = {
      question_text: document.getElementById('qText').value.trim(),
      option_a: document.getElementById('optA').value.trim(),
      option_b: document.getElementById('optB').value.trim(),
      option_c: document.getElementById('optC').value.trim(),
      option_d: document.getElementById('optD').value.trim(),
      correct_option: correctChoice,
    };
    const msg = document.getElementById('addMsg');
    if (!q.question_text || !q.option_a || !q.option_b || !q.option_c || !q.option_d || !q.correct_option) {
      msg.innerHTML = `<div class="error-msg">Fill all fields and pick the correct answer</div>`;
      return;
    }
    draftQuestions.push(q);
    renderCreateSet();
  };

  document.getElementById('saveSetBtn').onclick = async () => {
    const name = document.getElementById('setName').value.trim();
    const msg = document.getElementById('saveMsg');
    if (!name) { msg.innerHTML = `<div class="error-msg">Give the set a name</div>`; return; }
    if (draftQuestions.length === 0) { msg.innerHTML = `<div class="error-msg">Add at least one question</div>`; return; }
    try {
      await api('create-set', { method: 'POST', body: { name, questions: draftQuestions } });
      draftQuestions = [];
      state.tab = 'sets';
      render();
    } catch (e) {
      msg.innerHTML = `<div class="error-msg">${esc(e.error || 'Could not save set')}</div>`;
    }
  };
}

function drawDraftList() {
  const el = document.getElementById('draftList');
  if (!el) return;
  el.innerHTML = draftQuestions.length === 0
    ? `<p class="lede">No questions added yet.</p>`
    : draftQuestions.map((q, i) => `
        <div class="q-list-item">
          <div class="qt">${i + 1}. ${esc(q.question_text)}</div>
          <div class="qo">Correct: ${q.correct_option}</div>
          <button class="link-btn" data-rm="${i}">Remove</button>
        </div>
      `).join('');
  el.querySelectorAll('[data-rm]').forEach((b) => {
    b.onclick = () => { draftQuestions.splice(Number(b.dataset.rm), 1); renderCreateSet(); };
  });
}

// ---------- STUDENTS ----------
async function loadStudents() {
  const body = document.getElementById('tabBody');
  try {
    const { students } = await api('admin-students');
    body.innerHTML = `
      <div class="card">
        <h2>All students (${students.length})</h2>
        ${students.length === 0 ? `<div class="empty-state">No students registered yet.</div>` : students.map((s) => `
          <div class="set-row">
            <div>
              <div class="set-name">${esc(s.name)}</div>
              <div class="set-meta">${esc(s.phone)} · joined ${new Date(s.created_at).toLocaleDateString()} · ${s.quizzes_taken} quiz(zes) taken</div>
            </div>
            <span class="pill done">${s.total_score}</span>
          </div>
        `).join('')}
      </div>
    `;
  } catch (e) {
    body.innerHTML = `<div class="error-msg">${esc(e.error || 'Could not load students')}</div>`;
  }
}

render();
