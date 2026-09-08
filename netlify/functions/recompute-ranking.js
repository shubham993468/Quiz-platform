const { stores, json, initBlobs } = require('./_utils');

const OVERALL_KEY = 'overall';

function boardKey(track) {
  return `track__${encodeURIComponent(track)}`;
}

async function recompute() {
  const attemptsStore = stores.attempts();
  const { blobs } = await attemptsStore.list();

  // Look up current names by student id, so a rename by the admin shows up
  // on the leaderboard immediately rather than the name frozen at attempt time.
  const studentsStore = stores.students();
  const { blobs: studentBlobs } = await studentsStore.list();
  const nameById = {};
  await Promise.all(studentBlobs.map(async ({ key }) => {
    const s = await studentsStore.get(key, { type: 'json' });
    if (s) nameById[s.id] = s.name;
  }));

  const attempts = (await Promise.all(blobs.map(({ key }) => attemptsStore.get(key, { type: 'json' })))).filter(Boolean);

  const byTrack = {}; // category -> { student_id -> { name, total_score } }
  const overall = {}; // student_id -> { name, total_score } - every attempt, any track

  for (const attempt of attempts) {
    const category = attempt.category || 'General'; // older attempts, taken before tracks existed
    const currentName = nameById[attempt.student_id] || attempt.student_name;

    if (!byTrack[category]) byTrack[category] = {};
    const totals = byTrack[category];
    if (!totals[attempt.student_id]) {
      totals[attempt.student_id] = { student_id: attempt.student_id, name: currentName, total_score: 0 };
    }
    totals[attempt.student_id].total_score += attempt.score;

    if (!overall[attempt.student_id]) {
      overall[attempt.student_id] = { student_id: attempt.student_id, name: currentName, total_score: 0 };
    }
    overall[attempt.student_id].total_score += attempt.score;
  }

  const leaderboardStore = stores.leaderboard();
  const updated_at = new Date().toISOString();
  let studentsRanked = 0;

  for (const [track, totals] of Object.entries(byTrack)) {
    const rows = Object.values(totals)
      .map((r) => ({ ...r, total_score: Math.round(r.total_score * 100) / 100 }))
      .sort((a, b) => b.total_score - a.total_score)
      .map((r, i) => ({ ...r, rank: i + 1 }));

    await leaderboardStore.setJSON(boardKey(track), { track, rows, updated_at });
    studentsRanked += rows.length;
  }

  const overallRows = Object.values(overall)
    .map((r) => ({ ...r, total_score: Math.round(r.total_score * 100) / 100 }))
    .sort((a, b) => b.total_score - a.total_score)
    .map((r, i) => ({ ...r, rank: i + 1 }));
  await leaderboardStore.setJSON(OVERALL_KEY, { track: 'All courses', rows: overallRows, updated_at });

  return { studentsRanked, tracks: Object.keys(byTrack).length };
}

// This is registered as a Netlify Scheduled Function (see netlify.toml) and
// also works if you open its URL manually to refresh the ranking on demand.
exports.handler = async (event) => {
  try {
    initBlobs(event);
    const { studentsRanked, tracks } = await recompute();
    return json(200, { ok: true, students_ranked: studentsRanked, tracks_ranked: tracks });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Ranking update failed' });
  }
};
