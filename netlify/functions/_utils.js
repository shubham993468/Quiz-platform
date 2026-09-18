const { getStore, connectLambda } = require('@netlify/blobs');
const jwt = require('jsonwebtoken');

// Netlify Functions written in this "Lambda compatibility" style (exports.handler)
// don't get Netlify Blobs wired up automatically - it must be connected manually
// using the incoming event, once per invocation, before any store is touched.
function initBlobs(event) {
  connectLambda(event);
}

// A separate "drawer" for each kind of data. Netlify Blobs needs no setup —
// it's automatically available the moment this site is deployed on Netlify.
const stores = {
  students: () => getStore('students'),   // key = phone, value = {id,name,phone,password_hash,created_at}
  sets: () => getStore('sets'),           // key = setId, value = {id,name,created_at}
  questions: () => getStore('questions'), // key = setId, value = [ {id,question_text,option_a..d,correct_option} ]
  attempts: () => getStore('attempts'),   // key = `${studentId}__${setId}`, value = {score,correct_count,wrong_count,total_questions,created_at,set_name,student_name}
  leaderboard: () => getStore('leaderboard'), // unused now that ranking is computed live - kept only so old data doesn't error if ever read
  attendanceCodes: () => getStore('attendance_codes'), // key = "YYYY-MM-DD" (IST), value = {code, set_at}
  attendance: () => getStore('attendance'), // key = `${date}__${studentId}`, value = {status, entered_name, student_id, student_name, date, marked_at}
  settings: () => getStore('settings'), // general-purpose key/value store for future admin-configurable settings
};

// This app is used by an Indian classroom, so "today" for attendance and
// daily codes always means the calendar day in India, regardless of which
// timezone the Netlify server itself happens to run in.
function todayIST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

// Converts a plain "YYYY-MM-DD" (meant as an IST calendar date) into the UTC
// ISO timestamp for the very start of that day in India - so it can be
// compared directly against attempt.created_at (also a UTC ISO timestamp).
function istDateToUtcISO(dateStr) {
  return new Date(`${dateStr}T00:00:00+05:30`).toISOString();
}

// JWT_SECRET must be set once in Netlify: Site settings -> Environment variables.
// Falling back to a default so nothing crashes if it's briefly unset, but you should set your own.
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-netlify-env-vars';

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}

function studentToken(student) {
  return jwt.sign(
    { id: student.id, phone: student.phone, name: student.name, role: 'student' },
    JWT_SECRET,
    { expiresIn: '365d' }
  );
}

function adminToken() {
  return jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '30d' });
}

function verifyToken(event) {
  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(auth.slice(7), JWT_SECRET);
  } catch (e) {
    return null;
  }
}

function requireStudent(event) {
  const payload = verifyToken(event);
  if (!payload || payload.role !== 'student') return null;
  return payload;
}

function requireAdmin(event) {
  const payload = verifyToken(event);
  if (!payload || payload.role !== 'admin') return null;
  return payload;
}

function newId() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  );
}

// The JWT only carries identity - track can be changed by the admin later,
// so anything that needs to check track must re-read the live student record.
async function getStudentRecord(payload) {
  if (!payload) return null;
  return stores.students().get(payload.phone, { type: 'json' });
}

// Fairness rule for scoring: a student's counted score/history only includes
// quizzes whose test CURRENTLY belongs to their CURRENT course (or is marked
// "General", open to everyone). This is checked live against the set's
// present-day category, not whatever category existed when the attempt was
// made - so if the admin moves a test to a different course (or a student's
// own course changes), totals for everyone adjust automatically, with no
// date to set and no need to let anyone retake a quiz they've already seen
// the answers to.
function attemptCountsForTrack(attemptCategory, track) {
  if (!track) return false;
  const cat = attemptCategory || 'General';
  return cat === 'General' || cat === track;
}

// Looks up the live category for a batch of attempts in one pass, falling
// back to the category recorded on the attempt itself only if its set has
// since been deleted (so there's nothing live left to check against).
async function liveCategoryForAttempts(attempts) {
  const setsStore = stores.sets();
  const uniqueSetIds = [...new Set(attempts.map((a) => a.set_id))];
  const categoryBySetId = {};
  await Promise.all(uniqueSetIds.map(async (setId) => {
    const set = await setsStore.get(setId, { type: 'json' });
    if (set) categoryBySetId[setId] = set.category || 'General';
  }));
  return (attempt) => categoryBySetId[attempt.set_id] || attempt.category || 'General';
}

module.exports = {
  stores,
  json,
  studentToken,
  adminToken,
  requireStudent,
  requireAdmin,
  newId,
  initBlobs,
  getStudentRecord,
  todayIST,
  istDateToUtcISO,
  attemptCountsForTrack,
  liveCategoryForAttempts,
};
