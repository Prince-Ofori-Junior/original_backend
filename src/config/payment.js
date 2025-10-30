const Stripe = require('stripe');
const Paypal = require('@paypal/checkout-server-sdk');
const axios = require('axios');
const logger = require('../config/logger');

// -------------------- STRIPE --------------------
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-08-16',
  maxNetworkRetries: 2,
  timeout: 10000,
});

const createStripePaymentIntent = async (amount, currency = 'usd', metadata = {}, idempotencyKey) => {
  if (!amount || amount <= 0) throw new Error('Invalid payment amount');
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata,
      automatic_payment_methods: { enabled: true },
    }, { idempotencyKey });

    logger.info(`✅ Stripe PaymentIntent created: ${paymentIntent.id}`);
    return paymentIntent;
  } catch (err) {
    logger.error(`❌ Stripe payment failed: ${err.message}`);
    throw new Error('Stripe payment failed');
  }
};

const verifyStripeWebhook = (req, signature, webhookSecret) => {
  try {
    return stripe.webhooks.constructEvent(req.rawBody, signature, webhookSecret);
  } catch (err) {
    logger.error(`❌ Stripe webhook verification failed: ${err.message}`);
    throw new Error('Invalid Stripe webhook signature');
  }
};

// -------------------- PAYPAL --------------------
const paypalEnv = new Paypal.core.SandboxEnvironment(
  process.env.PAYPAL_CLIENT_ID,
  process.env.PAYPAL_CLIENT_SECRET
);
const paypalClient = new Paypal.core.PayPalHttpClient(paypalEnv);

const createPaypalOrder = async (amount, currency = 'USD') => {
  if (!amount || amount <= 0) throw new Error('Invalid PayPal amount');
  try {
    const request = new Paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{ amount: { currency_code: currency, value: amount } }],
    });

    const response = await paypalClient.execute(request);
    logger.info(`✅ PayPal order created: ${response.result.id}`);
    return response.result;
  } catch (err) {
    logger.error(`❌ PayPal payment failed: ${err.message}`);
    throw new Error('PayPal payment failed');
  }
};

// -------------------- FLUTTERWAVE --------------------
const createFlutterwavePayment = async (payload) => {
  if (!payload) throw new Error('Flutterwave payload required');
  try {
    const response = await axios.post('https://api.flutterwave.com/v3/payments', payload, {
      headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` },
    });

    logger.info(`✅ Flutterwave payment initialized: ${response.data.data.id}`);
    return response.data;
  } catch (err) {
    logger.error(`❌ Flutterwave payment failed: ${err.message}`);
    throw new Error('Flutterwave payment failed');
  }
};

// -------------------- MOBILE MONEY --------------------
const createMobileMoneyPayment = async (provider, payload) => {
  if (!provider || !payload) throw new Error('Provider and payload are required');
  try {
    let url;
    switch (provider.toUpperCase()) {
      case 'MTN': url = process.env.MTN_API_URL; break;
      case 'AIRTEL': url = process.env.AIRTEL_API_URL; break;
      case 'TIGO': url = process.env.TIGO_API_URL; break;
      case 'TELECEL': url = process.env.TELECEL_API_URL; break;
      case 'CASHUP': url = process.env.CASHUP_API_URL; break;
      default: throw new Error('Unsupported mobile money provider');
    }

    const response = await axios.post(url, payload, {
      headers: { Authorization: `Bearer ${process.env.MOBILE_MONEY_API_KEY}` },
    });

    logger.info(`✅ ${provider} payment initiated: ${JSON.stringify(response.data)}`);
    return response.data;
  } catch (err) {
    logger.error(`❌ ${provider} payment failed: ${err.message}`);
    throw new Error(`${provider} payment failed`);
  }
};

module.exports = {
  stripe,
  createStripePaymentIntent,
  verifyStripeWebhook,
  createPaypalOrder,
  createFlutterwavePayment,
  createMobileMoneyPayment,
};
