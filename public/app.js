const API = '/.netlify/functions';
const app = document.getElementById('app');
const topbarActions = document.getElementById('topbarActions');
const topbarSub = document.getElementById('topbarSub');

let state = {
  token: localStorage.getItem('quizz_token') || null,
  name: localStorage.getItem('quizz_name') || null,
  phone: localStorage.getItem('quizz_phone') || null,
  tab: 'quiz', // quiz | leaderboard | profile
  activeQuiz: null, // { set, questions, answers }
};

function saveAuth(token, name, phone) {
  state.token = token; state.name = name; state.phone = phone;
  localStorage.setItem('quizz_token', token);
  localStorage.setItem('quizz_name', name);
  localStorage.setItem('quizz_phone', phone);
}

function logout() {
  state.token = null; state.name = null; state.phone = null;
  localStorage.removeItem('quizz_token');
  localStorage.removeItem('quizz_name');
  localStorage.removeItem('quizz_phone');
  render();
}

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers.Authorization = 'Bearer ' + state.token;
  const res = await fetch(`${API}/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
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
    ? `<span>Hi, ${esc(state.name)}</span><button id="logoutBtn">Log out</button>`
    : '';
  topbarSub.textContent = state.token ? 'Learn. Compete. Climb the rank.' : 'Take quizzes. See your rank.';

  if (!state.token) return renderAuth();
  if (state.activeQuiz) return renderQuizTaking();
  renderHome();

  const lb = document.getElementById('logoutBtn');
  if (lb) lb.onclick = logout;
}

// ---------- AUTH ----------
function renderAuth() {
  app.innerHTML = `
    <div class="hero-auth">
      <svg class="seal" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="26" cy="26" r="24" stroke="#d79c33" stroke-width="2"/>
        <circle cx="26" cy="26" r="18" stroke="#d79c33" stroke-width="1"/>
        <path d="M17 27.5L23 33L36 20" stroke="#182849" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <h1>Test yourself. Track your rank.</h1>
      <p>Short quizzes, honest scoring, and a leaderboard that updates every night.</p>
    </div>
    <div class="tabs">
      <button id="tabLogin" class="active">Log in</button>
      <button id="tabRegister">Create account</button>
    </div>
    <div class="card" id="authCard"></div>
  `;
  let mode = 'login';
  const authCard = document.getElementById('authCard');
  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');

  function draw() {
    tabLogin.classList.toggle('active', mode === 'login');
    tabRegister.classList.toggle('active', mode === 'register');
    authCard.innerHTML = mode === 'login' ? `
      <h2>Welcome back</h2>
      <p class="lede">Log in with your phone number and password.</p>
      <label>Phone number</label>
      <input id="phone" type="tel" inputmode="numeric" maxlength="10" placeholder="10-digit number" />
      <label>Password</label>
      <input id="password" type="password" placeholder="Your password" />
      <button class="btn-primary" id="submitBtn">Log in</button>
      <div id="msg"></div>
    ` : `
      <h2>Create your account</h2>
      <p class="lede">Your phone number and password stay the same for good — this is your permanent login.</p>
      <label>Full name</label>
      <input id="name" type="text" placeholder="As you'd like it shown on the leaderboard" />
      <label>Phone number</label>
      <input id="phone" type="tel" inputmode="numeric" maxlength="10" placeholder="10-digit number" />
      <label>Password</label>
      <input id="password" type="password" placeholder="Choose a password" />
      <button class="btn-primary" id="submitBtn">Create account</button>
      <div id="msg"></div>
    `;
    document.getElementById('submitBtn').onclick = () => (mode === 'login' ? doLogin() : doRegister());
  }

  tabLogin.onclick = () => { mode = 'login'; draw(); };
  tabRegister.onclick = () => { mode = 'register'; draw(); };
  draw();

  async function doLogin() {
    const phone = document.getElementById('phone').value.trim();
    const password = document.getElementById('password').value;
    const msg = document.getElementById('msg');
    msg.innerHTML = '';
    try {
      const data = await api('login', { method: 'POST', body: { phone, password } });
      saveAuth(data.token, data.name, data.phone);
      render();
    } catch (e) {
      msg.innerHTML = `<div class="error-msg">${esc(e.error || 'Login failed')}</div>`;
    }
  }

  async function doRegister() {
    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const password = document.getElementById('password').value;
    const msg = document.getElementById('msg');
    msg.innerHTML = '';
    try {
      const data = await api('register', { method: 'POST', body: { name, phone, password } });
      saveAuth(data.token, data.name, data.phone);
      render();
    } catch (e) {
      msg.innerHTML = `<div class="error-msg">${esc(e.error || 'Could not create account')}</div>`;
    }
  }
}

// ---------- HOME ----------
function renderHome() {
  app.innerHTML = `
    <div class="tabs">
      <button data-tab="quiz" class="${state.tab === 'quiz' ? 'active' : ''}">Take Quiz</button>
      <button data-tab="leaderboard" class="${state.tab === 'leaderboard' ? 'active' : ''}">Leaderboard</button>
      <button data-tab="profile" class="${state.tab === 'profile' ? 'active' : ''}">My Profile</button>
    </div>
    <div id="tabBody"><div class="loading">Loading…</div></div>
  `;
  app.querySelectorAll('[data-tab]').forEach((b) => {
    b.onclick = () => { state.tab = b.dataset.tab; render(); };
  });

  if (state.tab === 'quiz') loadQuizList();
  else if (state.tab === 'leaderboard') loadLeaderboard();
  else loadProfile();
}

async function loadQuizList() {
  const body = document.getElementById('tabBody');
  try {
    const { sets } = await api('list-sets');
    if (sets.length === 0) {
      body.innerHTML = `<div class="card"><div class="empty-state">No question sets yet. Check back soon!</div></div>`;
      return;
    }
    body.innerHTML = `<div class="card">${sets.map((s) => `
      <div class="set-row">
        <div>
          <div class="set-name">${esc(s.name)}</div>
          <div class="set-meta">${s.question_count} questions</div>
        </div>
        ${s.attempted
          ? `<span class="pill done">Scored ${s.my_score}</span>`
          : `<button class="btn-gold btn-sm" data-start="${s.id}">Start</button>`}
      </div>
    `).join('')}</div>`;
    body.querySelectorAll('[data-start]').forEach((b) => {
      b.onclick = () => startQuiz(b.dataset.start);
    });
  } catch (e) {
    body.innerHTML = `<div class="error-msg">${esc(e.error || 'Could not load quizzes')}</div>`;
  }
}

async function startQuiz(setId) {
  const body = document.getElementById('tabBody');
  body.innerHTML = `<div class="loading">Loading questions…</div>`;
  try {
    const data = await api(`get-set?setId=${encodeURIComponent(setId)}`);
    state.activeQuiz = { set: data.set, questions: data.questions, answers: {} };
    render();
  } catch (e) {
    body.innerHTML = `<div class="error-msg">${esc(e.error || 'Could not load this quiz')}</div>`;
  }
}

function scoreTier(pct) {
  if (pct >= 85) return 'Excellent work.';
  if (pct >= 60) return 'Solid effort.';
  if (pct >= 35) return 'Room to grow — try the next set.';
  return "Don't worry, every set is a fresh start.";
}

function renderQuizTaking() {
  const { set, questions, answers, result } = state.activeQuiz;

  if (result) {
    const pct = questions.length ? Math.round((result.score / questions.length) * 100) : 0;
    const ringPct = Math.max(0, Math.min(100, pct));
    app.innerHTML = `
      <div class="card">
        <h2>${esc(set.name)}</h2>
        <div class="score-ring" style="--pct:${ringPct}">
          <div class="inner">
            <div class="num">${result.score}</div>
            <div class="out-of">of ${result.total_questions}</div>
          </div>
        </div>
        <div class="tier-msg">${scoreTier(pct)}</div>
        <div class="stat-row">
          <div><span style="color:#2e7d5b">${result.correct_count}</span><div class="lbl">Correct</div></div>
          <div><span style="color:#b3402f">${result.wrong_count}</span><div class="lbl">Wrong</div></div>
          <div><span>${result.unattempted}</span><div class="lbl">Skipped</div></div>
        </div>
        <button class="btn-primary" id="backBtn">Back to quizzes</button>
      </div>
    `;
    document.getElementById('backBtn').onclick = () => {
      state.activeQuiz = null;
      state.tab = 'quiz';
      render();
    };
    return;
  }

  const answeredCount = Object.keys(answers).length;
  const pct = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;
  app.innerHTML = `
    <div class="card">
      <h2>${esc(set.name)}</h2>
      <p class="lede">${answeredCount} of ${questions.length} answered · Correct = +1, Wrong = -0.25</p>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>
    <div class="card">
      ${questions.map((q, i) => `
        <div class="question-block">
          <div class="question-num">Question ${i + 1} of ${questions.length}</div>
          <div class="question-text">${esc(q.question_text)}</div>
          ${['A', 'B', 'C', 'D'].map((opt) => `
            <label class="option ${answers[q.id] === opt ? 'selected' : ''}" data-qid="${q.id}" data-opt="${opt}">
              <input type="radio" name="q_${q.id}" ${answers[q.id] === opt ? 'checked' : ''} />
              <span>${esc(q['option_' + opt.toLowerCase()])}</span>
            </label>
          `).join('')}
        </div>
      `).join('')}
      <button class="btn-primary" id="submitQuizBtn">Submit quiz</button>
      <button class="btn-outline btn-block" id="cancelQuizBtn" style="margin-top:8px;">Cancel</button>
      <div id="quizMsg"></div>
    </div>
  `;

  app.querySelectorAll('.option').forEach((el) => {
    el.onclick = () => {
      state.activeQuiz.answers[el.dataset.qid] = el.dataset.opt;
      renderQuizTaking();
    };
  });

  document.getElementById('cancelQuizBtn').onclick = () => {
    if (confirm('Leave without submitting? Your answers will not be saved.')) {
      state.activeQuiz = null;
      render();
    }
  };

  document.getElementById('submitQuizBtn').onclick = async () => {
    const msg = document.getElementById('quizMsg');
    const unanswered = questions.length - Object.keys(answers).length;
    if (unanswered > 0 && !confirm(`${unanswered} question(s) left unanswered. Submit anyway?`)) return;
    try {
      const data = await api('submit-attempt', {
        method: 'POST',
        body: { setId: set.id, answers },
      });
      state.activeQuiz.result = data.attempt;
      render();
    } catch (e) {
      msg.innerHTML = `<div class="error-msg">${esc(e.error || 'Could not submit')}</div>`;
    }
  };
}

async function loadLeaderboard() {
  const body = document.getElementById('tabBody');
  try {
    const data = await api('leaderboard');
    const rows = data.top10;
    const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
    body.innerHTML = `
      <div class="card">
        <h2>Top scorers</h2>
        <p class="lede">${data.updated_at ? 'Updated ' + new Date(data.updated_at).toLocaleString() : 'Rankings update every day at 9 PM'}</p>
        ${rows.length === 0 ? `<div class="empty-state">No rankings yet — be the first to take a quiz!</div>` : `
        <table class="leaderboard">
          <thead><tr><th>Rank</th><th>Name</th><th style="text-align:right">Score</th></tr></thead>
          <tbody>
            ${rows.map((r) => `
              <tr class="${data.my_rank && r.rank === data.my_rank.rank ? 'me' : ''}">
                <td><span class="rank-badge ${r.rank <= 3 ? 'gold' : ''}">${medals[r.rank] || r.rank}</span></td>
                <td>${esc(r.name)}</td>
                <td style="text-align:right">${r.total_score}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>`}
      </div>
      <div class="card">
        ${data.my_rank
          ? `<h3>Your rank</h3><p class="lede">You're currently rank <b>#${data.my_rank.rank}</b> with a total score of <b>${data.my_rank.total_score}</b>.</p>`
          : `<h3>Not ranked yet</h3><p class="lede">Take a quiz and check back after the next 9 PM update to see your rank.</p>`}
      </div>
    `;
  } catch (e) {
    body.innerHTML = `<div class="error-msg">${esc(e.error || 'Could not load leaderboard')}</div>`;
  }
}

async function loadProfile() {
  const body = document.getElementById('tabBody');
  try {
    const data = await api('my-profile');
    body.innerHTML = `
      <div class="card">
        <h2>${esc(data.profile.name)}</h2>
        <p class="lede">Phone: ${esc(data.profile.phone)}</p>
        <div class="stat-row">
          <div><span>${data.attempts.length}</span><div class="lbl">Quizzes taken</div></div>
          <div><span>${data.total_score}</span><div class="lbl">Total score</div></div>
        </div>
      </div>
      <div class="card">
        <h3>History</h3>
        ${data.attempts.length === 0 ? `<div class="empty-state">You haven't taken any quiz yet.</div>` : data.attempts.map((a) => `
          <div class="set-row">
            <div>
              <div class="set-name">${esc(a.set_name)}</div>
              <div class="set-meta">${new Date(a.created_at).toLocaleDateString()} · ${a.correct_count} correct, ${a.wrong_count} wrong</div>
            </div>
            <span class="pill done">${a.score}</span>
          </div>
        `).join('')}
      </div>
    `;
  } catch (e) {
    body.innerHTML = `<div class="error-msg">${esc(e.error || 'Could not load profile')}</div>`;
  }
}

render();
