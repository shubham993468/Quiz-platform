const { stores, json, requireStudent } = require('./_utils');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const student = requireStudent(event);
  if (!student) return json(401, { error: 'Please log in' });

  try {
    const setId = event.queryStringParameters && event.queryStringParameters.setId;
    if (!setId) return json(400, { error: 'setId is required' });

    const set = await stores.sets().get(setId, { type: 'json' });
    if (!set) return json(404, { error: 'Set not found' });

    const existingAttempt = await stores.attempts().get(`${student.id}__${setId}`, { type: 'json' });
    if (existingAttempt) {
      return json(409, { error: 'You have already taken this set', attempt: existingAttempt });
    }

    const questions = (await stores.questions().get(setId, { type: 'json' })) || [];
    const safeQuestions = questions.map(({ id, question_text, option_a, option_b, option_c, option_d }) => ({
      id, question_text, option_a, option_b, option_c, option_d,
    }));

    return json(200, { set: { id: set.id, name: set.name }, questions: safeQuestions });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
