const bcrypt = require('bcryptjs');
const { stores, json, requireAdmin, initBlobs } = require('./_utils');

exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!requireAdmin(event)) return json(401, { error: 'Admin login required' });

  try {
    const { phone, newPassword } = JSON.parse(event.body || '{}');
    if (!phone || !newPassword) return json(400, { error: 'phone and newPassword are required' });
    if (newPassword.length < 4) return json(400, { error: 'Password must be at least 4 characters' });

    const studentsStore = stores.students();
    const record = await studentsStore.get(phone, { type: 'json' });
    if (!record) return json(404, { error: 'Student not found' });

    record.password_hash = await bcrypt.hash(newPassword, 10);
    await studentsStore.setJSON(phone, record);

    return json(200, { ok: true });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
