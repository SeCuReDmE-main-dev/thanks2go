import { AgentCard, Message, Role, SendMessageRequest, generateAgentCardSignature } from "@a2a-js/sdk";
import { ClientFactory } from "@a2a-js/sdk/client";
import { AgentEvent, AgentExecutor, ExecutionEventBus, RequestContext } from "@a2a-js/sdk/server";
import { importJWK, type JWK } from "jose";

export type AgentKind = "payer" | "recipient";

export function unsignedAgentCard(kind: AgentKind, origin: string): AgentCard {
  const payer = kind === "payer";
  return {
    name: payer ? "Thanks2Go Payer Intent Agent" : "Thanks2Go Recipient Trust Agent",
    description: payer ? "Stages exact gratitude mandates after a human selects a rail and amount." : "Verifies canonical origin and declared rail-destination control.",
    version: "1.0.0",
    capabilities: { streaming: false, pushNotifications: false, extensions: [] },
    supportedInterfaces: [{ url: `${origin}/api/a2a/${kind}`, protocolBinding: "JSONRPC", protocolVersion: "1.0", tenant: "" }],
    provider: { organization: "SecuredMe", url: "https://securedme.ca" },
    securitySchemes: {},
    securityRequirements: [],
    defaultInputModes: ["application/json", "text/plain"],
    defaultOutputModes: ["application/json", "text/plain"],
    skills: [{
      id: payer ? "stage-gratitude-mandate" : "verify-recipient-control",
      name: payer ? "Stage gratitude mandate" : "Verify recipient declaration",
      description: payer ? "Produces bounded intent data; never approves or pays." : "Checks first-party control claims; never verifies human identity.",
      tags: ["gratitude", "human-approved", "non-authoritative"],
      examples: [],
      inputModes: ["application/json", "text/plain"],
      outputModes: ["application/json", "text/plain"],
      securityRequirements: []
    }],
    signatures: []
  };
}

export async function signedAgentCard(kind: AgentKind, origin: string, privateJwk: JWK, kid: string): Promise<AgentCard> {
  const key = await importJWK(privateJwk, "ES256") as CryptoKey;
  const signer = generateAgentCardSignature(key, { alg: "ES256", kid, typ: "JOSE", jku: `${origin}/.well-known/jwks.json` });
  return signer(unsignedAgentCard(kind, origin));
}

export class ImmediateAgentExecutor implements AgentExecutor {
  constructor(private readonly respond: (input: unknown) => Promise<Record<string, unknown>>) {}
  async execute(context: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const parts = context.userMessage.parts;
    let statement: Record<string, unknown>;
    try {
      if (parts.length !== 1 || parts[0]?.content?.$case !== "text") throw new Error("Expected one structured text part");
      statement = await this.respond(JSON.parse(parts[0].content.value));
    } catch (error) {
      statement = { error: error && typeof error === "object" && "code" in error ? error.code : "RAIL_REJECTED", humanApprovalRequired: true };
    }
    const message: Message = {
      messageId: crypto.randomUUID(),
      role: Role.ROLE_AGENT,
      parts: [{ content: { $case: "text", value: JSON.stringify(statement) }, mediaType: "application/json", filename: "", metadata: {} }],
      taskId: context.taskId,
      contextId: context.contextId,
      extensions: [], metadata: {}, referenceTaskIds: []
    };
    eventBus.publish(AgentEvent.message(message));
  }
  async cancelTask(_taskId: string, _eventBus: ExecutionEventBus): Promise<void> {}
}

export async function sendAgentMessage(card: AgentCard, input: unknown): Promise<Record<string, unknown>> {
  const client = await new ClientFactory().createFromAgentCard(card);
  const result = await client.sendMessage(SendMessageRequest.fromJSON({ message: {
    messageId: crypto.randomUUID(), role: "ROLE_USER", parts: [{ text: JSON.stringify(input), mediaType: "application/json" }]
  } }), { signal: AbortSignal.timeout(8_000) });
  if (!("messageId" in result) || result.role !== Role.ROLE_AGENT || result.parts.length !== 1 || result.parts[0]?.content?.$case !== "text") {
    throw new Error("Expected immediate agent Message");
  }
  return JSON.parse(result.parts[0].content.value) as Record<string, unknown>;
}
