/// <reference path="./types.d.ts" />
import { z } from "zod";

const canonicalProfile = "https://thanks2go.securedme.ca/p/securedme";
const empty = z.object({}).strict();
const stageInput = z.discriminatedUnion("rail", [
  z.object({ rail: z.literal("paypal") }).strict(),
  z.object({ rail: z.literal("solana-devnet"), solAmount: z.enum(["0.001", "0.005", "0.01"]) }).strict()
]);
const receiptSchema = z.object({
  version: z.literal("1"), mandateHash: z.string().regex(/^[a-f0-9]{64}$/),
  rail: z.enum(["paypal", "solana-devnet"]), status: z.enum(["confirmed", "failed", "cancelled"]),
  providerReference: z.string().min(1).max(200),
  payerReference: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  confirmedAt: z.string().datetime().optional(), credential: z.string().min(1).max(16000)
}).strict();
const result = (value: unknown, isError = false) => ({ content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value, isError });
// Optional descriptive metadata for directory scanners; native registration may ignore it.
const outputFields: Record<string, Record<string, unknown>> = {
  inspect_gratitude_profile: {profileUrl:{type:"string",format:"uri"},currentPageOrigin:{type:"string"},canonicalOriginMatch:{type:"boolean"},transportSecurity:{enum:["tls","local-development","insecure"]},originControlled:{type:"boolean"},humanIdentityVerified:{const:false},paypalEnvironment:{enum:["live","sandbox"]},solanaNetwork:{const:"devnet"},solanaDestinationConfigured:{type:"boolean"},evidenceJwksUrl:{type:"string",format:"uri"},payerAgentCardUrl:{type:"string",format:"uri"},recipientAgentCardUrl:{type:"string",format:"uri"},paymentInitiated:{const:false},secretsReturned:{const:false},humanApprovalRequired:{const:true},trustStatement:{type:"string"}},
  stage_gratitude_intent: {state:{const:"STAGED"},profileUrl:{type:"string",format:"uri"},rail:{enum:["paypal","solana-devnet"]},amount:{type:"object"},mandateHash:{type:"string",pattern:"^[a-f0-9]{64}$"},expiresAt:{type:"string",format:"date-time"},recipientAttestationHash:{type:"string",pattern:"^[a-f0-9]{64}$"},recipientControlCredential:{type:"string"},verificationJwksUrl:{type:"string",format:"uri"},paymentInitiated:{const:false},secretsReturned:{const:false},humanApprovalRequired:{const:true},prohibitedActions:{type:"array",items:{type:"string"}},nextStep:{type:"string"}},
  open_payment_handoff: {opened:{const:true},focusTarget:{const:"#rails"},paymentInitiated:{const:false},secretsReturned:{const:false},humanApprovalRequired:{const:true},prohibitedActions:{type:"array",items:{type:"string"}}},
  verify_gratitude_receipt: {cryptographicValidity:{const:true},rail:{enum:["paypal","solana-devnet"]},paymentStatus:{enum:["confirmed","failed","cancelled"]},settlementConfirmed:{type:"boolean"},usableAsPaymentProof:{type:"boolean"},mandateHash:{type:"string",pattern:"^[a-f0-9]{64}$"},providerReference:{type:"string"},credentialType:{const:"vc+jwt"},paymentInitiated:{const:false},secretsReturned:{const:false},guidance:{type:"string"}}
};
function outputSchema(name: string): Record<string, unknown> {
  const fields = outputFields[name]!;
  return {type:"object",properties:{
    content:{type:"array",items:{type:"object",properties:{type:{const:"text"},text:{type:"string"}},required:["type","text"],additionalProperties:false}},
    isError:{type:"boolean"}, structuredContent:{oneOf:[
      {type:"object",properties:fields,required:Object.keys(fields),additionalProperties:false},
      {type:"object",properties:{ok:{const:false},code:{type:"string"},paymentInitiated:{const:false},humanApprovalRequired:{const:true}},required:["ok","code","paymentInitiated","humanApprovalRequired"],additionalProperties:false}
    ]}
  },required:["content","isError","structuredContent"],additionalProperties:false};
}
class ToolFailure extends Error { constructor(readonly code: string) { super(code); } }
export type WebMcpNotice = { message: string; rail?: "paypal" | "solana-devnet"; solAmount?: string };

export async function registerThanks2GoTools(profileUrl: string, notify: (notice: WebMcpNotice) => void = () => {}, lifecycle?: AbortSignal): Promise<AbortController | undefined> {
  if (!document.modelContext || typeof document.modelContext.registerTool !== "function") return undefined;
  if (profileUrl !== canonicalProfile) throw new Error("INVALID_PROFILE_URL");
  const context = document.modelContext;
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (lifecycle?.aborted) return controller;
  lifecycle?.addEventListener("abort", cancel, {once:true});
  controller.signal.addEventListener("abort", () => lifecycle?.removeEventListener("abort", cancel), {once:true});
  const options = { signal: controller.signal };

  async function request(path: string, body?: unknown): Promise<Record<string, any>> {
    const response = await fetch(path, {
      ...(body === undefined ? {} : {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)}),
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]),
      credentials: "same-origin", redirect: "error"
    });
    if (!response.ok) throw new ToolFailure("REQUEST_REJECTED");
    const text = await response.text();
    if (text.length > 32768) throw new ToolFailure("INVALID_RESPONSE");
    const data: unknown = JSON.parse(text);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new ToolFailure("INVALID_RESPONSE");
    return data as Record<string, any>;
  }
  function tool(name: string, description: string, schema: z.ZodType, readOnlyHint: boolean, run: (input: any) => Promise<unknown> | unknown): WebMcpTool {
    return {name, description, inputSchema: z.toJSONSchema(schema) as Record<string, unknown>, outputSchema: outputSchema(name),
      annotations:{readOnlyHint},
      async execute(input) {
        try {
          if (controller.signal.aborted) throw new ToolFailure("TOOL_UNAVAILABLE");
          return result(await run(schema.parse(input)));
        } catch(error) {
          const code = error instanceof z.ZodError ? "INVALID_INPUT" : error instanceof ToolFailure ? error.code : "REQUEST_FAILED";
          notify({message: "Agent assistance could not complete this step. You can still use the visible controls."});
          return result({ok:false, code, paymentInitiated:false, humanApprovalRequired:true}, true);
        }
      }
    };
  }
  const tools = [
    tool("inspect_gratitude_profile",
      "Read this visible canonical profile's origin claim, rail availability and devnet destination. No human identity verification; no payment action.",
      empty, true, async () => {
        const data = await request("/api/profiles/securedme");
        if (data.profileUrl !== profileUrl || data.attestation?.humanIdentityVerified !== false ||
            typeof data.paypal?.enabled !== "boolean" || !["live", "sandbox"].includes(data.paypal?.environment) ||
            data.solana?.network !== "devnet" || typeof data.solana?.recipient !== "string") throw new ToolFailure("INVALID_RESPONSE");
        const currentPageOrigin = location.origin;
        const localDevelopment = ["localhost", "127.0.0.1"].includes(location.hostname);
        return {profileUrl, currentPageOrigin, canonicalOriginMatch:currentPageOrigin === new URL(profileUrl).origin,
          transportSecurity:location.protocol === "https:" ? "tls" : localDevelopment ? "local-development" : "insecure",
          originControlled:data.attestation.originControlled === true, humanIdentityVerified:false,
          paypalEnvironment:data.paypal.environment, solanaNetwork:"devnet", solanaDestinationConfigured:Boolean(data.solana.recipient),
          evidenceJwksUrl:`${new URL(profileUrl).origin}/.well-known/jwks.json`,
          payerAgentCardUrl:`${new URL(profileUrl).origin}/agents/payer/.well-known/agent-card.json`,
          recipientAgentCardUrl:`${new URL(profileUrl).origin}/agents/recipient/.well-known/agent-card.json`,
          paymentInitiated:false, secretsReturned:false, humanApprovalRequired:true,
          trustStatement:"Origin and configured rail control only. Human identity, profile safety and payer identity are not verified."};
      }),
    tool("stage_gratitude_intent",
      "Prepare a ten-minute intent for PayPal USD 1 or an explicit Solana devnet preset. Returns a summary, never a payment token. The human must review and approve using the visible controls.",
      stageInput, false, async (input) => {
        const data = await request("/api/intents/stage", {profileUrl, ...input});
        const mandate = data.mandate;
        const expected = input.rail === "paypal" ? {currency:"USD", minorUnits:100} :
          {currency:"SOL", atomicUnits:String(Math.round(Number(input.solAmount)*1e9))};
        if (data.state !== "STAGED" || data.humanApprovalRequired !== true ||
            mandate?.profileUrl !== profileUrl || mandate?.rail !== input.rail ||
            !/^[a-f0-9]{64}$/.test(data.mandateHash ?? "") ||
            !mandate.amount || Object.entries(expected).some(([key,value])=>mandate.amount[key] !== value) ||
            !Number.isFinite(Date.parse(mandate.expiresAt)) || Date.parse(mandate.expiresAt) <= Date.now() ||
            Date.parse(mandate.expiresAt) - Date.now() > 600000) throw new ToolFailure("INVALID_RESPONSE");
        const recipient = data.agentExchange?.recipient;
        if (!/^[a-f0-9]{64}$/.test(recipient?.recipientAttestationHash ?? "") ||
            typeof recipient?.credential !== "string" || recipient.credential.split(".").length !== 3) throw new ToolFailure("INVALID_RESPONSE");
        notify({rail:input.rail, solAmount:input.solAmount,
          message: `Agent prepared ${input.rail === "paypal" ? "$1.00 USD via PayPal" : input.solAmount+" SOL on devnet"}. Review the visible controls; no payment has started.`});
        return {state:"STAGED", profileUrl, rail:input.rail, amount:expected, mandateHash:data.mandateHash,
          expiresAt:mandate.expiresAt, recipientAttestationHash:recipient.recipientAttestationHash,
          recipientControlCredential:recipient.credential, verificationJwksUrl:`${new URL(profileUrl).origin}/.well-known/jwks.json`,
          paymentInitiated:false, secretsReturned:false, humanApprovalRequired:true,
          prohibitedActions:["approve_payment","capture_paypal","sign_wallet_transaction"],
          nextStep:"open_payment_handoff; the human reviews and stages a fresh payment using the visible controls"};
      }),
    tool("open_payment_handoff",
      "Scroll to and focus the visible payment choices. Does not click, approve, open PayPal, capture funds or sign a wallet transaction.",
      empty, false, () => {
        const panel = document.querySelector<HTMLElement>("#rails");
        if (!panel) throw new ToolFailure("HANDOFF_UNAVAILABLE");
        panel.scrollIntoView({behavior:"instant", block:"start"});
        panel.focus();
        if (document.activeElement !== panel) throw new ToolFailure("HANDOFF_UNAVAILABLE");
        return {opened:true, focusTarget:"#rails", paymentInitiated:false, secretsReturned:false, humanApprovalRequired:true,
          prohibitedActions:["approve_payment","capture_paypal","sign_wallet_transaction"]};
      }),
    tool("verify_gratitude_receipt",
      "Verify the signature and field binding of an existing Thanks2Go receipt. Valid does not mean confirmed: inspect the returned paymentStatus. No payment action.",
      z.object({receipt:receiptSchema}).strict(), true, async (input) => {
        const data = await request("/api/receipts/verify", input.receipt);
        if (data.valid !== true) throw new ToolFailure("INVALID_RECEIPT");
        const verified = receiptSchema.parse(data.receipt);
        if (Object.keys(input.receipt).some(key=>input.receipt[key] !== (verified as any)[key])) throw new ToolFailure("INVALID_RECEIPT");
        const settlementConfirmed = verified.status === "confirmed";
        return {cryptographicValidity:true, rail:verified.rail, paymentStatus:verified.status,
          settlementConfirmed, usableAsPaymentProof:settlementConfirmed, mandateHash:verified.mandateHash,
          providerReference:verified.providerReference, credentialType:"vc+jwt", paymentInitiated:false, secretsReturned:false,
          guidance:settlementConfirmed ? "Signature and provider-confirmed status match." : "Signature is valid, but this receipt is not proof of a completed payment."};
      })
  ];
  try {
    for (const entry of tools) {
      if (controller.signal.aborted) break;
      await context.registerTool(entry, options);
    }
    return controller;
  } catch(error) { controller.abort(); throw error; }
}
