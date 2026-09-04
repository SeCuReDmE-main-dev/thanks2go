import bs58 from "bs58";
import { PublicError, type GratitudeMandate } from "@thanks2go/contracts";

export async function verifySolanaTransaction(signature: string, mandate: GratitudeMandate, recipient: string): Promise<void> {
  if (mandate.rail !== "solana-devnet" || mandate.amount.currency !== "SOL") throw new PublicError("RAIL_REJECTED", "The mandate is not a Solana devnet mandate.");
  if (bs58.decode(recipient).length !== 32 || bs58.decode(signature).length !== 64) throw new PublicError("PAYMENT_NOT_CONFIRMED", "Invalid devnet recipient or transaction signature.", 409);
  const rpcResponse = await fetch("https://api.devnet.solana.com", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: mandate.id, method: "getTransaction", params: [signature, { commitment: "finalized", encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }] }),
    signal: AbortSignal.timeout(8_000)
  });
  if (!rpcResponse.ok) throw new PublicError("PAYMENT_NOT_CONFIRMED", "Solana devnet RPC was unavailable.", 502);
  const payload = await rpcResponse.json() as { result?: { blockTime?: number; meta?: { err?: unknown; preBalances?: number[]; postBalances?: number[] }; transaction?: { message?: { accountKeys?: Array<string | { pubkey?: string }> } } } };
  const transaction = payload.result;
  if (!transaction || transaction.meta?.err || !transaction.meta?.preBalances || !transaction.meta.postBalances) throw new PublicError("PAYMENT_NOT_CONFIRMED", "The devnet transaction is not finalized.", 409);
  const keys = (transaction.transaction?.message?.accountKeys ?? []).map((entry) => typeof entry === "string" ? entry : entry.pubkey ?? "");
  const recipientIndex = keys.indexOf(recipient);
  if (recipientIndex < 0) throw new PublicError("PAYMENT_NOT_CONFIRMED", "The devnet recipient does not match.", 409);
  const blockTime = (transaction.blockTime ?? 0) * 1000;
  if (blockTime < Date.parse(mandate.issuedAt) - 30_000 || blockTime > Date.parse(mandate.expiresAt) + 30_000) throw new PublicError("PAYMENT_NOT_CONFIRMED", "The devnet transaction is outside the signed mandate window.", 409);
  const delta = BigInt(transaction.meta.postBalances[recipientIndex]!) - BigInt(transaction.meta.preBalances[recipientIndex]!);
  if (delta !== BigInt(mandate.amount.atomicUnits)) throw new PublicError("PAYMENT_NOT_CONFIRMED", "The devnet amount does not match the mandate.", 409);
}
