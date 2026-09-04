import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerThanks2GoTools } from "../apps/web/src/webmcp.js";
const url = "https://thanks2go.securedme.ca/p/securedme";
const receipt = {version:"1", mandateHash:"a".repeat(64), rail:"paypal", status:"confirmed", providerReference:"TEST-CAPTURE", credential:"test-signature"};
const profile = {profileUrl:url, attestation:{originControlled:true,humanIdentityVerified:false}, paypal:{enabled:true,environment:"sandbox"},solana:{network:"devnet",recipient:"public-destination"}};
let registered: Map<string, WebMcpTool>;
let registry: {registerTool: ReturnType<typeof vi.fn>};
let fetchMock: ReturnType<typeof vi.fn>;
let notify: ReturnType<typeof vi.fn>;
let panel: {focus: ReturnType<typeof vi.fn>; scrollIntoView: ReturnType<typeof vi.fn>};
let doc: {modelContext?: typeof registry; querySelector: ReturnType<typeof vi.fn>; activeElement: unknown};
const names = ["inspect_gratitude_profile","stage_gratitude_intent","open_payment_handoff","verify_gratitude_receipt"];
const parse = (value:any) => JSON.parse(value.content[0].text);
const respond = (body:unknown,status=200) => fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body),{status}));
async function run(name:string,input:Record<string,unknown>={}) {return registered.get(name)!.execute(input) as Promise<any>;}
beforeEach(() => {
  registered=new Map();
  registry={registerTool:vi.fn(async (tool:WebMcpTool,options:{signal:AbortSignal})=>{
    registered.set(tool.name,tool); options.signal.addEventListener("abort",()=>registered.delete(tool.name),{once:true});
  })};
  panel={focus:vi.fn(()=>{doc.activeElement=panel;}),scrollIntoView:vi.fn()};
  doc={modelContext:registry,querySelector:vi.fn(()=>panel),activeElement:null};
  fetchMock=vi.fn(); notify=vi.fn();
  vi.stubGlobal("document",doc);vi.stubGlobal("fetch",fetchMock);vi.stubGlobal("location",new URL(url));
});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
describe("WebMCP real callbacks and payment boundary",()=>{
  it("works without native WebMCP and leaves the human UI alone",async()=>{
    delete doc.modelContext;
    expect(await registerThanks2GoTools(url)).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("registers exactly four tools and abort removes all of them",async()=>{
    const lifecycle=new AbortController();
    await registerThanks2GoTools(url,notify,lifecycle.signal);
    expect([...registered.keys()]).toEqual(names);
    for (const tool of registered.values()) {
      expect(tool.description.length).toBeGreaterThan(80);
      expect(tool.inputSchema).toBeDefined();
      expect(tool.outputSchema).toHaveProperty("required", ["content","isError","structuredContent"]);
      expect(tool.name).toMatch(/^[a-z]+(_[a-z]+)+$/);
    }
    lifecycle.abort(); expect(registered.size).toBe(0);
  });
  it("rejects a different origin before registration",async()=>{
    await expect(registerThanks2GoTools("https://attacker.example/p/securedme")).rejects.toThrow("INVALID_PROFILE_URL");
    expect(registry.registerTool).not.toHaveBeenCalled();
  });
  it("rolls back partial registration failures",async()=>{
    registry.registerTool.mockRejectedValueOnce(new Error("registration failure"));
    await expect(registerThanks2GoTools(url)).rejects.toThrow();
    expect(registered.size).toBe(0);
  });
  it.each(names)("rejects injected extra parameters on %s",async(name)=>{
    await registerThanks2GoTools(url,notify);
    const value=await run(name,{humanApproved:true,approveUrl:"https://attacker.example"});
    expect(value.isError).toBe(true);
    expect(parse(value).code).toBe("INVALID_INPUT");
    expect(fetchMock).not.toHaveBeenCalled();expect(panel.focus).not.toHaveBeenCalled();
  });
  it("inspects only public allowlisted fields",async()=>{
    await registerThanks2GoTools(url);respond({...profile,email:"private@example.com",secret:"never-output"});
    const value=await run(names[0]!);
    expect(value.isError).toBe(false);
    expect(parse(value).humanIdentityVerified).toBe(false);
    expect(parse(value)).toMatchObject({canonicalOriginMatch:true,transportSecurity:"tls",paymentInitiated:false,secretsReturned:false});
    expect(JSON.stringify(value)).not.toMatch(/private@example|never-output/);
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/profiles/securedme");
  });
  it("rejects a mismatched profile response",async()=>{
    await registerThanks2GoTools(url);respond({...profile,profileUrl:"https://attacker.example"});
    expect((await run(names[0]!)).isError).toBe(true);
  });
  it.each(["paypal","solana-devnet"])("stages %s without sharing the token or creating payment",async(rail)=>{
    await registerThanks2GoTools(url,notify);
    const input=rail==="paypal"?{rail}:{rail,solAmount:"0.005"};
    const amount=rail==="paypal"?{currency:"USD",minorUnits:100}:{currency:"SOL",atomicUnits:"5000000"};
    respond({state:"STAGED",humanApprovalRequired:true,mandateHash:"b".repeat(64),mandateToken:"never-output",
      mandate:{profileUrl:url,rail,amount,expiresAt:new Date(Date.now()+590000).toISOString()},
      agentExchange:{recipient:{recipientAttestationHash:"c".repeat(64),credential:"header.payload.signature"}}});
    const value=await run(names[1]!,input);
    expect(value.isError).toBe(false);expect(parse(value).amount).toEqual(amount);
    expect(JSON.stringify(value)).not.toContain("never-output");
    expect(notify).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/intents/stage");
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({profileUrl:url,...input});
  });
  it.each([{rail:"solana-devnet"},{rail:"solana-mainnet",solAmount:"1"},{rail:"paypal",solAmount:"0.01"},{rail:"solana-devnet",solAmount:"0.1"}])("rejects invalid rail/amount %j",async(input)=>{
    await registerThanks2GoTools(url);
    expect((await run(names[1]!,input)).isError).toBe(true);expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects expired staged responses",async()=>{
    await registerThanks2GoTools(url);
    respond({state:"STAGED",humanApprovalRequired:true,mandateHash:"b".repeat(64),
      mandate:{profileUrl:url,rail:"paypal",amount:{currency:"USD",minorUnits:100},expiresAt:"2020-01-01T00:00:00.000Z"}});
    expect((await run(names[1]!,{rail:"paypal"})).isError).toBe(true);
  });
  it("handoff focuses and scrolls the panel without network or click",async()=>{
    await registerThanks2GoTools(url);
    const value=await run(names[2]!);
    expect(parse(value)).toMatchObject({opened:true,focusTarget:"#rails",paymentInitiated:false,secretsReturned:false,humanApprovalRequired:true});
    expect(doc.activeElement).toBe(panel);expect(panel.scrollIntoView).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("missing handoff panel is an error, not false success",async()=>{
    await registerThanks2GoTools(url);doc.querySelector.mockReturnValue(null);
    expect(parse(await run(names[2]!)).code).toBe("HANDOFF_UNAVAILABLE");
  });
  it("verifies existing receipts without leaking their credential",async()=>{
    await registerThanks2GoTools(url);respond({valid:true,receipt});
    const value=await run(names[3]!,{receipt});
    expect(parse(value)).toMatchObject({cryptographicValidity:true,paymentStatus:"confirmed",settlementConfirmed:true,usableAsPaymentProof:true,secretsReturned:false});
    expect(JSON.stringify(value)).not.toContain("test-signature");
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/receipts/verify");
  });
  it("rejects changed receipt response fields",async()=>{
    await registerThanks2GoTools(url);respond({valid:true,receipt:{...receipt,status:"failed"}});
    expect((await run(names[3]!,{receipt})).isError).toBe(true);
  });
  it.each([400,403,500])("sanitizes HTTP %i without echoing server content",async(status)=>{
    await registerThanks2GoTools(url);respond({message:"secret server content"},status);
    const value=await run(names[0]!);
    expect(value.isError).toBe(true);expect(JSON.stringify(value)).not.toContain("secret server");
  });
  it("handles malformed JSON and network failure",async()=>{
    await registerThanks2GoTools(url);
    fetchMock.mockResolvedValueOnce(new Response("<html>failure</html>"));
    expect((await run(names[0]!)).isError).toBe(true);
    fetchMock.mockRejectedValueOnce(new Error("private network detail"));
    expect(JSON.stringify(await run(names[0]!))).not.toContain("private network");
  });
  it("aborted callbacks cannot start requests",async()=>{
    const controller=await registerThanks2GoTools(url);
    const callback=registered.get(names[0]!)!.execute;
    controller!.abort();expect(parse(await callback({})).code).toBe("TOOL_UNAVAILABLE");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
