const { stores, json, requireStudent, getStudentRecord, initBlobs, liveCategoryForAttempts, attemptCountsForTrack } = require('./_utils');

// Rankings used to be a once-a-day snapshot recomputed on a schedule. Now the
// board is computed fresh on every request directly from attempts, so a
// student's rank updates the instant they submit a quiz - no daily refresh,
// no "recompute" button needed.
exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  try {
    const studentPayload = requireStudent(event);
    const record = await getStudentRecord(studentPayload);

    const wantsOverall = event.queryStringParameters && event.queryStringParameters.overall === '1';
    const requestedTrack = event.queryStringParameters && event.queryStringParameters.track;
    const track = wantsOverall ? 'All courses' : (requestedTrack || record?.track || 'General');

    const attemptsStore = stores.attempts();
    const { blobs } = await attemptsStore.list();
    const attempts = (await Promise.all(blobs.map(({ key }) => attemptsStore.get(key, { type: 'json' })))).filter(Boolean);
    // A test's category can be moved by the admin after it was taken (e.g. it
    // used to be uncategorized, or got reassigned to a different course) - so
    // this always checks the test's CURRENT category, not whatever it was
    // when each attempt was submitted, keeping everyone's totals limited to
    // exactly the tests that currently exist in their own course.
    const categoryOf = await liveCategoryForAttempts(attempts);

    // Look up current names by student id, so a rename by the admin shows up
    // immediately rather than the name frozen at attempt time.
    const studentsStore = stores.students();
    const { blobs: studentBlobs } = await studentsStore.list();
    const nameById = {};
    await Promise.all(studentBlobs.map(async ({ key }) => {
      const s = await studentsStore.get(key, { type: 'json' });
      if (s) nameById[s.id] = s.name;
    }));

    const totals = {}; // student_id -> { name, total_score }
    let latestUpdate = null;

    for (const attempt of attempts) {
      // Per-course board: only tests that currently belong to this course (or
      // are "General") count - checked live, so moving a test between courses
      // updates every affected student's total automatically.
      if (!wantsOverall && !attemptCountsForTrack(categoryOf(attempt), track)) continue;

      const currentName = nameById[attempt.student_id] || attempt.student_name;
      if (!totals[attempt.student_id]) {
        totals[attempt.student_id] = { student_id: attempt.student_id, name: currentName, total_score: 0 };
      }
      totals[attempt.student_id].total_score += attempt.score;

      if (!latestUpdate || attempt.created_at > latestUpdate) latestUpdate = attempt.created_at;
    }

    const rows = Object.values(totals)
      .map((r) => ({ ...r, total_score: Math.round(r.total_score * 100) / 100 }))
      .sort((a, b) => b.total_score - a.total_score)
      .map((r, i) => ({ ...r, rank: i + 1 }));

    const top10 = rows.slice(0, 10).map((r) => ({ rank: r.rank, name: r.name, total_score: r.total_score }));

    let myRank = null;
    if (studentPayload) {
      const mine = rows.find((r) => r.student_id === studentPayload.id);
      if (mine) myRank = { rank: mine.rank, total_score: mine.total_score };
    }

    return json(200, {
      track,
      top10,
      my_rank: myRank,
      updated_at: latestUpdate,
      total_students_ranked: rows.length,
    });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
