const { stores, json, requireStudent, initBlobs } = require('./_utils');

exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  try {
    const setsStore = stores.sets();
    const questionsStore = stores.questions();
    const { blobs } = await setsStore.list();

    const student = requireStudent(event); // may be null - that's fine, sets are public to browse

    const attemptsStore = stores.attempts();

    const sets = await Promise.all(
      blobs.map(async ({ key }) => {
        const set = await setsStore.get(key, { type: 'json' });
        const questions = (await questionsStore.get(key, { type: 'json' })) || [];
        let myAttempt = null;
        if (student) {
          myAttempt = await attemptsStore.get(`${student.id}__${key}`, { type: 'json' });
        }
        return {
          id: set.id,
          name: set.name,
          created_at: set.created_at,
          question_count: questions.length,
          attempted: !!myAttempt,
          my_score: myAttempt ? myAttempt.score : null,
        };
      })
    );

    sets.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return json(200, { sets });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
