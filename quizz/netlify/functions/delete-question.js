const { stores, json, requireAdmin, initBlobs } = require('./_utils');

exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!requireAdmin(event)) return json(401, { error: 'Admin login required' });

  try {
    const { setId, questionId } = JSON.parse(event.body || '{}');
    if (!setId || !questionId) return json(400, { error: 'setId and questionId are required' });

    const questionsStore = stores.questions();
    const questions = (await questionsStore.get(setId, { type: 'json' })) || [];
    const updated = questions.filter((q) => q.id !== questionId);

    if (updated.length === questions.length) {
      return json(404, { error: 'Question not found' });
    }

    await questionsStore.setJSON(setId, updated);
    return json(200, { question_count: updated.length });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
