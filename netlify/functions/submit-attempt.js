const { stores, json, requireStudent, initBlobs } = require('./_utils');

exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const student = requireStudent(event);
  if (!student) return json(401, { error: 'Please log in' });

  try {
    const { setId, answers } = JSON.parse(event.body || '{}'); // answers: { [questionId]: 'A'|'B'|'C'|'D' }
    if (!setId || !answers) return json(400, { error: 'setId and answers are required' });

    const attemptsStore = stores.attempts();
    const attemptKey = `${student.id}__${setId}`;
    const existing = await attemptsStore.get(attemptKey, { type: 'json' });
    if (existing) return json(409, { error: 'You have already taken this set', attempt: existing });

    const set = await stores.sets().get(setId, { type: 'json' });
    if (!set) return json(404, { error: 'Set not found' });

    const questions = (await stores.questions().get(setId, { type: 'json' })) || [];

    let correct_count = 0;
    let wrong_count = 0;
    let unattempted = 0;

    for (const q of questions) {
      const given = answers[q.id];
      if (!given) {
        unattempted += 1;
      } else if (given === q.correct_option) {
        correct_count += 1;
      } else {
        wrong_count += 1;
      }
    }

    const score = Math.round((correct_count - wrong_count * 0.25) * 100) / 100;

    const attempt = {
      student_id: student.id,
      student_name: student.name,
      set_id: setId,
      set_name: set.name,
      score,
      correct_count,
      wrong_count,
      unattempted,
      total_questions: questions.length,
      created_at: new Date().toISOString(),
    };

    await attemptsStore.setJSON(attemptKey, attempt);

    return json(200, { attempt });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
