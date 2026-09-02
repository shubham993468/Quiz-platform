const bcrypt = require('bcryptjs');
const { stores, json, studentToken, newId } = require('./_utils');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const { name, phone, password } = JSON.parse(event.body || '{}');

    if (!name || !phone || !password) {
      return json(400, { error: 'Name, phone number and password are required' });
    }
    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      return json(400, { error: 'Enter a valid 10-digit phone number' });
    }
    if (password.length < 4) {
      return json(400, { error: 'Password must be at least 4 characters' });
    }

    const studentsStore = stores.students();
    const existing = await studentsStore.get(cleanPhone, { type: 'json' });
    if (existing) {
      return json(409, { error: 'An account with this phone number already exists. Please log in instead.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const student = {
      id: newId(),
      name: name.trim(),
      phone: cleanPhone,
      password_hash,
      created_at: new Date().toISOString(),
    };

    await studentsStore.setJSON(cleanPhone, student);

    const token = studentToken(student);
    return json(200, { token, name: student.name, phone: student.phone });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
