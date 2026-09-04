import { PublicError, type GratitudeMandate } from "@thanks2go/contracts";

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
  if (mandate.rail !== "paypal" || mandate.amount.currency !== "USD" || mandate.amount.minorUnits !== 100) throw new PublicError("RAIL_REJECTED", "Only the fixed PayPal gratitude offer is accepted.");
  const token = await accessToken();
  const response = await fetch(`${endpoint()}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": mandate.idempotencyKey },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{ reference_id: mandate.id, custom_id: mandate.id, description: "Voluntary gratitude tip", amount: { currency_code: "USD", value: "1.00" } }],
      payment_source: { paypal: { experience_context: { shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW", return_url: `${mandate.profileUrl}?paypal=return`, cancel_url: `${mandate.profileUrl}?paypal=cancel` } } }
    }),
    signal: AbortSignal.timeout(8_000)
  });
  const body = await response.json() as { id?: string; status?: string; links?: Array<{ rel?: string; href?: string }> };
  const approveUrl = body.links?.find((link) => link.rel === "payer-action" || link.rel === "approve")?.href;
  if (!response.ok || !body.id || !approveUrl) throw new PublicError("RAIL_REJECTED", "PayPal could not create the order.", 502);
  return { id: body.id, status: body.status ?? "CREATED", approveUrl };
}

export type PayPalCapture = { id: string; status: string; payer?: { payer_id?: string }; purchase_units?: Array<{ reference_id?: string; payments?: { captures?: Array<{ id?: string; status?: string; amount?: { currency_code?: string; value?: string } }> } }> };

export async function captureOrder(orderId: string, mandate: GratitudeMandate): Promise<PayPalCapture> {
  const token = await accessToken();
  const response = await fetch(`${endpoint()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": `${mandate.idempotencyKey}-capture` },
    signal: AbortSignal.timeout(8_000)
  });
  const body = await response.json() as PayPalCapture;
  const capture = body.purchase_units?.[0]?.payments?.captures?.[0];
  if (!response.ok || body.status !== "COMPLETED" || capture?.status !== "COMPLETED" || capture.amount?.currency_code !== "USD" || capture.amount?.value !== "1.00" || body.purchase_units?.[0]?.reference_id !== mandate.id) {
    throw new PublicError("PAYMENT_NOT_CONFIRMED", "PayPal did not confirm the exact gratitude payment.", 409);
  }
  return body;
}
