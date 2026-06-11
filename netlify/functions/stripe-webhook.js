const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  const body = event.body;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  const data = stripeEvent.data.object;

  const planMap = {
    'price_1Tg2AhL3rGpNnq8VWGI7bojw': 'player',
    'price_1Tg2AhL3rGpNnq8V4veQBEfU': 'coach',
    'price_1Tg2AhL3rGpNnq8VQONlQHex': 'club',
  };

  if (stripeEvent.type === 'customer.subscription.created' ||
      stripeEvent.type === 'customer.subscription.updated') {

    const customerId = data.customer;
    const status = data.status;
    const priceId = data.items.data[0].price.id;
    const plan = planMap[priceId] || 'player';

    const customer = await stripe.customers.retrieve(customerId);
    const email = customer.email;

    const { data: users } = await supabase.auth.admin.listUsers();
    const match = users?.users?.find(u => u.email === email);

    if (match) {
      await supabase.from('subscriptions').upsert({
        user_id: match.id,
        plan: plan,
        status: (status === 'active' || status === 'trialing') ? 'active' : status,
        stripe_customer_id: customerId,
        stripe_subscription_id: data.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    }
  }

  if (stripeEvent.type === 'customer.subscription.deleted') {
    await supabase.from('subscriptions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('stripe_customer_id', data.customer);
  }

  if (stripeEvent.type === 'invoice.payment_failed') {
    await supabase.from('subscriptions')
      .update({ status: 'past_due', updated_at: new Date().toISOString() })
      .eq('stripe_customer_id', data.customer);
  }

  if (stripeEvent.type === 'invoice.payment_succeeded') {
    await supabase.from('subscriptions')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('stripe_customer_id', data.customer);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ received: true }),
  };
};
