import { afterEach, describe, expect, it, vi } from "vitest";
import bs58 from "bs58";
import { newMandate, sha256 } from "@thanks2go/contracts";
import { verifySolanaTransaction } from "../api/solana.js";
import { buildDevnetInstructions } from "../apps/web/src/solana-payment.js";

const recipient = "6ywCP21EgS6a7y752rHT38qDypsb9NNLi2Db5iYXd9qj";
const sender = bs58.encode(new Uint8Array(32).fill(3));
const signature = bs58.encode(new Uint8Array(64).fill(7));
const make = () => newMandate({profileUrl:"https://thanks2go.securedme.ca/p/securedme",rail:"solana-devnet",solAmount:"0.001"},"a".repeat(64));
function fixture(mandate: ReturnType<typeof make>) {
  const hash = sha256(mandate);
  return {blockTime: Math.floor(Date.now()/1000), meta: {err:null,preBalances:[10_000_000,1_000_000],postBalances:[8_995_000,2_000_000]},transaction:{signatures:[signature],message:{accountKeys:[sender,recipient,bs58.encode(Buffer.from(hash,"hex"))],instructions:[
    {programId:"11111111111111111111111111111111",parsed:{type:"transfer",info:{destination:recipient,lamports:1_000_000}}},
    {programId:"MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",parsed:`thanks2go:${hash}`}
  ]}}};
}
afterEach(() => vi.unstubAllGlobals());
describe("mandate-bound devnet transfers", () => {
  it("builds the exact Commerce Kit SOL transfer with reference and one signed memo", async () => {
    const m = make(); const hash = sha256(m);
    const instructions = await buildDevnetInstructions(sender,recipient,{mandate:m as Parameters<typeof buildDevnetInstructions>[2]["mandate"],mandateHash:hash,reference:bs58.encode(Buffer.from(hash,"hex"))});
    expect(instructions).toHaveLength(2);
    expect(instructions[0]!.programAddress).toBe("11111111111111111111111111111111");
    expect(new DataView(instructions[0]!.data!.buffer, instructions[0]!.data!.byteOffset).getBigUint64(4,true)).toBe(1_000_000n);
    expect(instructions[0]!.accounts?.at(-1)?.address).toBe(bs58.encode(Buffer.from(hash,"hex")));
    expect(new TextDecoder().decode(instructions[1]!.data)).toBe(`thanks2go:${hash}`);
  });
  it("accepts a finalized exact transfer and permits same-mandate verification retries", async () => {
    const m=make(); vi.stubGlobal("fetch",vi.fn().mockImplementation(async()=>new Response(JSON.stringify({result:fixture(m)}))));
    await expect(verifySolanaTransaction(signature,m,recipient)).resolves.toBeUndefined();
    await expect(verifySolanaTransaction(signature,m,recipient)).resolves.toBeUndefined();
  });
  it("rejects reusing one transaction for another same-amount mandate", async () => {
    const first=make(); vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(JSON.stringify({result:fixture(first)}))));
    await expect(verifySolanaTransaction(signature,make(),recipient)).rejects.toMatchObject({code:"REFERENCE_REUSED"});
  });
  it.each(["amount","recipient","signature","finality","memo","multi-memo"])("rejects invalid %s", async fault => {
    const m=make(); const result=fixture(m);
    if(fault==="amount") result.meta.postBalances[1]=3_000_000;
    if(fault==="recipient") result.transaction.message.accountKeys[1]=sender;
    if(fault==="signature") result.transaction.signatures[0]=bs58.encode(new Uint8Array(64).fill(8));
    if(fault==="memo") result.transaction.message.instructions.pop();
    if(fault==="multi-memo") result.transaction.message.instructions.push(result.transaction.message.instructions[1]!);
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(JSON.stringify({result:fault==="finality"?null:result}))));
    await expect(verifySolanaTransaction(signature,m,recipient)).rejects.toThrow();
  });
});
