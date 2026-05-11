let count = 0;
const sessions = new Set();

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const sessionId = body.s || 'unknown';

  count++;
  sessions.add(sessionId);

  // eslint-disable-next-line no-console
  console.log(`[PING] total=${count} unique=${sessions.size} v=${body.v || '?'} platform=${body.p || '?'}`);

  res.status(200).json({
    ok: true,
    count,
    unique: sessions.size,
  });
};
