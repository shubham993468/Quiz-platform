const { stores, json, requireAdmin, initBlobs } = require('./_utils');

exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!requireAdmin(event)) return json(401, { error: 'Admin login required' });

  try {
    const { setId, name, category, time_limit_minutes } = JSON.parse(event.body || '{}');
    if (!setId) return json(400, { error: 'setId is required' });

    const setsStore = stores.sets();
    const set = await setsStore.get(setId, { type: 'json' });
    if (!set) return json(404, { error: 'Set not found' });

    if (name !== undefined) {
      if (!name.trim()) return json(400, { error: 'Set name cannot be empty' });
      set.name = name.trim();
    }

    if (category !== undefined) {
      set.category = (category && String(category).trim()) || 'General';
    }

    if (time_limit_minutes !== undefined) {
      if (time_limit_minutes === null || time_limit_minutes === '') {
        set.time_limit_minutes = null;
      } else {
        const n = Number(time_limit_minutes);
        if (!Number.isFinite(n) || n <= 0) return json(400, { error: 'Time limit must be a positive number of minutes' });
        set.time_limit_minutes = n;
      }
    }

    await setsStore.setJSON(setId, set);
    return json(200, { set });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
