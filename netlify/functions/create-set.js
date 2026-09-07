const { stores, json, requireAdmin, newId, initBlobs } = require('./_utils');

exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!requireAdmin(event)) return json(401, { error: 'Admin login required' });

  try {
    const { name, questions, category, time_limit_minutes } = JSON.parse(event.body || '{}');

    if (!name || !Array.isArray(questions) || questions.length === 0) {
      return json(400, { error: 'Set name and at least one question are required' });
    }

    let timeLimit = null;
    if (time_limit_minutes !== undefined && time_limit_minutes !== null && time_limit_minutes !== '') {
      const n = Number(time_limit_minutes);
      if (!Number.isFinite(n) || n <= 0) return json(400, { error: 'Time limit must be a positive number of minutes' });
      timeLimit = n;
    }

    for (const q of questions) {
      if (
        !q.question_text || !q.option_a || !q.option_b || !q.option_c || !q.option_d ||
        !['A', 'B', 'C', 'D'].includes(q.correct_option)
      ) {
        return json(400, { error: 'Every question needs text, 4 options, and a valid correct option (A/B/C/D)' });
      }
    }

    const setId = newId();
    const set = {
      id: setId,
      name: name.trim(),
      category: (category && String(category).trim()) || 'General',
      time_limit_minutes: timeLimit,
      created_at: new Date().toISOString(),
    };
    const questionList = questions.map((q) => ({
      id: newId(),
      question_text: q.question_text.trim(),
      option_a: q.option_a.trim(),
      option_b: q.option_b.trim(),
      option_c: q.option_c.trim(),
      option_d: q.option_d.trim(),
      correct_option: q.correct_option,
    }));

    await stores.sets().setJSON(setId, set);
    await stores.questions().setJSON(setId, questionList);

    return json(200, { set, question_count: questionList.length });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
