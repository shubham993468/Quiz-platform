const { stores, json, requireAdmin, initBlobs } = require('./_utils');

exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!requireAdmin(event)) return json(401, { error: 'Admin login required' });

  try {
    const { phone, track } = JSON.parse(event.body || '{}');
    if (!phone || !track || !String(track).trim()) {
      return json(400, { error: 'phone and track are required' });
    }

    const studentsStore = stores.students();
    const record = await studentsStore.get(phone, { type: 'json' });
    if (!record) return json(404, { error: 'Student not found' });

    record.track = String(track).trim();
    await studentsStore.setJSON(phone, record);

    return json(200, { id: record.id, name: record.name, phone: record.phone, track: record.track });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
