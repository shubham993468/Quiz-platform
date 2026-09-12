const { stores, json, requireAdmin, initBlobs, todayIST } = require('./_utils');

exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  if (!requireAdmin(event)) return json(401, { error: 'Admin login required' });

  try {
    const date = (event.queryStringParameters && event.queryStringParameters.date) || todayIST();

    const studentsStore = stores.students();
    const { blobs: studentBlobs } = await studentsStore.list();
    const roster = (await Promise.all(studentBlobs.map((b) => studentsStore.get(b.key, { type: 'json' })))).filter(Boolean);

    const attendanceStore = stores.attendance();
    const { blobs: attendanceBlobs } = await attendanceStore.list({ prefix: `${date}__` });
    const records = (await Promise.all(attendanceBlobs.map((b) => attendanceStore.get(b.key, { type: 'json' })))).filter(Boolean);
    const byStudentId = {};
    records.forEach((r) => { byStudentId[r.student_id] = r; });

    const codeRecord = await stores.attendanceCodes().get(date, { type: 'json' });

    const report = roster
      .map((s) => {
        const rec = byStudentId[s.id];
        return {
          student_id: s.id,
          name: s.name,
          phone: s.phone,
          track: s.track || null,
          status: rec ? rec.status : 'not_marked',
          entered_name: rec ? rec.entered_name || null : null,
          marked_at: rec ? rec.marked_at : null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const present_count = report.filter((r) => r.status === 'present').length;
    const absent_count = report.filter((r) => r.status === 'absent').length;
    const not_marked_count = report.filter((r) => r.status === 'not_marked').length;

    return json(200, {
      date,
      code_set: !!codeRecord,
      present_count,
      absent_count,
      not_marked_count,
      total_students: roster.length,
      report,
    });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
