const { stores, json, requireStudent, getStudentRecord, initBlobs, liveCategoryForAttempts, attemptCountsForTrack } = require('./_utils');

exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const student = requireStudent(event);
  if (!student) return json(401, { error: 'Please log in' });

  try {
    const record = await getStudentRecord(student);
    const attemptsStore = stores.attempts();
    const { blobs } = await attemptsStore.list({ prefix: `${student.id}__` });

    const allAttempts = await Promise.all(
      blobs.map(({ key }) => attemptsStore.get(key, { type: 'json' }))
    );

    // A test's category can be moved by the admin after it was taken, and a
    // student's own course can change too - so history only ever shows tests
    // that currently belong to this student's current course (or are
    // "General"). A test that's since moved to a different course simply
    // isn't part of this student's record any more, same as it wouldn't be
    // if they'd never taken it.
    const categoryOf = await liveCategoryForAttempts(allAttempts);
    const attempts = record?.track
      ? allAttempts.filter((a) => attemptCountsForTrack(categoryOf(a), record.track))
      : [];
    attempts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const total_score = attempts.reduce((sum, a) => sum + a.score, 0);

    return json(200, {
      profile: { name: student.name, phone: student.phone, track: record?.track || null },
      attempts,
      total_score: Math.round(total_score * 100) / 100,
    });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
