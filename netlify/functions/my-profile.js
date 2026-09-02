const { stores, json, requireStudent, initBlobs } = require('./_utils');

exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const student = requireStudent(event);
  if (!student) return json(401, { error: 'Please log in' });

  try {
    const attemptsStore = stores.attempts();
    const { blobs } = await attemptsStore.list({ prefix: `${student.id}__` });

    const attempts = await Promise.all(
      blobs.map(({ key }) => attemptsStore.get(key, { type: 'json' }))
    );
    attempts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const total_score = attempts.reduce((sum, a) => sum + a.score, 0);

    return json(200, {
      profile: { name: student.name, phone: student.phone },
      attempts,
      total_score: Math.round(total_score * 100) / 100,
    });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
