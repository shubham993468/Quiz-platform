const { stores, json, requireStudent, getStudentRecord, initBlobs, istDateToUtcISO } = require('./_utils');

exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const student = requireStudent(event);
  if (!student) return json(401, { error: 'Please log in' });

  try {
    const record = await getStudentRecord(student);
    const attemptsStore = stores.attempts();
    const { blobs } = await attemptsStore.list({ prefix: `${student.id}__` });

    const attempts = await Promise.all(
      blobs.map(({ key }) => attemptsStore.get(key, { type: 'json' }))
    );
    attempts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const rankingStart = await stores.settings().get('ranking_start_date', { type: 'json' });
    const cutoffISO = rankingStart ? istDateToUtcISO(rankingStart.date) : null;

    // "Total score" here matches what counts on the leaderboard - if the admin
    // set a ranking start date, older attempts still show in the history below
    // but don't count toward this number, same as they don't count on the board.
    const counted = cutoffISO ? attempts.filter((a) => a.created_at >= cutoffISO) : attempts;
    const total_score = counted.reduce((sum, a) => sum + a.score, 0);

    return json(200, {
      profile: { name: student.name, phone: student.phone, track: record?.track || null },
      attempts,
      total_score: Math.round(total_score * 100) / 100,
      ranking_since: rankingStart ? rankingStart.date : null,
    });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
