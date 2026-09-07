const { stores, json, requireStudent, initBlobs } = require('./_utils');

exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const student = requireStudent(event);
  if (!student) return json(401, { error: 'Please log in' });

  try {
    const setId = event.queryStringParameters && event.queryStringParameters.setId;
    if (!setId) return json(400, { error: 'setId is required' });

    const attempt = await stores.attempts().get(`${student.id}__${setId}`, { type: 'json' });
    if (!attempt) return json(404, { error: 'You have not taken this quiz yet' });

    // Attempts taken before the review feature was added don't have saved
    // answers - still return the score, just without a question breakdown.
    if (!attempt.answers) {
      return json(200, { attempt, questions: null, note: 'A detailed review is not available for this attempt.' });
    }

    const questions = await stores.questions().get(setId, { type: 'json' });
    if (!questions) {
      return json(200, { attempt, questions: null, note: 'This set was removed, so a detailed review is not available.' });
    }

    const review = questions.map((q) => ({
      id: q.id,
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_option: q.correct_option,
      given: attempt.answers[q.id] || null,
    }));

    return json(200, { attempt, questions: review });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
