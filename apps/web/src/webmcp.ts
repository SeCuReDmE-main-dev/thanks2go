const result = (value: unknown) => ({ content: [{ type: "text", text: JSON.stringify(value) }] });

export async function registerThanks2GoTools(profileUrl: string): Promise<AbortController | undefined> {
  if (!document.modelContext) return undefined;
  const controller = new AbortController();
  const options = { signal: controller.signal };

  await document.modelContext.registerTool({
    name: "inspect_gratitude_profile",
    description: "Inspect the public control claims and enabled rails for the visible Thanks2Go profile. This does not verify a human identity.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async execute() { return result(await fetch("/api/profiles/securedme").then((response) => response.json())); }
  }, options);

  await document.modelContext.registerTool({
    name: "stage_gratitude_intent",
    description: "Stage a bounded gratitude mandate. This cannot approve, create, capture, or sign a payment.",
    inputSchema: { type: "object", properties: { rail: { type: "string", enum: ["paypal", "solana-devnet"] }, solAmount: { type: "string", enum: ["0.001", "0.005", "0.01"] } }, required: ["rail"], additionalProperties: false },
    async execute(input) {
      const response = await fetch("/api/intents/stage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileUrl, rail: input.rail, solAmount: input.solAmount }) });
      const payload = await response.json();
      return result({ ...payload, mandateToken: payload.mandateToken ? "[withheld from tool output]" : undefined, humanApprovalRequired: true });
    }
  }, options);

  await document.modelContext.registerTool({
    name: "open_payment_handoff",
    description: "Focus the visible human approval panel. It never starts or captures payment.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    execute() { document.querySelector<HTMLElement>("#rails")?.focus(); return result({ opened: true, approvalStillRequired: true }); }
  }, options);

  await document.modelContext.registerTool({
    name: "verify_gratitude_receipt",
    description: "Verify a completed gratitude receipt credential without initiating payment.",
    inputSchema: { type: "object", properties: { receipt: { type: "object" } }, required: ["receipt"], additionalProperties: false },
    async execute(input) {
      const response = await fetch("/api/receipts/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input.receipt) });
      return result(await response.json());
    }
  }, options);
  return controller;
}
