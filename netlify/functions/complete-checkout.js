const Stripe = require('stripe');
const crypto = require('crypto');

function mintToken(sessionId) {
  const payload = Buffer.from(JSON.stringify({
    sessionId,
    expiresAt: Date.now() + 72 * 60 * 60 * 1000,
  })).toString('base64url');
  const sig = crypto
    .createHmac('sha256', process.env.TOKEN_SIGNING_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

exports.handler = async (event) => {
  const sessionId = event.queryStringParameters?.session_id;
  if (!sessionId) {
    return { statusCode: 400, body: 'Missing session_id' };
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return {
        statusCode: 302,
        headers: { Location: `${process.env.SITE_URL}/?payment=failed` },
        body: '',
      };
    }

    const token = mintToken(sessionId);
    return {
      statusCode: 302,
      headers: { Location: `${process.env.SITE_URL}/app/?token=${token}` },
      body: '',
    };
  } catch (err) {
    console.error('complete-checkout error:', err.message);
    return {
      statusCode: 302,
      headers: { Location: `${process.env.SITE_URL}/?payment=error` },
      body: '',
    };
  }
};
