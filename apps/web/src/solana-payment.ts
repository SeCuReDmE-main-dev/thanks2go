import { HeadlessSDK } from "@solana-commerce/kit";
import { getWallets } from "@wallet-standard/app";
import { AccountRole, address, appendTransactionMessageInstructions, compileTransaction, createNoopSigner, createSolanaRpc, createTransactionMessage, getTransactionEncoder, setTransactionMessageFeePayer, setTransactionMessageLifetimeUsingBlockhash } from "gill";
import { getTransferSolInstruction } from "gill/programs";
import bs58 from "bs58";

export type DevnetStage = { mandateHash: string; reference: string; mandate: { expiresAt: string; amount: {currency: "SOL"; atomicUnits: string} } };
const rpc = () => createSolanaRpc("https://api.devnet.solana.com");

export async function buildDevnetInstructions(sender: string, recipient: string, stage: DevnetStage) {
  if (stage.mandate.amount.currency !== "SOL" || Date.parse(stage.mandate.expiresAt) <= Date.now()) throw new Error("Stage a fresh devnet mandate.");
  const units = BigInt(stage.mandate.amount.atomicUnits);
  if (units < 1_000_000n || units > 100_000_000n || !/^[a-f0-9]{64}$/.test(stage.mandateHash) || bs58.encode(Uint8Array.from(stage.mandateHash.match(/../g)!, byte => parseInt(byte, 16))) !== stage.reference) throw new Error("Invalid staged devnet payment.");
  const tip = HeadlessSDK.createTipRequest(recipient, Number(units) / 1e9, { currency: "SOL", memo: `thanks2go:${stage.mandateHash}` });
  // Kit 0.1.1's SOL transfer builder incorrectly selects Token-2022 and omits memo/reference.
  // Keep its headless tip request, then construct native SOL with the official system program.
  const transfer = getTransferSolInstruction({source:createNoopSigner(address(sender)),destination:address(tip.recipient),amount:units});
  return [{ ...transfer, accounts: [...transfer.accounts, { address: address(stage.reference), role: AccountRole.READONLY }] },
    { programAddress: address("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"), accounts: [], data: new TextEncoder().encode(tip.memo) }];
}

export function availableDevnetWallets() {
  return getWallets().get().filter(wallet => wallet.chains.includes("solana:devnet") && wallet.features["standard:connect"] && wallet.features["solana:signAndSendTransaction"]);
}
export async function payDevnetTip(walletName: string, recipient: string, stage: DevnetStage): Promise<string> {
  const wallet = availableDevnetWallets().find(candidate => candidate.name === walletName);
  if (!wallet) throw new Error("Open a Wallet Standard compatible Solana wallet with devnet enabled, then refresh the wallet list.");
  type ConnectedAccount = ReturnType<typeof availableDevnetWallets>[number]["accounts"][number];
  const connect = wallet.features["standard:connect"] as { connect(): Promise<{accounts: readonly ConnectedAccount[]}> };
  const { accounts } = await connect.connect();
  const account = accounts.find(value => value.chains.includes("solana:devnet"));
  if (!account) throw new Error("Select a wallet account that supports devnet.");
  const instructions = await buildDevnetInstructions(account.address, recipient, stage);
  const {value: blockhash} = await rpc().getLatestBlockhash({commitment:"finalized"}).send();
  const message = appendTransactionMessageInstructions(instructions,
    setTransactionMessageLifetimeUsingBlockhash(blockhash, setTransactionMessageFeePayer(address(account.address), createTransactionMessage({version:0}))));
  const transaction = getTransactionEncoder().encode(compileTransaction(message));
  const signer = wallet.features["solana:signAndSendTransaction"] as { signAndSendTransaction(...input: Array<{account: typeof account; chain: "solana:devnet"; transaction: Uint8Array; options: {preflightCommitment:"confirmed"}}> ): Promise<Array<{signature: Uint8Array}>> };
  const result = await signer.signAndSendTransaction({account, chain:"solana:devnet", transaction: new Uint8Array(transaction), options:{preflightCommitment:"confirmed"}});
  if (!result[0]) throw new Error("The wallet did not return a transaction signature.");
  return bs58.encode(result[0].signature);
}
