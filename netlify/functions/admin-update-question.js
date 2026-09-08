const { stores, json, requireAdmin, initBlobs } = require('./_utils');

exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!requireAdmin(event)) return json(401, { error: 'Admin login required' });

  try {
    const { setId, questionId, question_text, option_a, option_b, option_c, option_d, correct_option } = JSON.parse(event.body || '{}');
    if (!setId || !questionId) return json(400, { error: 'setId and questionId are required' });
    if (
      !question_text || !option_a || !option_b || !option_c || !option_d ||
      !['A', 'B', 'C', 'D'].includes(correct_option)
    ) {
      return json(400, { error: 'Question needs text, 4 options, and a valid correct option (A/B/C/D)' });
    }

    const questionsStore = stores.questions();
    const questions = await questionsStore.get(setId, { type: 'json' });
    if (!questions) return json(404, { error: 'Set not found' });

    const idx = questions.findIndex((q) => q.id === questionId);
    if (idx === -1) return json(404, { error: 'Question not found' });

    questions[idx] = {
      ...questions[idx],
      question_text: question_text.trim(),
      option_a: option_a.trim(),
      option_b: option_b.trim(),
      option_c: option_c.trim(),
      option_d: option_d.trim(),
      correct_option,
    };

    await questionsStore.setJSON(setId, questions);
    return json(200, { question: questions[idx] });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
