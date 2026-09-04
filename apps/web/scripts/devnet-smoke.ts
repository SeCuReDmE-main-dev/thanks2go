// Explicit devnet-only test. The temporary payer key never leaves process memory.
import { appendTransactionMessageInstructions, compileTransaction, createSolanaRpc, createTransactionMessage, generateKeyPairSigner, getBase64EncodedWireTransaction, lamports, setTransactionMessageFeePayer, setTransactionMessageLifetimeUsingBlockhash, signTransaction } from "gill";
import {buildDevnetInstructions, type DevnetStage} from "../src/solana-payment.js";

const base = "http://127.0.0.1:3001";
const rpc = createSolanaRpc("https://api.devnet.solana.com");
const pause = () => new Promise(resolve => setTimeout(resolve, 2000));
async function stage() {
  const response = await fetch(`${base}/api/intents/stage`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({profileUrl:"https://thanks2go.securedme.ca/p/securedme",rail:"solana-devnet",solAmount:"0.001"})});
  if(!response.ok) throw new Error("Staging failed");
  return await response.json() as DevnetStage & {mandateToken:string};
}
try {
  const payer = await generateKeyPairSigner();
  console.log(JSON.stringify({step:"devnet-airdrop-request"}));
  await rpc.requestAirdrop(payer.address,lamports(100_000_000n),{commitment:"confirmed"}).send();
  let funded = false;
  for(let attempt=0;attempt<30;attempt++){if((await rpc.getBalance(payer.address,{commitment:"confirmed"}).send()).value>=2_000_000n){funded=true;break;}await pause();}
  if(!funded) throw new Error("Devnet faucet funding pending");
  const intent = await stage();
  const profile = await fetch(`${base}/api/profiles/securedme`).then(response=>response.json()) as {solana:{recipient:string}};
  const instructions = await buildDevnetInstructions(payer.address,profile.solana.recipient,intent);
  const {value: blockhash}=await rpc.getLatestBlockhash({commitment:"confirmed"}).send();
  const message=appendTransactionMessageInstructions(instructions,setTransactionMessageLifetimeUsingBlockhash(blockhash,setTransactionMessageFeePayer(payer.address,createTransactionMessage({version:0}))));
  const signed=await signTransaction([payer.keyPair],compileTransaction(message));
  const signature=await rpc.sendTransaction(getBase64EncodedWireTransaction(signed),{encoding:"base64",preflightCommitment:"confirmed"}).send();
  console.log(JSON.stringify({step:"devnet-transfer-sent",signature}));
  for(let attempt=0;attempt<45;attempt++){
    const response=await fetch(`${base}/api/solana/verify`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mandateToken:intent.mandateToken,signature})});
    const receipt=await response.json() as Record<string,unknown>;
    if(response.ok){
      const verified=await fetch(`${base}/api/receipts/verify`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(receipt)}).then(r=>r.json()) as {valid:boolean};
      const another=await stage();
      const reused=await fetch(`${base}/api/solana/verify`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mandateToken:another.mandateToken,signature})}).then(r=>r.json()) as {code:string};
      if(!verified.valid || reused.code!=="REFERENCE_REUSED") throw new Error("Devnet receipt or replay check failed");
      console.log(JSON.stringify({step:"complete",network:"devnet",signature,receiptVerified:true,crossMandateReplayRejected:true})); process.exit(0);
    }
    if(!String(receipt.message).includes("not finalized")) throw new Error("Devnet verifier rejected the transaction");
    await pause();
  }
  throw new Error("Devnet finalization pending");
} catch(error) {
  console.log(JSON.stringify({step:"blocked",reason:error instanceof Error?error.message.split("\n")[0]:"Devnet test failed",secretValuesExposed:false}));
  process.exitCode=1;
}
