const { stores, json, requireAdmin, initBlobs } = require('./_utils');

exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!requireAdmin(event)) return json(401, { error: 'Admin login required' });

  try {
    const { phone } = JSON.parse(event.body || '{}');
    if (!phone) return json(400, { error: 'phone is required' });

    const studentsStore = stores.students();
    const record = await studentsStore.get(phone, { type: 'json' });
    if (!record) return json(404, { error: 'Student not found' });

    const attemptsStore = stores.attempts();
    const { blobs } = await attemptsStore.list({ prefix: `${record.id}__` });
    await Promise.all(blobs.map(({ key }) => attemptsStore.delete(key)));

    await studentsStore.delete(phone);

    return json(200, { deleted: true, attempts_removed: blobs.length });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
