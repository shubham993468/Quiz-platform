const { stores, json, requireAdmin, newId, initBlobs } = require('./_utils');

exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!requireAdmin(event)) return json(401, { error: 'Admin login required' });

  try {
    const { setId, questions } = JSON.parse(event.body || '{}');
    if (!setId || !Array.isArray(questions) || questions.length === 0) {
      return json(400, { error: 'setId and at least one question are required' });
    }

    for (const q of questions) {
      if (
        !q.question_text || !q.option_a || !q.option_b || !q.option_c || !q.option_d ||
        !['A', 'B', 'C', 'D'].includes(q.correct_option)
      ) {
        return json(400, { error: 'Every question needs text, 4 options, and a valid correct option (A/B/C/D)' });
      }
    }

    const set = await stores.sets().get(setId, { type: 'json' });
    if (!set) return json(404, { error: 'Set not found' });

    const questionsStore = stores.questions();
    const existing = (await questionsStore.get(setId, { type: 'json' })) || [];

    const added = questions.map((q) => ({
      id: newId(),
      question_text: q.question_text.trim(),
      option_a: q.option_a.trim(),
      option_b: q.option_b.trim(),
      option_c: q.option_c.trim(),
      option_d: q.option_d.trim(),
      correct_option: q.correct_option,
    }));

    const updated = existing.concat(added);
    await questionsStore.setJSON(setId, updated);

    return json(200, { question_count: updated.length, added: added.length });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
