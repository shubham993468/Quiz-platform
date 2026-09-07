const { stores, json, requireAdmin, initBlobs } = require('./_utils');

exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  if (!requireAdmin(event)) return json(401, { error: 'Admin login required' });

  try {
    const studentsStore = stores.students();
    const attemptsStore = stores.attempts();
    const { blobs } = await studentsStore.list();

    const students = await Promise.all(
      blobs.map(async ({ key }) => {
        const s = await studentsStore.get(key, { type: 'json' });
        const { blobs: theirAttempts } = await attemptsStore.list({ prefix: `${s.id}__` });
        let total_score = 0;
        for (const { key: ak } of theirAttempts) {
          const a = await attemptsStore.get(ak, { type: 'json' });
          if (a) total_score += a.score;
        }
        return {
          id: s.id,
          name: s.name,
          phone: s.phone,
          track: s.track || null,
          blocked: !!s.blocked,
          created_at: s.created_at,
          quizzes_taken: theirAttempts.length,
          total_score: Math.round(total_score * 100) / 100,
        };
      })
    );

    students.sort((a, b) => b.total_score - a.total_score);

    return json(200, { students });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
