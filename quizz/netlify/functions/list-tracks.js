const { stores, json, initBlobs } = require('./_utils');

exports.handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  try {
    const setsStore = stores.sets();
    const { blobs } = await setsStore.list();
    const sets = await Promise.all(blobs.map(({ key }) => setsStore.get(key, { type: 'json' })));

    const seen = new Set();
    sets.forEach((s) => {
      if (s && s.category) seen.add(s.category.trim());
    });
    seen.add('General'); // always available as a fallback track

    const tracks = Array.from(seen).sort((a, b) => (a === 'General' ? 1 : b === 'General' ? -1 : a.localeCompare(b)));

    return json(200, { tracks });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
