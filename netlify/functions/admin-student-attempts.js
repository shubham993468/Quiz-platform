const { stores, json, requireAdmin, initBlobs } = require('./_utils');

exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  if (!requireAdmin(event)) return json(401, { error: 'Admin login required' });

  try {
    const studentId = event.queryStringParameters && event.queryStringParameters.studentId;
    if (!studentId) return json(400, { error: 'studentId is required' });

    const attemptsStore = stores.attempts();
    const { blobs } = await attemptsStore.list({ prefix: `${studentId}__` });

    const attempts = await Promise.all(
      blobs.map(({ key }) => attemptsStore.get(key, { type: 'json' }))
    );
    attempts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return json(200, { attempts });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
