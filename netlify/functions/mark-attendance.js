const { stores, json, requireStudent, initBlobs, todayIST } = require('./_utils');

exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const student = requireStudent(event);
  if (!student) return json(401, { error: 'Please log in' });

  try {
    const { status, code, name } = JSON.parse(event.body || '{}');
    if (status !== 'present' && status !== 'absent') {
      return json(400, { error: 'status must be present or absent' });
    }

    const date = todayIST();
    const attendanceStore = stores.attendance();
    const key = `${date}__${student.id}`;

    const existing = await attendanceStore.get(key, { type: 'json' });
    if (existing) {
      return json(409, { error: 'You have already marked your attendance for today.', status: existing.status });
    }

    if (status === 'absent') {
      const record = {
        student_id: student.id,
        student_name: student.name,
        date,
        status: 'absent',
        marked_at: new Date().toISOString(),
      };
      await attendanceStore.setJSON(key, record);
      return json(200, { ok: true, status: 'absent' });
    }

    // status === 'present'
    if (!name || !String(name).trim()) {
      return json(400, { error: 'Please type your name' });
    }
    if (!code || !/^\d{3}$/.test(String(code))) {
      return json(400, { error: 'Enter the 3-digit code' });
    }

    const todaysCode = await stores.attendanceCodes().get(date, { type: 'json' });
    if (!todaysCode) {
      return json(400, { error: "No code has been set for today yet. Contact your admin." });
    }
    if (String(code) !== todaysCode.code) {
      return json(400, { error: 'Watch today\'s live class to get the code' });
    }

    const record = {
      student_id: student.id,
      student_name: student.name,
      entered_name: String(name).trim(),
      date,
      status: 'present',
      marked_at: new Date().toISOString(),
    };
    await attendanceStore.setJSON(key, record);

    return json(200, { ok: true, status: 'present' });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
