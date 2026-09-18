const { stores, json, requireAdmin, initBlobs, liveCategoryForAttempts, attemptCountsForTrack } = require('./_utils');

exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  if (!requireAdmin(event)) return json(401, { error: 'Admin login required' });

  try {
    const studentId = event.queryStringParameters && event.queryStringParameters.studentId;
    if (!studentId) return json(400, { error: 'studentId is required' });

    const attemptsStore = stores.attempts();
    const { blobs } = await attemptsStore.list({ prefix: `${studentId}__` });

    const attempts = await Promise.all(
      blobs.map(({ key }) => attemptsStore.get(key, { type: 'json' }))
    );
    attempts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Admin sees every attempt this student ever made, regardless of course -
    // but each one is flagged with whether it currently counts toward their
    // score, so it's clear why the total on this page might be lower than
    // the sum of every score shown (a test moved to a different course, for
    // example, still shows here but no longer counts).
    let studentTrack = null;
    const studentsStore = stores.students();
    const { blobs: studentBlobs } = await studentsStore.list();
    await Promise.all(studentBlobs.map(async ({ key }) => {
      const s = await studentsStore.get(key, { type: 'json' });
      if (s && s.id === studentId) studentTrack = s.track || null;
    }));

    const categoryOf = await liveCategoryForAttempts(attempts);
    const annotated = attempts.map((a) => ({
      ...a,
      counted: studentTrack ? attemptCountsForTrack(categoryOf(a), studentTrack) : false,
    }));

    return json(200, { attempts: annotated });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
