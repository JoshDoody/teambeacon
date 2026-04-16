const crypto = require('crypto');

function verifyToken(token) {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;

  const expectedSig = crypto
    .createHmac('sha256', process.env.TOKEN_SIGNING_SECRET)
    .update(payload)
    .digest('base64url');

  // Timing-safe comparison (must be same length)
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  const token = event.queryStringParameters?.token;
  if (!token) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valid: false }),
    };
  }

  const data = verifyToken(token);
  if (!data || data.expiresAt <= Date.now()) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valid: false }),
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ valid: true, expiresAt: data.expiresAt }),
  };
};
