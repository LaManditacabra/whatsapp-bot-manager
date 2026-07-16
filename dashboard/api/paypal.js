let config = { clientId: '', clientSecret: '', mode: 'sandbox' };

const API_BASE = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  live: 'https://api-m.paypal.com',
};

function baseUrl() {
  return API_BASE[config.mode] || API_BASE.sandbox;
}

let _token = null;
let _tokenExpiry = 0;

async function getAccessToken() {
  if (Date.now() < _tokenExpiry) return _token;

  const res = await fetch(`${baseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Authorization': 'Basic ' + Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`PayPal auth error: ${res.status}`);
  const data = await res.json();
  _token = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return _token;
}

export function configurePayPal({ clientId, clientSecret, mode }) {
  config = { clientId, clientSecret, mode: mode || 'sandbox' };
  _token = null;
  _tokenExpiry = 0;
}

export function isPayPalConfigured() {
  return !!(config.clientId && config.clientSecret);
}

export async function createOrder({ title, price, description, externalReference, returnUrl, cancelUrl }) {
  const token = await getAccessToken();
  const res = await fetch(`${baseUrl()}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: externalReference,
        description: description || title,
        custom_id: externalReference,
        amount: {
          currency_code: 'USD',
          value: String(price),
        },
      }],
      application_context: {
        brand_name: 'WhatsApp Bot Manager',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal createOrder error: ${res.status} ${err}`);
  }
  const data = await res.json();
  const approveLink = data.links?.find(l => l.rel === 'approve')?.href;
  return { id: data.id, status: data.status, approveLink };
}

export async function captureOrder(orderId) {
  const token = await getAccessToken();
  const res = await fetch(`${baseUrl()}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: '{}',
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal captureOrder error: ${res.status} ${err}`);
  }
  const data = await res.json();
  const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
  return {
    id: data.id,
    status: data.status,
    captureId: capture?.id,
    captureStatus: capture?.status,
    externalReference: data.purchase_units?.[0]?.reference_id || data.purchase_units?.[0]?.custom_id,
    payerEmail: data.payer?.email_address,
  };
}

export async function verifyWebhook(headers, body) {
  const token = await getAccessToken();
  const res = await fetch(`${baseUrl()}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: config.webhookId,
      webhook_event: body,
    }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  return data.verification_status === 'SUCCESS';
}
