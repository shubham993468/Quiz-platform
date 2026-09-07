const { stores, json, requireStudent, getStudentRecord, initBlobs } = require('./_utils');

const OVERALL_KEY = 'overall';

function boardKey(track) {
  return `track__${encodeURIComponent(track)}`;
}

exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  try {
    const studentPayload = requireStudent(event);
    const record = await getStudentRecord(studentPayload);

    const wantsOverall = event.queryStringParameters && event.queryStringParameters.overall === '1';
    const requestedTrack = event.queryStringParameters && event.queryStringParameters.track;
    const track = wantsOverall ? 'All courses' : (requestedTrack || record?.track || 'General');
    const key = wantsOverall ? OVERALL_KEY : boardKey(track);

    const board = await stores.leaderboard().get(key, { type: 'json' });
    const rows = board ? board.rows : [];
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
      updated_at: board ? board.updated_at : null,
      total_students_ranked: rows.length,
    });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
