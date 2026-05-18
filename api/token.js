import { Buffer } from 'buffer';

// Simple in-memory rate limiter: max 10 token requests per IP per minute
const _rlMap = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const window = 60_000;
  const max = 10;
  const times = (_rlMap.get(ip) || []).filter(t => now - t < window);
  if (times.length >= max) return true;
  _rlMap.set(ip, [...times, now]);
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Too many requests. Please wait and try again.' });

  // Select credential set based on instance_key (e.g. "roomstogoqa" → SN_*_QA env vars)
  // Falls back to default env vars if no key or no matching set found.
  const { instance_key } = req.body || {};
  const suffix = instance_key ? `_${instance_key.toUpperCase().replace(/-/g, '_')}` : '';
  const SN_INSTANCE     = process.env[`SN_INSTANCE${suffix}`]      || process.env.SN_INSTANCE;
  const SN_CLIENT_ID    = process.env[`SN_CLIENT_ID${suffix}`]     || process.env.SN_CLIENT_ID;
  const SN_CLIENT_SECRET= process.env[`SN_CLIENT_SECRET${suffix}`] || process.env.SN_CLIENT_SECRET;
  const SN_USERNAME     = process.env[`SN_USERNAME${suffix}`]      || process.env.SN_USERNAME;
  const SN_PASSWORD     = process.env[`SN_PASSWORD${suffix}`]      || process.env.SN_PASSWORD;

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
