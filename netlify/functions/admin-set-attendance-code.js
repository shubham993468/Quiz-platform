const { stores, json, requireAdmin, initBlobs, todayIST } = require('./_utils');

exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!requireAdmin(event)) return json(401, { error: 'Admin login required' });

  try {
    const { code } = JSON.parse(event.body || '{}');
    if (!code || !/^\d{3}$/.test(String(code))) {
      return json(400, { error: 'Code must be exactly 3 digits' });
    }

    const date = todayIST();
    await stores.attendanceCodes().setJSON(date, { code: String(code), set_at: new Date().toISOString() });

    return json(200, { date, code_set: true });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
