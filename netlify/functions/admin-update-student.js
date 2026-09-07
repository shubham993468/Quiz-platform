const { stores, json, requireAdmin, initBlobs } = require('./_utils');

exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!requireAdmin(event)) return json(401, { error: 'Admin login required' });

  try {
    const { phone, name, blocked } = JSON.parse(event.body || '{}');
    if (!phone) return json(400, { error: 'phone is required' });

    const studentsStore = stores.students();
    const record = await studentsStore.get(phone, { type: 'json' });
    if (!record) return json(404, { error: 'Student not found' });

    if (name !== undefined) {
      if (!String(name).trim()) return json(400, { error: 'Name cannot be empty' });
      record.name = String(name).trim();
    }
    if (blocked !== undefined) {
      record.blocked = !!blocked;
    }

    await studentsStore.setJSON(phone, record);
    return json(200, { id: record.id, name: record.name, phone: record.phone, track: record.track, blocked: !!record.blocked });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
