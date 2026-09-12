const { stores, json, requireStudent, initBlobs, todayIST } = require('./_utils');

exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const student = requireStudent(event);
  if (!student) return json(401, { error: 'Please log in' });

  try {
    const date = todayIST();
    const record = await stores.attendance().get(`${date}__${student.id}`, { type: 'json' });

    return json(200, {
      date,
      marked: !!record,
      status: record ? record.status : null,
      entered_name: record ? record.entered_name || null : null,
      marked_at: record ? record.marked_at : null,
    });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
