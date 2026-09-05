import { PAYPAL_GRATITUDE_MINOR_UNITS, PAYPAL_GRATITUDE_VALUE, assertMandateActive, PublicError, type GratitudeMandate } from "../packages/contracts/src/index.js";

const endpoint = () => process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

async function accessToken(): Promise<string> {
  const id = process.env.PAYPAL_T2G_CLIENT_ID;
  const secret = process.env.PAYPAL_T2G_CLIENT_SECRET;
  if (!id || !secret) throw new PublicError("RAIL_REJECTED", "PayPal is not configured in this environment.", 503);
  const response = await fetch(`${endpoint()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(8_000)
  });
  if (!response.ok) throw new PublicError("RAIL_REJECTED", "PayPal authentication failed.", 502);
  const body = await response.json() as { access_token: string };
  return body.access_token;
}

export async function createOrder(mandate: GratitudeMandate): Promise<{ id: string; status: string; approveUrl: string }> {
  if (mandate.rail !== "paypal" || mandate.amount.currency !== "USD" || mandate.amount.minorUnits !== PAYPAL_GRATITUDE_MINOR_UNITS) throw new PublicError("RAIL_REJECTED", "Only the fixed PayPal gratitude offer is accepted.");
  const token = await accessToken();
  const sandboxOrigin = process.env.PAYPAL_ENV !== "live" ? process.env.PAYPAL_SANDBOX_RETURN_ORIGIN : undefined;
  const returnProfile = sandboxOrigin ? new URL("/p/securedme", sandboxOrigin).href : mandate.profileUrl;
  const response = await fetch(`${endpoint()}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": mandate.idempotencyKey },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{ reference_id: mandate.id, custom_id: mandate.id, description: "Voluntary gratitude tip", amount: { currency_code: "USD", value: PAYPAL_GRATITUDE_VALUE } }],
      payment_source: { paypal: { experience_context: { shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW", return_url: `${returnProfile}?paypal=return`, cancel_url: `${returnProfile}?paypal=cancel` } } }
    }),
    signal: AbortSignal.timeout(8_000)
  });
  const body = await response.json() as { id?: string; status?: string; links?: Array<{ rel?: string; href?: string }> };
  const approveUrl = body.links?.find((link) => link.rel === "payer-action" || link.rel === "approve")?.href;
  if (!response.ok || !body.id || !approveUrl) throw new PublicError("RAIL_REJECTED", "PayPal could not create the order.", 502);
  return { id: body.id, status: body.status ?? "CREATED", approveUrl };
}

export type PayPalCapture = { id: string; status: string; intent?: string; payer?: { payer_id?: string }; purchase_units?: Array<{ reference_id?: string; custom_id?: string; amount?: { currency_code?: string; value?: string }; payments?: { captures?: Array<{ id?: string; status?: string; amount?: { currency_code?: string; value?: string } }> } }> };

function assertConfirmed(body: PayPalCapture, mandate: GratitudeMandate): void {
  const unit = body.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  if (body.status !== "COMPLETED" || body.purchase_units?.length !== 1 || unit?.payments?.captures?.length !== 1 || !capture?.id || capture.status !== "COMPLETED" || capture.amount?.currency_code !== "USD" || capture.amount?.value !== PAYPAL_GRATITUDE_VALUE || unit?.reference_id !== mandate.id) {
    throw new PublicError("PAYMENT_NOT_CONFIRMED", "PayPal did not confirm the exact gratitude payment.", 409);
  }
}

export async function captureOrder(orderId: string, mandate: GratitudeMandate): Promise<PayPalCapture> {
  assertMandateActive(mandate);
  if (mandate.rail !== "paypal" || mandate.amount.currency !== "USD" || mandate.amount.minorUnits !== PAYPAL_GRATITUDE_MINOR_UNITS || !/^[A-Z0-9]{8,64}$/.test(orderId)) {
    throw new PublicError("RAIL_REJECTED", "Invalid PayPal capture mandate or order.");
  }
  const token = await accessToken();
  const orderUrl = `${endpoint()}/v2/checkout/orders/${encodeURIComponent(orderId)}`;
  // Validate provider-owned order details BEFORE any operation that can move money.
  const detailsResponse = await fetch(orderUrl, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8_000)
  });
  const details = await detailsResponse.json() as PayPalCapture;
  const unit = details.purchase_units?.[0];
  if (!detailsResponse.ok || details.id !== orderId || details.intent !== "CAPTURE" || details.purchase_units?.length !== 1 || unit?.reference_id !== mandate.id || unit.custom_id !== mandate.id || unit.amount?.currency_code !== "USD" || unit.amount.value !== PAYPAL_GRATITUDE_VALUE) {
    throw new PublicError("PAYMENT_NOT_CONFIRMED", "The PayPal order does not match this mandate.", 409);
  }
  if (details.status === "COMPLETED") { assertConfirmed(details, mandate); return details; }
  if (details.status !== "APPROVED") throw new PublicError("HUMAN_APPROVAL_REQUIRED", "PayPal has not recorded the payer's approval.", 409);
  const response = await fetch(`${endpoint()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": `${mandate.idempotencyKey}-capture`, Prefer: "return=representation" },
    signal: AbortSignal.timeout(8_000)
  });
  const body = await response.json() as PayPalCapture;
  if (!response.ok || body.id !== orderId) {
    throw new PublicError("PAYMENT_NOT_CONFIRMED", "PayPal did not confirm the exact gratitude payment.", 409);
  }
  assertConfirmed(body, mandate);
  return body;
}
