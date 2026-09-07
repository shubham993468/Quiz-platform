const bcrypt = require('bcryptjs');
const { stores, json, studentToken, initBlobs } = require('./_utils');

exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const { phone, password } = JSON.parse(event.body || '{}');
    if (!phone || !password) return json(400, { error: 'Phone number and password are required' });

    const cleanPhone = String(phone).replace(/\D/g, '');
    const student = await stores.students().get(cleanPhone, { type: 'json' });

    if (!student) return json(401, { error: 'No account found with this phone number' });

    const ok = await bcrypt.compare(password, student.password_hash);
    if (!ok) return json(401, { error: 'Incorrect password' });

    if (student.blocked) {
      return json(403, { error: 'Your account has been blocked. Please contact the admin.' });
    }

    const token = studentToken(student);
    return json(200, { token, name: student.name, phone: student.phone, track: student.track || null });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
