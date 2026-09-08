const API = '/.netlify/functions';
const app = document.getElementById('app');
const topbarActions = document.getElementById('topbarActions');
const topbarSub = document.getElementById('topbarSub');

let state = {
  token: localStorage.getItem('quizz_token') || null,
  name: localStorage.getItem('quizz_name') || null,
  phone: localStorage.getItem('quizz_phone') || null,
  track: localStorage.getItem('quizz_track') || null,
  tab: 'quiz', // quiz | leaderboard | profile
  activeQuiz: null, // { set, questions, answers }
};

let quizTimerHandle = null;
function clearQuizTimer() {
  if (quizTimerHandle) { clearInterval(quizTimerHandle); quizTimerHandle = null; }
}

function saveAuth(token, name, phone, track) {
  state.token = token; state.name = name; state.phone = phone; state.track = track || null;
  localStorage.setItem('quizz_token', token);
  localStorage.setItem('quizz_name', name);
  localStorage.setItem('quizz_phone', phone);
  if (track) localStorage.setItem('quizz_track', track);
  else localStorage.removeItem('quizz_track');
}

function logout() {
  clearQuizTimer();
  state.token = null; state.name = null; state.phone = null; state.track = null;
  localStorage.removeItem('quizz_token');
  localStorage.removeItem('quizz_name');
  localStorage.removeItem('quizz_phone');
  localStorage.removeItem('quizz_track');
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

// Fisher-Yates - used to randomize question and option order per attempt,
// so students sitting next to each other don't see matching screens.
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function render() {
  topbarActions.innerHTML = state.token
    ? `<span>Hi, ${esc(state.name)}</span><button id="logoutBtn">Log out</button>`
    : '';
  topbarSub.textContent = state.token ? 'Learn. Compete. Climb the rank.' : 'Take quizzes. See your rank.';

  if (!state.token) return renderAuth();
  if (!state.track) return renderChooseTrack();
  if (state.activeQuiz) return renderQuizTaking();
  renderHome();

  const lb = document.getElementById('logoutBtn');
  if (lb) lb.onclick = logout;
}

// ---------- ONE-TIME TRACK PICKER (for accounts created before tracks existed) ----------
async function renderChooseTrack() {
  app.innerHTML = `<div class="card"><div class="loading">Loading…</div></div>`;
  let tracks = [];
  try {
    const data = await api('list-tracks');
    tracks = data.tracks;
  } catch (e) {
    tracks = ['General'];
  }
  app.innerHTML = `
    <div class="card">
      <h2>Choose your course</h2>
      <p class="lede">Pick the subject you're studying. This decides which quizzes you can take and which leaderboard you appear on. Once set, only the admin can change it.</p>
      <label>Course</label>
      <select id="trackSelect">${tracks.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select>
      <button class="btn-primary" id="setTrackBtn">Continue</button>
      <div id="msg"></div>
    </div>
  `;
  document.getElementById('setTrackBtn').onclick = async () => {
    const track = document.getElementById('trackSelect').value;
    const msg = document.getElementById('msg');
    try {
      const data = await api('set-my-track', { method: 'POST', body: { track } });
      state.track = data.track;
      localStorage.setItem('quizz_track', data.track);
      render();
    } catch (e) {
      if (e.track) {
        // Server already has a track for this account (e.g. the admin set it) -
        // this device's saved session just hadn't caught up yet. Recover silently.
        state.track = e.track;
        localStorage.setItem('quizz_track', e.track);
        render();
        return;
      }
      msg.innerHTML = `<div class="error-msg">${esc(e.error || 'Could not save your course')}</div>`;
    }
  };
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
  let tracksCache = null;
  const authCard = document.getElementById('authCard');
  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');

  async function draw() {
    tabLogin.classList.toggle('active', mode === 'login');
    tabRegister.classList.toggle('active', mode === 'register');
    if (mode === 'login') {
      authCard.innerHTML = `
        <h2>Welcome back</h2>
        <p class="lede">Log in with your phone number and password.</p>
        <label>Phone number</label>
        <input id="phone" type="tel" inputmode="numeric" maxlength="10" placeholder="10-digit number" />
        <label>Password</label>
        <input id="password" type="password" placeholder="Your password" />
        <button class="btn-primary" id="submitBtn">Log in</button>
        <div id="msg"></div>
      `;
    } else {
      authCard.innerHTML = `<div class="loading">Loading…</div>`;
      if (!tracksCache) {
        try { tracksCache = (await api('list-tracks')).tracks; } catch (e) { tracksCache = ['General']; }
      }
      authCard.innerHTML = `
        <h2>Create your account</h2>
        <p class="lede">Your phone number and password stay the same for good — this is your permanent login.</p>
        <label>Full name</label>
        <input id="name" type="text" placeholder="As you'd like it shown on the leaderboard" />
        <label>Phone number</label>
        <input id="phone" type="tel" inputmode="numeric" maxlength="10" placeholder="10-digit number" />
        <label>Password</label>
        <input id="password" type="password" placeholder="Choose a password" />
        <label>Your course</label>
        <select id="track">${tracksCache.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select>
        <p class="lede" style="margin-top:4px;">This decides which quizzes and leaderboard you'll see. Only the admin can change it later.</p>
        <button class="btn-primary" id="submitBtn">Create account</button>
        <div id="msg"></div>
      `;
    }
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
      saveAuth(data.token, data.name, data.phone, data.track);
      render();
    } catch (e) {
      msg.innerHTML = `<div class="error-msg">${esc(e.error || 'Login failed')}</div>`;
    }
  }

  async function doRegister() {
    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const password = document.getElementById('password').value;
    const track = document.getElementById('track').value;
    const msg = document.getElementById('msg');
    msg.innerHTML = '';
    try {
      const data = await api('register', { method: 'POST', body: { name, phone, password, track } });
      saveAuth(data.token, data.name, data.phone, data.track);
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
    const data = await api('list-sets');
    if (data.track_required) {
      state.track = null;
      localStorage.removeItem('quizz_track');
      render();
      return;
    }
    const { sets } = data;
    if (sets.length === 0) {
      body.innerHTML = `<div class="card"><div class="empty-state">No question sets yet. Check back soon!</div></div>`;
      return;
    }
    const groups = {};
    sets.forEach((s) => {
      const cat = s.category || 'General';
      (groups[cat] = groups[cat] || []).push(s);
    });
    const catNames = Object.keys(groups).sort((a, b) => (a === 'General' ? 1 : b === 'General' ? -1 : a.localeCompare(b)));

    body.innerHTML = catNames.map((cat) => `
      <div class="card">
        <h2>${esc(cat)}</h2>
        ${groups[cat].map((s) => `
          <div class="set-row">
            <div>
              <div class="set-name">${esc(s.name)}</div>
              <div class="set-meta">${s.question_count} questions${s.time_limit_minutes ? ` · ${s.time_limit_minutes} min` : ''}</div>
            </div>
            ${s.attempted
              ? `<div style="display:flex; align-items:center; gap:6px;">
                   <span class="pill done">Scored ${s.my_score}</span>
                   <button class="btn-outline btn-sm" data-review="${s.id}" data-name="${esc(s.name)}">Review</button>
                 </div>`
              : `<button class="btn-gold btn-sm" data-start="${s.id}">Start</button>`}
          </div>
        `).join('')}
      </div>
    `).join('');

    body.querySelectorAll('[data-start]').forEach((b) => {
      b.onclick = () => startQuiz(b.dataset.start);
    });
    body.querySelectorAll('[data-review]').forEach((b) => {
      b.onclick = () => openReview(b.dataset.review, b.dataset.name);
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
    const deadline = data.set.time_limit_minutes ? Date.now() + data.set.time_limit_minutes * 60000 : null;
    // Randomize question order, and each question's option order, once per
    // attempt - this stays fixed for the rest of this attempt (re-renders on
    // every click use the same order) but differs student to student.
    const questions = shuffle(data.questions).map((q) => ({ ...q, _optOrder: shuffle(['A', 'B', 'C', 'D']) }));
    state.activeQuiz = { set: data.set, questions, answers: {}, deadline };
    render();
  } catch (e) {
    body.innerHTML = `<div class="error-msg">${esc(e.error || 'Could not load this quiz')}</div>`;
  }
}

async function openReview(setId, name) {
  const body = document.getElementById('tabBody');
  body.innerHTML = `<div class="loading">Loading…</div>`;
  try {
    const data = await api(`get-attempt-review?setId=${encodeURIComponent(setId)}`);
    state.activeQuiz = {
      set: { id: setId, name },
      questions: [],
      answers: {},
      result: data.attempt,
      review: data.questions,
      reviewNote: data.note || null,
      returnTab: state.tab,
    };
    render();
  } catch (e) {
    body.innerHTML = `<div class="error-msg">${esc(e.error || 'Could not load review')}</div>`;
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
    clearQuizTimer();
    const pct = result.total_questions ? Math.round((result.score / result.total_questions) * 100) : 0;
    const ringPct = Math.max(0, Math.min(100, pct));
    const review = state.activeQuiz.review;
    const reviewNote = state.activeQuiz.reviewNote;
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
        ${review ? `<button class="btn-outline btn-block" id="reviewBtn" style="margin-top:14px;">Review answers</button>` : ''}
        ${reviewNote ? `<p class="lede" style="margin-top:14px;">${esc(reviewNote)}</p>` : ''}
        <div id="reviewBlock"></div>
        <button class="btn-primary" id="backBtn">Back to quizzes</button>
      </div>
    `;
    document.getElementById('backBtn').onclick = () => {
      state.tab = state.activeQuiz.returnTab || 'quiz';
      state.activeQuiz = null;
      render();
    };
    const reviewBtn = document.getElementById('reviewBtn');
    if (reviewBtn) {
      let shown = false;
      reviewBtn.onclick = () => {
        shown = !shown;
        reviewBtn.textContent = shown ? 'Hide review' : 'Review answers';
        document.getElementById('reviewBlock').innerHTML = shown ? review.map((q, i) => `
          <div class="review-item">
            <div class="qt">${i + 1}. ${esc(q.question_text)}</div>
            ${['A', 'B', 'C', 'D'].map((opt) => {
              const isCorrect = opt === q.correct_option;
              const isGiven = opt === q.given;
              let cls = '';
              if (isCorrect) cls = 'correct';
              else if (isGiven) cls = 'wrong-given';
              return `<div class="review-opt ${cls}">${opt}. ${esc(q['option_' + opt.toLowerCase()])}${isCorrect ? ' ✓' : ''}${isGiven && !isCorrect ? ' — your answer' : ''}</div>`;
            }).join('')}
            ${!q.given ? `<div class="qo">You skipped this question.</div>` : ''}
          </div>
        `).join('') : '';
      };
    }
    return;
  }

  const answeredCount = Object.keys(answers).length;
  const pct = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;
  app.innerHTML = `
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:baseline;">
        <h2>${esc(set.name)}</h2>
        ${state.activeQuiz.deadline ? `<span class="timer-badge" id="timerBadge">--:--</span>` : ''}
      </div>
      <p class="lede">${answeredCount} of ${questions.length} answered · Correct = +1, Wrong = -0.25</p>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>
    <div class="card">
      ${questions.map((q, i) => `
        <div class="question-block">
          <div class="question-num">Question ${i + 1} of ${questions.length}</div>
          <div class="question-text">${esc(q.question_text)}</div>
          ${(q._optOrder || ['A', 'B', 'C', 'D']).map((opt) => `
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
      clearQuizTimer();
      state.activeQuiz = null;
      render();
    }
  };

  document.getElementById('submitQuizBtn').onclick = () => submitQuiz();

  // Countdown timer - runs once per quiz attempt (guarded so option clicks,
  // which re-render this whole screen, don't spawn duplicate intervals).
  if (state.activeQuiz.deadline && !quizTimerHandle) {
    const tick = () => {
      const badge = document.getElementById('timerBadge');
      const remainingMs = state.activeQuiz.deadline - Date.now();
      if (remainingMs <= 0) {
        clearQuizTimer();
        submitQuiz(true);
        return;
      }
      if (badge) {
        const totalSec = Math.ceil(remainingMs / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        badge.textContent = `${m}:${String(s).padStart(2, '0')}`;
        badge.classList.toggle('low', totalSec <= 30);
      }
    };
    tick();
    quizTimerHandle = setInterval(tick, 1000);
  } else if (state.activeQuiz.deadline) {
    // Already running - just sync the badge immediately after a re-render.
    const badge = document.getElementById('timerBadge');
    if (badge) {
      const totalSec = Math.max(0, Math.ceil((state.activeQuiz.deadline - Date.now()) / 1000));
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      badge.textContent = `${m}:${String(s).padStart(2, '0')}`;
      badge.classList.toggle('low', totalSec <= 30);
    }
  }
}

async function submitQuiz(auto = false) {
  const { set, questions, answers } = state.activeQuiz;
  const msg = document.getElementById('quizMsg');
  const unanswered = questions.length - Object.keys(answers).length;
  if (!auto && unanswered > 0 && !confirm(`${unanswered} question(s) left unanswered. Submit anyway?`)) return;
  try {
    const data = await api('submit-attempt', {
      method: 'POST',
      body: { setId: set.id, answers },
    });
    clearQuizTimer();
    state.activeQuiz.result = data.attempt;
    state.activeQuiz.review = data.questions;
    render();
  } catch (e) {
    if (msg) msg.innerHTML = `<div class="error-msg">${esc(e.error || 'Could not submit')}</div>`;
  }
}

function renderBoardCard(data) {
  const rows = data.top10;
  const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
  return `
    <div class="card">
      <h2>Top scorers — ${esc(data.track)}</h2>
      <p class="lede">${data.updated_at ? 'Updated ' + new Date(data.updated_at).toLocaleString() : 'Rankings update every day at 9 PM'}</p>
      ${rows.length === 0 ? `<div class="empty-state">No rankings yet — be the first to take a quiz!</div>` : `
      <table class="leaderboard">
        <thead><tr><th>Rank</th><th>Name</th><th style="text-align:right">Score</th></tr></thead>
        <tbody>
          ${rows.map((r) => `
            <tr class="${data.my_rank && r.rank === data.my_rank.rank ? 'me' : ''}">
              <td><span class="rank-badge ${r.rank === 1 ? 'gold' : r.rank === 2 ? 'silver' : r.rank === 3 ? 'bronze' : ''}">${medals[r.rank] || r.rank}</span></td>
              <td>${esc(r.name)}</td>
              <td style="text-align:right">${r.total_score}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`}
    </div>
    <div class="card">
      ${data.my_rank
        ? `<h3>Your rank</h3><p class="lede">You're currently rank <b>#${data.my_rank.rank}</b> of <b>${data.total_students_ranked}</b> students, with a total score of <b>${data.my_rank.total_score}</b>.</p>`
        : `<h3>Not ranked yet</h3><p class="lede">Take a quiz and check back after the next 9 PM update to see your rank.</p>`}
    </div>
  `;
}

async function loadLeaderboard(view) {
  view = view || 'track';
  const body = document.getElementById('tabBody');
  body.innerHTML = `
    <div class="tabs">
      <button id="lbTrack" class="${view === 'track' ? 'active' : ''}">My Course</button>
      <button id="lbOverall" class="${view === 'overall' ? 'active' : ''}">All Courses</button>
    </div>
    <div id="lbBody"><div class="loading">Loading…</div></div>
  `;
  document.getElementById('lbTrack').onclick = () => loadLeaderboard('track');
  document.getElementById('lbOverall').onclick = () => loadLeaderboard('overall');

  const lbBody = document.getElementById('lbBody');
  try {
    const data = await api(view === 'overall' ? 'leaderboard?overall=1' : 'leaderboard');
    lbBody.innerHTML = renderBoardCard(data);
  } catch (e) {
    lbBody.innerHTML = `<div class="error-msg">${esc(e.error || 'Could not load leaderboard')}</div>`;
  }
}

async function loadProfile() {
  const body = document.getElementById('tabBody');
  try {
    const data = await api('my-profile');
    if (data.profile.track && data.profile.track !== state.track) {
      state.track = data.profile.track;
      localStorage.setItem('quizz_track', data.profile.track);
    }
    body.innerHTML = `
      <div class="card">
        <h2>${esc(data.profile.name)}</h2>
        <p class="lede">Phone: ${esc(data.profile.phone)} · Course: ${esc(data.profile.track || 'Not set')}</p>
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
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="pill done">${a.score}</span>
              <button class="btn-outline btn-sm" data-review="${a.set_id}" data-name="${esc(a.set_name)}">Review</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    body.querySelectorAll('[data-review]').forEach((b) => {
      b.onclick = () => openReview(b.dataset.review, b.dataset.name);
    });
  } catch (e) {
    body.innerHTML = `<div class="error-msg">${esc(e.error || 'Could not load profile')}</div>`;
  }
}

render();
