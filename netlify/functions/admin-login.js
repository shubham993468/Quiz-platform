const { json, adminToken } = require('./_utils');

// Admin ID & password live only in Netlify environment variables (ADMIN_ID, ADMIN_PASSWORD).
// Nobody but the person who set those env vars knows them - they're never stored in any database.
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const { id, password } = JSON.parse(event.body || '{}');
    const ADMIN_ID = process.env.ADMIN_ID;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

    if (!ADMIN_ID || !ADMIN_PASSWORD) {
      return json(500, { error: 'Admin account is not configured yet. Set ADMIN_ID and ADMIN_PASSWORD in Netlify environment variables.' });
    }

    if (id !== ADMIN_ID || password !== ADMIN_PASSWORD) {
      return json(401, { error: 'Incorrect admin ID or password' });
    }

    return json(200, { token: adminToken() });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
