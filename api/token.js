export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { SN_INSTANCE, SN_CLIENT_ID, SN_CLIENT_SECRET, SN_USERNAME, SN_PASSWORD } = process.env;
  const { refresh_token } = req.body || {};

  const params = refresh_token
    ? { grant_type: 'refresh_token', client_id: SN_CLIENT_ID, client_secret: SN_CLIENT_SECRET, refresh_token }
    : { grant_type: 'password',      client_id: SN_CLIENT_ID, client_secret: SN_CLIENT_SECRET, username: SN_USERNAME, password: SN_PASSWORD };

  try {
    const snRes = await fetch(`${SN_INSTANCE}/oauth_token.do`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams(params).toString(),
    });

    const json = await snRes.json();
    if (!snRes.ok || json.error) {
      return res.status(401).json({ error: json.error_description || 'Auth failed' });
    }

    res.status(200).json({
      access_token:  json.access_token,
      expires_in:    json.expires_in,
      refresh_token: json.refresh_token,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
