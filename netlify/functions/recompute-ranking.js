const { stores, json } = require('./_utils');

async function recompute() {
  const attemptsStore = stores.attempts();
  const { blobs } = await attemptsStore.list();

  const totals = {}; // student_id -> { name, total_score }

  for (const { key } of blobs) {
    const attempt = await attemptsStore.get(key, { type: 'json' });
    if (!attempt) continue;
    if (!totals[attempt.student_id]) {
      totals[attempt.student_id] = { student_id: attempt.student_id, name: attempt.student_name, total_score: 0 };
    }
    totals[attempt.student_id].total_score += attempt.score;
  }

  const rows = Object.values(totals)
    .map((r) => ({ ...r, total_score: Math.round(r.total_score * 100) / 100 }))
    .sort((a, b) => b.total_score - a.total_score)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  await stores.leaderboard().setJSON('current', {
    rows,
    updated_at: new Date().toISOString(),
  });

  return rows.length;
}

// This is registered as a Netlify Scheduled Function (see netlify.toml) and
// also works if you open its URL manually to refresh the ranking on demand.
exports.handler = async () => {
  try {
    const count = await recompute();
    return json(200, { ok: true, students_ranked: count });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Ranking update failed' });
  }
};
