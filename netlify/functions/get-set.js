const { stores, json, requireStudent, getStudentRecord, initBlobs } = require('./_utils');

exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const student = requireStudent(event);
  if (!student) return json(401, { error: 'Please log in' });

  try {
    const setId = event.queryStringParameters && event.queryStringParameters.setId;
    if (!setId) return json(400, { error: 'setId is required' });

    const record = await getStudentRecord(student);
    if (!record?.track) return json(403, { error: 'Please choose your track before taking a quiz' });
    if (record.blocked) return json(403, { error: 'Your account has been blocked. Please contact the admin.' });

    const set = await stores.sets().get(setId, { type: 'json' });
    if (!set) return json(404, { error: 'Set not found' });

    const category = set.category || 'General';
    if (category !== 'General' && category !== record.track) {
      return json(403, { error: 'This quiz is not available for your track' });
    }

    const existingAttempt = await stores.attempts().get(`${student.id}__${setId}`, { type: 'json' });
    if (existingAttempt) {
      return json(409, { error: 'You have already taken this set', attempt: existingAttempt });
    }

    const questions = (await stores.questions().get(setId, { type: 'json' })) || [];
    const safeQuestions = questions.map(({ id, question_text, option_a, option_b, option_c, option_d }) => ({
      id, question_text, option_a, option_b, option_c, option_d,
    }));

    return json(200, {
      set: {
        id: set.id,
        name: set.name,
        category: set.category || 'General',
        time_limit_minutes: set.time_limit_minutes || null,
      },
      questions: safeQuestions,
    });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
