const { stores, json, requireStudent } = require('./_utils');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  try {
    const board = await stores.leaderboard().get('current', { type: 'json' });
    const rows = board ? board.rows : [];
    const top10 = rows.slice(0, 10).map((r) => ({ rank: r.rank, name: r.name, total_score: r.total_score }));

    let myRank = null;
    const student = requireStudent(event);
    if (student) {
      const mine = rows.find((r) => r.student_id === student.id);
      if (mine) myRank = { rank: mine.rank, total_score: mine.total_score };
    }

    return json(200, {
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
