import { afterEach, describe, expect, it, vi } from "vitest";
import { newMandate } from "@thanks2go/contracts";
import { captureOrder, createOrder } from "../api/paypal.js";

const orderId = "TESTORDER123456789";
const mandate = () => newMandate({ profileUrl: "https://thanks2go.securedme.ca/p/securedme", rail: "paypal" }, "a".repeat(64));
const reply = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
function provider(m: ReturnType<typeof mandate>, status = "APPROVED") {
  return { id: orderId, intent: "CAPTURE", status, purchase_units: [{ reference_id: m.id, custom_id: m.id,
    amount: { currency_code: "USD", value: "2.00" },
    payments: { captures: [{ id: "CAPTURE123", status: "COMPLETED", amount: { currency_code: "USD", value: "2.00" } }] }
  }] };
}
function setup(...responses: unknown[]) {
  vi.stubEnv("PAYPAL_T2G_CLIENT_ID", "test-client");
  vi.stubEnv("PAYPAL_T2G_CLIENT_SECRET", "test-secret");
  const mock = vi.fn().mockResolvedValueOnce(reply({ access_token: "test-token" }));
  for (const response of responses) mock.mockResolvedValueOnce(reply(response));
  vi.stubGlobal("fetch", mock);
  return mock;
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("PayPal order creation boundary", () => {
  it("creates the fixed offer with the mandate idempotency key", async () => {
    const m = mandate();
    const mock = setup({ id: orderId, status: "CREATED", links: [{ rel: "payer-action", href: "https://www.sandbox.paypal.com/checkoutnow?token=TEST" }] });
    await expect(createOrder(m)).resolves.toEqual({ id: orderId, status: "CREATED", approveUrl: "https://www.sandbox.paypal.com/checkoutnow?token=TEST" });
    expect(mock).toHaveBeenCalledTimes(2);
    expect(mock.mock.calls[1]?.[1]).toMatchObject({ method: "POST", headers: { "PayPal-Request-Id": m.idempotencyKey } });
    const body = JSON.parse(String(mock.mock.calls[1]?.[1]?.body));
    expect(body.purchase_units).toEqual([{ reference_id: m.id, custom_id: m.id, description: "Voluntary gratitude tip", amount: { currency_code: "USD", value: "2.00" } }]);
  });

  it("sanitizes an OAuth rejection before order creation", async () => {
    vi.stubEnv("PAYPAL_T2G_CLIENT_ID", "test-client");
    vi.stubEnv("PAYPAL_T2G_CLIENT_SECRET", "test-secret");
    const mock = vi.fn().mockResolvedValue(new Response("<html>provider detail</html>", {status:401}));
    vi.stubGlobal("fetch", mock);
    await expect(createOrder(mandate())).rejects.toMatchObject({code:"RAIL_REJECTED",message:"PayPal authentication failed."});
    expect(mock).toHaveBeenCalledOnce();
  });

  it("rejects malformed provider success without leaking it", async () => {
    vi.stubEnv("PAYPAL_T2G_CLIENT_ID", "test-client");
    vi.stubEnv("PAYPAL_T2G_CLIENT_SECRET", "test-secret");
    const mock = vi.fn()
      .mockResolvedValueOnce(reply({access_token:"test-token"}))
      .mockResolvedValueOnce(new Response("<html>provider detail</html>", {status:200}));
    vi.stubGlobal("fetch", mock);
    await expect(createOrder(mandate())).rejects.toMatchObject({code:"RAIL_REJECTED",message:"PayPal could not create the order."});
  });

  it("rejects a changed amount before contacting PayPal", async () => {
    const m = mandate();
    (m.amount as {currency:"USD";minorUnits:number}).minorUnits = 201;
    const mock = vi.fn(); vi.stubGlobal("fetch", mock);
    await expect(createOrder(m)).rejects.toMatchObject({code:"RAIL_REJECTED"});
    expect(mock).not.toHaveBeenCalled();
  });
});

describe("PayPal capture boundary", () => {
  it.each(["reference", "amount", "currency", "custom", "intent", "extra-unit"])("rejects mismatched %s before capture", async field => {
    const m = mandate(); const details = provider(m); const unit = details.purchase_units[0]!;
    if (field === "reference") unit.reference_id = crypto.randomUUID();
    if (field === "custom") unit.custom_id = crypto.randomUUID();
    if (field === "amount") unit.amount.value = "1.00";
    if (field === "currency") unit.amount.currency_code = "CAD";
    if (field === "intent") details.intent = "AUTHORIZE";
    if (field === "extra-unit") details.purchase_units.push({ ...unit });
    const fetchMock = setup(details);
    await expect(captureOrder(orderId, m)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/capture"))).toBe(false);
  });
  it("requires provider-recorded payer approval", async () => {
    const m = mandate(); const mock = setup(provider(m, "CREATED"));
    await expect(captureOrder(orderId, m)).rejects.toMatchObject({ code: "HUMAN_APPROVAL_REQUIRED" });
    expect(mock).toHaveBeenCalledTimes(2);
  });
  it("returns an already completed exact order without another capture", async () => {
    const m = mandate(); const mock = setup(provider(m, "COMPLETED"));
    await expect(captureOrder(orderId, m)).resolves.toMatchObject({ status: "COMPLETED" });
    expect(mock).toHaveBeenCalledTimes(2);
  });
  it("captures an approved matching order with stable idempotency", async () => {
    const m = mandate(); const mock = setup(provider(m), provider(m, "COMPLETED"));
    await expect(captureOrder(orderId, m)).resolves.toMatchObject({ status: "COMPLETED" });
    expect(mock.mock.calls[2]?.[1]).toMatchObject({ method: "POST", headers: { "PayPal-Request-Id": `${m.idempotencyKey}-capture` } });
  });
  it("rejects an expired mandate without contacting PayPal", async () => {
    const m = newMandate({ profileUrl: "https://thanks2go.securedme.ca/p/securedme", rail: "paypal" }, "a".repeat(64), new Date(Date.now() - 700_000));
    const mock = setup();
    await expect(captureOrder(orderId, m)).rejects.toMatchObject({ code: "MANDATE_EXPIRED" });
    expect(mock).not.toHaveBeenCalled();
  });
});
