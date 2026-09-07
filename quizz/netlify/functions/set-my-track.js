const { stores, json, requireStudent, initBlobs } = require('./_utils');

exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const student = requireStudent(event);
  if (!student) return json(401, { error: 'Please log in' });

  try {
    const { track } = JSON.parse(event.body || '{}');
    if (!track || !String(track).trim()) return json(400, { error: 'Please choose a track' });

    const studentsStore = stores.students();
    const record = await studentsStore.get(student.phone, { type: 'json' });
    if (!record) return json(404, { error: 'Account not found' });

    if (record.track) {
      return json(403, { error: 'Your track is already set. Ask the admin to change it.' });
    }

    record.track = String(track).trim();
    await studentsStore.setJSON(student.phone, record);

    return json(200, { track: record.track });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
