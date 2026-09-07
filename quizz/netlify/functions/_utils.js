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
  leaderboard: () => getStore('leaderboard'), // key = "current", value = {rows:[...], updated_at}
};

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
};
