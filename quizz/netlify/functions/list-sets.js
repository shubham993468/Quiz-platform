const { stores, json, requireStudent, getStudentRecord, initBlobs } = require('./_utils');

exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  try {
    const setsStore = stores.sets();
    const questionsStore = stores.questions();
    const { blobs } = await setsStore.list();

    const studentPayload = requireStudent(event); // may be null - that's fine, sets are public to browse
    const record = await getStudentRecord(studentPayload);

    if (studentPayload && !record?.track) {
      return json(200, { sets: [], track_required: true });
    }
    if (record?.blocked) {
      return json(403, { error: 'Your account has been blocked. Please contact the admin.' });
    }

    const attemptsStore = stores.attempts();

    const sets = await Promise.all(
      blobs.map(async ({ key }) => {
        const set = await setsStore.get(key, { type: 'json' });
        const category = set.category || 'General';
        // Students only see sets matching their own track, plus open "General" sets.
        if (record && category !== 'General' && category !== record.track) return null;

        const questions = (await questionsStore.get(key, { type: 'json' })) || [];
        let myAttempt = null;
        if (studentPayload) {
          myAttempt = await attemptsStore.get(`${studentPayload.id}__${key}`, { type: 'json' });
        }
        return {
          id: set.id,
          name: set.name,
          category,
          time_limit_minutes: set.time_limit_minutes || null,
          created_at: set.created_at,
          question_count: questions.length,
          attempted: !!myAttempt,
          my_score: myAttempt ? myAttempt.score : null,
        };
      })
    );

    const visible = sets.filter(Boolean);
    visible.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return json(200, { sets: visible });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
