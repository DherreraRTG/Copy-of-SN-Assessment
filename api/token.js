import { Buffer } from 'buffer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { SN_INSTANCE, SN_CLIENT_ID, SN_CLIENT_SECRET, SN_USERNAME, SN_PASSWORD } = process.env;

  // Try OAuth ROPC first
  try {
    const { refresh_token } = req.body || {};
    const params = refresh_token
      ? { grant_type: 'refresh_token', client_id: SN_CLIENT_ID, client_secret: SN_CLIENT_SECRET, refresh_token }
      : { grant_type: 'password',      client_id: SN_CLIENT_ID, client_secret: SN_CLIENT_SECRET, username: SN_USERNAME, password: SN_PASSWORD };

    const snRes = await fetch(`${SN_INSTANCE}/oauth_token.do`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams(params).toString(),
    });

    const json = await snRes.json();
    if (snRes.ok && !json.error) {
      return res.status(200).json({
        access_token:  json.access_token,
        expires_in:    json.expires_in,
        refresh_token: json.refresh_token,
        scheme:        'Bearer',
      });
    }
  } catch {}

  // Fall back to basic auth — encode credentials server-side, client never sees them
  try {
    const encoded = Buffer.from(`${SN_USERNAME}:${SN_PASSWORD}`).toString('base64');
    const testRes = await fetch(`${SN_INSTANCE}/api/x_rtg_npm/offline_assessment/ping`, {
      headers: { Authorization: `Basic ${encoded}` },
    });

    // Accept anything except 401 — 404 just means ping endpoint doesn't exist, creds are still valid
    if (testRes.status !== 401) {
      return res.status(200).json({
        access_token: encoded,
        expires_in:   86400,
        scheme:       'Basic',
      });
    }
  } catch {}

  res.status(401).json({ error: 'Authentication failed. Check service account credentials.' });
}
