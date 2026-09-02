const { stores, json, requireAdmin } = require('./_utils');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!requireAdmin(event)) return json(401, { error: 'Admin login required' });

  try {
    const { setId } = JSON.parse(event.body || '{}');
    if (!setId) return json(400, { error: 'setId is required' });

    const set = await stores.sets().get(setId, { type: 'json' });
    if (!set) return json(404, { error: 'Set not found' });

    await stores.sets().delete(setId);
    await stores.questions().delete(setId);
    // Past student attempts on this set are kept so their scores still count.

    return json(200, { deleted: true });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
