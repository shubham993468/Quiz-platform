const { stores, json, requireAdmin, initBlobs } = require('./_utils');

exports.handler = async (event) => {
  initBlobs(event);
  if (!requireAdmin(event)) return json(401, { error: 'Admin login required' });

  const settingsStore = stores.settings();

  if (event.httpMethod === 'GET') {
    try {
      const current = await settingsStore.get('ranking_start_date', { type: 'json' });
      return json(200, { date: current ? current.date : null });
    } catch (err) {
      console.error(err);
      return json(500, { error: 'Something went wrong. Please try again.' });
    }
  }

  if (event.httpMethod === 'POST') {
    try {
      const { date } = JSON.parse(event.body || '{}');

      if (date === null || date === '') {
        await settingsStore.delete('ranking_start_date');
        return json(200, { date: null });
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return json(400, { error: 'Date must be in YYYY-MM-DD format' });
      }

      await settingsStore.setJSON('ranking_start_date', { date, set_at: new Date().toISOString() });
      return json(200, { date });
    } catch (err) {
      console.error(err);
      return json(500, { error: 'Something went wrong. Please try again.' });
    }
  }

  return json(405, { error: 'Method not allowed' });
};
