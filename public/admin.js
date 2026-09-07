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
  topbarActions.innerHTML = state.token
    ? `<button id="homeBtn" class="btn-outline btn-sm">Home</button><button id="logoutBtn">Log out</button>`
    : '';
  if (!state.token) return renderLogin();
  renderHome();
  const lb = document.getElementById('logoutBtn');
  if (lb) lb.onclick = logout;
  const hb = document.getElementById('homeBtn');
  if (hb) hb.onclick = () => { state.tab = 'sets'; renderHome(); };
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
      <button data-tab="sets" class="${state.tab === 'sets' ? 'active' : ''}">📋 Question Sets</button>
      <button data-tab="create" class="${state.tab === 'create' ? 'active' : ''}">➕ New Set</button>
      <button data-tab="students" class="${state.tab === 'students' ? 'active' : ''}">👥 Students</button>
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
    const [{ sets }, { students }, { tracks }] = await Promise.all([
      api('list-sets'),
      api('admin-students'),
      api('list-tracks'),
    ]);
    const groups = {};
    sets.forEach((s) => {
      const cat = s.category || 'General';
      (groups[cat] = groups[cat] || []).push(s);
    });
    const catNames = Object.keys(groups).sort((a, b) => (a === 'General' ? 1 : b === 'General' ? -1 : a.localeCompare(b)));

    body.innerHTML = `
      <div class="card">
        <div class="stat-row">
          <div><span>${sets.length}</span><div class="lbl">Question sets</div></div>
          <div><span>${students.length}</span><div class="lbl">Students</div></div>
          <div><span>${tracks.length}</span><div class="lbl">Tracks</div></div>
        </div>
        <button class="btn-outline btn-block" id="recomputeBtn" style="margin-top:14px;">Recompute ranking now</button>
        <div id="recomputeMsg"></div>
      </div>
      ${sets.length === 0 ? `<div class="card"><div class="empty-state">No sets yet. Create one from the "+ New Set" tab.</div></div>` : catNames.map((cat) => `
      <div class="card">
        <h2>${esc(cat)}</h2>
        ${groups[cat].map((s) => `
          <div class="set-row">
            <div>
              <div class="set-name">${esc(s.name)}</div>
              <div class="set-meta">${s.question_count} questions · ${new Date(s.created_at).toLocaleDateString()}${s.time_limit_minutes ? ` · ${s.time_limit_minutes} min timer` : ' · no timer'}</div>
            </div>
            <div style="display:flex; gap:6px;">
              <button class="btn-outline btn-sm" data-view="${s.id}">View</button>
              <button class="btn-danger btn-sm" data-del="${s.id}">Delete</button>
            </div>
          </div>
        `).join('')}
      </div>
      `).join('')}
    `;
    document.getElementById('recomputeBtn').onclick = async () => {
      const m = document.getElementById('recomputeMsg');
      m.innerHTML = '<p class="lede">Recomputing…</p>';
      try {
        const r = await api('recompute-ranking');
        m.innerHTML = `<div class="ok-msg">Done — ${r.students_ranked} student ranking(s) updated across ${r.tracks_ranked} track(s).</div>`;
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
        <p class="lede">${esc(set.category || 'General')} · ${questions.length} questions${set.time_limit_minutes ? ` · ${set.time_limit_minutes} min timer` : ' · no timer'}</p>
      </div>
      <div class="card">
        <h3>Edit set details</h3>
        <label>Set name</label>
        <input id="editName" type="text" value="${esc(set.name)}" />
        <label>Category / subject</label>
        <input id="editCategory" type="text" value="${esc(set.category || 'General')}" />
        <label>Time limit in minutes</label>
        <input id="editTimeLimit" type="number" min="1" value="${set.time_limit_minutes || ''}" placeholder="Leave blank for no timer" />
        <button class="btn-gold btn-block" id="saveSetEditBtn" style="margin-top:12px;">Save changes</button>
        <div id="editMsg"></div>
      </div>
      <div class="card">
        <h3>Add more questions to this set</h3>
        <pre class="bulk-format">Q: question text
A: option A
B: option B
C: option C
D: option D
Correct: B</pre>
        <textarea id="bulkText" rows="6" placeholder="Paste your questions here..."></textarea>
        <button class="btn-outline btn-block" id="bulkAddBtn" style="margin-top:10px;">Add pasted questions to this set</button>
        <div id="bulkMsg"></div>
      </div>
      <div class="card">
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
    document.getElementById('saveSetEditBtn').onclick = async () => {
      const name = document.getElementById('editName').value.trim();
      const category = document.getElementById('editCategory').value.trim();
      const time_limit_minutes = document.getElementById('editTimeLimit').value.trim();
      const msg = document.getElementById('editMsg');
      if (!name) { msg.innerHTML = `<div class="error-msg">Set name cannot be empty</div>`; return; }
      try {
        await api('admin-update-set', { method: 'POST', body: { setId, name, category, time_limit_minutes: time_limit_minutes || null } });
        viewSet(setId);
      } catch (e) {
        msg.innerHTML = `<div class="error-msg">${esc(e.error || 'Could not save changes')}</div>`;
      }
    };
    document.getElementById('bulkAddBtn').onclick = async () => {
      const text = document.getElementById('bulkText').value;
      const msg = document.getElementById('bulkMsg');
      const { questions: parsed, errors } = parseBulkQuestions(text);
      if (parsed.length === 0) {
        msg.innerHTML = `<div class="error-msg">No valid questions found. Check the format and try again.</div>`;
        return;
      }
      try {
        await api('add-questions', { method: 'POST', body: { setId, questions: parsed } });
        viewSet(setId);
      } catch (e) {
        msg.innerHTML = `<div class="error-msg">${esc(e.error || 'Could not add questions')}</div>`;
      }
    };
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
      <label>Category / subject (optional)</label>
      <input id="setCategory" type="text" placeholder="e.g. Mathematics — leave blank for General" />
      <label>Time limit in minutes (optional)</label>
      <input id="setTimeLimit" type="number" min="1" placeholder="Leave blank for no timer" />
    </div>
    <div class="card">
      <h3>Paste questions in bulk (optional)</h3>
      <p class="lede">One block per question, separated by a blank line. Format:</p>
      <pre class="bulk-format">Q: question text
A: option A
B: option B
C: option C
D: option D
Correct: B</pre>
      <textarea id="bulkText" rows="6" placeholder="Paste your questions here..."></textarea>
      <button class="btn-outline btn-block" id="bulkParseBtn" style="margin-top:10px;">Add pasted questions</button>
      <div id="bulkMsg"></div>
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

  document.getElementById('bulkParseBtn').onclick = () => {
    const text = document.getElementById('bulkText').value;
    const msg = document.getElementById('bulkMsg');
    const { questions, errors } = parseBulkQuestions(text);
    if (questions.length === 0) {
      msg.innerHTML = `<div class="error-msg">No valid questions found. Check the format and try again.</div>`;
      return;
    }
    draftQuestions = draftQuestions.concat(questions);
    let m = `<div class="ok-msg">Added ${questions.length} question(s).</div>`;
    if (errors.length) m += `<div class="error-msg">${errors.length} block(s) skipped: ${errors.join(' · ')}</div>`;
    renderCreateSet();
    document.getElementById('bulkMsg').innerHTML = m;
  };

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
    const category = document.getElementById('setCategory').value.trim();
    const time_limit_minutes = document.getElementById('setTimeLimit').value.trim();
    const msg = document.getElementById('saveMsg');
    if (!name) { msg.innerHTML = `<div class="error-msg">Give the set a name</div>`; return; }
    if (draftQuestions.length === 0) { msg.innerHTML = `<div class="error-msg">Add at least one question</div>`; return; }
    try {
      await api('create-set', { method: 'POST', body: { name, questions: draftQuestions, category, time_limit_minutes } });
      draftQuestions = [];
      state.tab = 'sets';
      render();
    } catch (e) {
      msg.innerHTML = `<div class="error-msg">${esc(e.error || 'Could not save set')}</div>`;
    }
  };
}

// Parses pasted bulk-question text into structured questions.
// Format per block (separated by a blank line):
//   Q: question text
//   A: option a
//   B: option b
//   C: option c
//   D: option d
//   Correct: B   (or "Ans: B")
function parseBulkQuestions(text) {
  const blocks = (text || '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const questions = [];
  const errors = [];
  blocks.forEach((block, idx) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const q = { question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: '' };
    lines.forEach((line) => {
      const m = line.match(/^(Q|A|B|C|D|Correct|Ans)\s*[:.\-]\s*(.+)$/i);
      if (!m) return;
      const key = m[1].toUpperCase();
      const val = m[2].trim();
      if (key === 'Q') q.question_text = val;
      else if (key === 'A') q.option_a = val;
      else if (key === 'B') q.option_b = val;
      else if (key === 'C') q.option_c = val;
      else if (key === 'D') q.option_d = val;
      else if (key === 'CORRECT' || key === 'ANS') q.correct_option = val.toUpperCase().replace(/[^ABCD]/g, '').charAt(0);
    });
    if (!q.question_text || !q.option_a || !q.option_b || !q.option_c || !q.option_d || !['A', 'B', 'C', 'D'].includes(q.correct_option)) {
      errors.push(`block ${idx + 1}`);
    } else {
      questions.push(q);
    }
  });
  return { questions, errors };
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
          <div class="set-row" data-student="${s.id}" data-name="${esc(s.name)}" style="cursor:pointer;">
            <div>
              <div class="set-name">${esc(s.name)} ${s.blocked ? '<span class="pill blocked">Blocked</span>' : ''}</div>
              <div class="set-meta">${esc(s.phone)} · ${esc(s.track || 'No track set')} · joined ${new Date(s.created_at).toLocaleDateString()} · ${s.quizzes_taken} quiz(zes) taken</div>
            </div>
            <span class="pill done">${s.total_score}</span>
          </div>
        `).join('')}
      </div>
    `;
    body.querySelectorAll('[data-student]').forEach((row) => {
      row.onclick = () => viewStudentHistory(row.dataset.student, row.dataset.name);
    });
  } catch (e) {
    body.innerHTML = `<div class="error-msg">${esc(e.error || 'Could not load students')}</div>`;
  }
}

async function viewStudentHistory(studentId, name) {
  const body = document.getElementById('tabBody');
  body.innerHTML = `<div class="loading">Loading…</div>`;
  try {
    const [{ attempts }, { students }, { tracks }] = await Promise.all([
      api(`admin-student-attempts?studentId=${encodeURIComponent(studentId)}`),
      api('admin-students'),
      api('list-tracks'),
    ]);
    const student = students.find((s) => s.id === studentId);
    const total = Math.round(attempts.reduce((sum, a) => sum + a.score, 0) * 100) / 100;
    body.innerHTML = `
      <div class="card">
        <button class="link-btn" id="backBtn">&larr; Back to all students</button>
        <h2 style="margin-top:10px;">${esc(student?.name || name)} ${student?.blocked ? '<span class="pill blocked">Blocked</span>' : ''}</h2>
        <div class="stat-row">
          <div><span>${attempts.length}</span><div class="lbl">Quizzes taken</div></div>
          <div><span>${total}</span><div class="lbl">Total score</div></div>
        </div>
      </div>
      <div class="card">
        <h3>Account details</h3>
        <label>Name</label>
        <input id="editStudentName" type="text" value="${esc(student?.name || '')}" />
        <button class="btn-outline btn-block" id="saveNameBtn" style="margin-top:10px;">Save name</button>
        <div id="nameMsg"></div>

        <label style="margin-top:18px;">Track</label>
        <select id="trackEdit">${tracks.map((t) => `<option value="${esc(t)}" ${student?.track === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
        <button class="btn-outline btn-block" id="saveTrackBtn" style="margin-top:10px;">Save track</button>
        <div id="trackMsg"></div>

        <div style="display:flex; gap:8px; margin-top:18px;">
          <button class="btn-outline" style="flex:1;" id="blockBtn">${student?.blocked ? 'Unblock student' : 'Block student'}</button>
          <button class="btn-danger" style="flex:1;" id="deleteBtn">Delete student</button>
        </div>
        <div id="accountMsg"></div>
      </div>
      <div class="card">
        <h3>Quiz history</h3>
        ${attempts.length === 0 ? `<div class="empty-state">No quizzes taken yet.</div>` : attempts.map((a) => `
          <div class="set-row">
            <div>
              <div class="set-name">${esc(a.set_name)}</div>
              <div class="set-meta">${new Date(a.created_at).toLocaleDateString()} · ${a.correct_count} correct, ${a.wrong_count} wrong, ${a.unattempted} skipped</div>
            </div>
            <span class="pill done">${a.score}</span>
          </div>
        `).join('')}
      </div>
    `;
    document.getElementById('backBtn').onclick = loadStudents;

    document.getElementById('saveNameBtn').onclick = async () => {
      const newName = document.getElementById('editStudentName').value.trim();
      const msg = document.getElementById('nameMsg');
      if (!newName) { msg.innerHTML = `<div class="error-msg">Name cannot be empty</div>`; return; }
      try {
        await api('admin-update-student', { method: 'POST', body: { phone: student.phone, name: newName } });
        viewStudentHistory(studentId, newName);
      } catch (e) {
        msg.innerHTML = `<div class="error-msg">${esc(e.error || 'Could not update name')}</div>`;
      }
    };

    document.getElementById('saveTrackBtn').onclick = async () => {
      const track = document.getElementById('trackEdit').value;
      const msg = document.getElementById('trackMsg');
      try {
        await api('admin-set-student-track', { method: 'POST', body: { phone: student.phone, track } });
        viewStudentHistory(studentId, name);
      } catch (e) {
        msg.innerHTML = `<div class="error-msg">${esc(e.error || 'Could not update track')}</div>`;
      }
    };

    document.getElementById('blockBtn').onclick = async () => {
      const msg = document.getElementById('accountMsg');
      const nextBlocked = !student?.blocked;
      if (nextBlocked && !confirm(`Block ${student.name}? They will not be able to log in until unblocked.`)) return;
      try {
        await api('admin-update-student', { method: 'POST', body: { phone: student.phone, blocked: nextBlocked } });
        viewStudentHistory(studentId, name);
      } catch (e) {
        msg.innerHTML = `<div class="error-msg">${esc(e.error || 'Could not update account')}</div>`;
      }
    };

    document.getElementById('deleteBtn').onclick = async () => {
      const msg = document.getElementById('accountMsg');
      if (!confirm(`Permanently delete ${student.name}? This removes their account and all their quiz attempts. This cannot be undone.`)) return;
      try {
        await api('admin-delete-student', { method: 'POST', body: { phone: student.phone } });
        loadStudents();
      } catch (e) {
        msg.innerHTML = `<div class="error-msg">${esc(e.error || 'Could not delete student')}</div>`;
      }
    };
  } catch (e) {
    body.innerHTML = `<div class="error-msg">${esc(e.error || 'Could not load history')}</div>`;
  }
}

render();
