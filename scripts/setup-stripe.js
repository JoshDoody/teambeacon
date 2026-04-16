const Stripe = require('stripe');

async function main() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error('Error: STRIPE_SECRET_KEY environment variable is not set.');
    console.error('Usage: STRIPE_SECRET_KEY=sk_test_... node scripts/setup-stripe.js');
    process.exit(1);
  }

  const stripe = new Stripe(secretKey);

  console.log('Creating TeamBeacon product and price on Stripe...');

  const product = await stripe.products.create({
    name: 'TeamBeacon',
    description: 'Workforce 9-Box Analysis Tool — one-time access',
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 4900, // $49.00
    currency: 'usd',
  });

  console.log('\n✓ Done! Add this environment variable to Netlify:\n');
  console.log(`  STRIPE_PRICE_ID=${price.id}\n`);
  console.log('In Netlify dashboard: Site settings → Environment variables → Add variable');
  console.log('(This one is not a secret — no need to mark it as such.)');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
