import { useEffect, useMemo, useRef, useState } from "react";
import type { DevnetStage } from "./solana-payment";
import QRCode from "qrcode";
import { registerThanks2GoTools } from "./webmcp";
import { ApiError, api } from "./client-api";
import { recoverExpiredMandate } from "./payment-recovery";

type Profile = {
  profileUrl: string; displayName: string;
  attestation: { originControlled: boolean; railDestinationControlled: boolean; humanIdentityVerified: false };
  paypal: { enabled: boolean; displayAmount: string; environment: "live" | "sandbox" };
  solana: { network: "devnet"; recipient: string; presets: [string, string, string] };
};
type Stage = DevnetStage & { mandateToken: string };

export default function App() {
  const [profile, setProfile] = useState<Profile>();
  const [solAmount, setSolAmount] = useState("0.001");
  const [solStage, setSolStage] = useState<Stage>();
  const [status, setStatus] = useState("Choose a rail. Nothing happens without your click.");
  const [busy, setBusy] = useState(false);
  const [profileQr, setProfileQr] = useState("");
  const [receipt, setReceipt] = useState<Record<string, unknown>>();
  const paymentLock = useRef(false);
  const [wallets, setWallets] = useState<string[]>([]);
  const query = useMemo(() => new URLSearchParams(location.search), []);
  const [paypalReturn, setPayPalReturn] = useState(() => query.get("paypal") === "return" && Boolean(query.get("token")));

  function recoverExpiration(error: unknown, rail: "paypal" | "solana-devnet"): boolean {
    return recoverExpiredMandate(error, rail, {
      storage: sessionStorage,
      currentUrl: location.href,
      replaceUrl: (url) => history.replaceState(history.state, "", url),
      deactivatePayPalReturn: () => setPayPalReturn(false),
      deactivateSolanaStage: () => { setSolStage(undefined); setWallets([]); }
    });
  }
  useEffect(() => {
    if (query.get("paypal") === "cancel") {
      sessionStorage.removeItem("thanks2go:paypal-mandate");
      setStatus("PayPal checkout cancelled. No capture was requested by Thanks2Go.");
    }
  }, [query]);

  useEffect(() => {
    api<Profile>("/api/profiles/securedme").then(setProfile).catch((error) => setStatus(error.message));
  }, []);
  useEffect(() => {
    if (!profile) return;
    QRCode.toDataURL(profile.profileUrl, { errorCorrectionLevel: "M", margin: 1, width: 180, color: { dark: "#030914", light: "#ffffff" } }).then(setProfileQr).catch(() => undefined);
    const lifecycle = new AbortController();
    registerThanks2GoTools(profile.profileUrl, (notice) => {
      if (notice.rail === "solana-devnet" && notice.solAmount) {
        setSolAmount(notice.solAmount);
        setSolStage(undefined);
        setWallets([]);
      }
      setStatus(notice.message);
    }, lifecycle.signal).catch(() => undefined);
    return () => lifecycle.abort();
  }, [profile]);

  async function stageSolana(amount: string) {
    if (!profile) return;
    setBusy(true);
    try {
      const stage = await api<Stage>("/api/intents/stage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileUrl: profile.profileUrl, rail: "solana-devnet", solAmount: amount }) });
      setSolStage(stage);
      setStatus(`Devnet mandate staged for ${amount} SOL. The wallet still requires your approval.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to stage devnet intent"); }
    finally { setBusy(false); }
  }

  async function startPayPal() {
    if (!profile || paymentLock.current) return;
    paymentLock.current = true;
    setBusy(true);
    try {
      let mandateToken = sessionStorage.getItem("thanks2go:paypal-mandate");
      if (!mandateToken) {
        const stage = await api<{mandateToken: string}>("/api/intents/stage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileUrl: profile.profileUrl, rail: "paypal" }) });
        mandateToken = stage.mandateToken;
        sessionStorage.setItem("thanks2go:paypal-mandate", mandateToken);
      }
      const order = await api<{ approveUrl: string }>("/api/paypal/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mandateToken, humanApproved: true }) });
      location.assign(order.approveUrl);
    } catch (error) {
      const expired = recoverExpiration(error, "paypal");
      setStatus(expired ? "This mandate expired. Review the page and click Continue visibly to PayPal to start again." : error instanceof Error ? error.message : "Unable to open PayPal");
      setBusy(false); paymentLock.current = false;
    }
  }

  async function capturePayPal() {
    if (paymentLock.current || receipt) return;
    const orderId = query.get("token");
    const mandateToken = sessionStorage.getItem("thanks2go:paypal-mandate");
    if (!orderId || !mandateToken) return;
    paymentLock.current = true;
    setBusy(true);
    try {
      const receipt = await api<Record<string, unknown>>(`/api/paypal/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mandateToken, humanApproved: true }) });
      sessionStorage.removeItem("thanks2go:paypal-mandate");
      setReceipt(receipt);
      setStatus(`Confirmed by PayPal. Receipt ${String(receipt.providerReference).slice(0, 12)}… contains no payer name or email.`);
    } catch (error) {
      const expired = recoverExpiration(error, "paypal");
      setStatus(expired ? "This mandate expired. Review the page and start a new PayPal handoff." : error instanceof Error ? error.message : "Capture was not confirmed");
    }
    finally { setBusy(false); paymentLock.current = false; }
  }

  async function openDevnetWallet(walletName: string) {
    if (!profile || !solStage || paymentLock.current) return;
    paymentLock.current = true; setBusy(true);
    try {
      const {payDevnetTip} = await import("./solana-payment");
      const signature = await payDevnetTip(walletName, profile.solana.recipient, solStage);
      setStatus("Devnet transaction sent. Waiting for finalization before verifying the receipt.");
      for (let attempt = 0; attempt < 30; attempt++) {
        try {
          const value = await api<Record<string, unknown>>("/api/solana/verify", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mandateToken:solStage.mandateToken,signature})});
          setReceipt(value); setSolStage(undefined); setWallets([]); setStatus(`Solana devnet confirmed: ${signature.slice(0,12)}…`); return;
        } catch (error) {
          const retryable = error instanceof ApiError && (error.status >= 500 || error.message.includes("not finalized"));
          if (!retryable) throw error;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      setStatus(`Finalization pending. Keep this devnet transaction signature: ${signature}`);
    } catch(error) {
      const expired = recoverExpiration(error, "solana-devnet");
      setStatus(expired ? "This devnet mandate expired. Review the amount and stage a fresh mandate." : error instanceof Error ? error.message : "The wallet did not complete the devnet payment.");
    }
    finally {paymentLock.current = false; setBusy(false);}
  }

  if (!profile) return <main id="main" className="shell"><p role="status">{status}</p></main>;
  return <>
    <div className="identity-strip">A SECUREDME EXPERIMENT <span>HUMAN FIRST. GRATITUDE BY CHOICE.</span></div>
    <header className="topbar"><a className="brand" href="/p/securedme">Thanks<span>2Go</span></a><nav aria-label="Main navigation"><a href="#rails">Give thanks</a><a href="https://securedme.ca">SecuredMe ↗</a></nav></header>
    <main id="main" className="shell">
      <section className="hero" aria-labelledby="title">
        <div><p className="eyebrow">Built with passion. Shared with gratitude.</p>
        <h1 id="title">A small thank-you.<br/><em>A human choice.</em></h1></div>
        <div className="hero-intro"><p className="lede">Someone helped you move forward. Send a small, voluntary thank-you—or explore how gratitude works on Solana devnet.</p><p>You choose the recipient and the amount. Every payment needs your approval.</p><a className="button-link" href="#rails">Choose your gesture <span aria-hidden="true">↓</span></a></div>
      </section>

      <section className="identity" aria-labelledby="recipient-title">
        <div><p className="label">Declared recipient</p><h2 id="recipient-title">{profile.displayName}</h2><p>Each rail reports its own configuration or control evidence. Human identity is not asserted.</p></div>
        <ul aria-label="Verification claims"><li>Origin controlled</li><li>Solana destination {profile.solana.recipient ? "control proof verified" : "proof pending"}</li><li>PayPal {profile.paypal.enabled ? "configured" : "configuration pending"}</li><li>No identity claim</li></ul>
        {profileQr && <figure><img src={profileQr} width="128" height="128" alt="QR code containing only the canonical Thanks2Go profile URL"/><figcaption>Profile URL only—never a payment.</figcaption></figure>}
      </section>

      <section id="rails" className="rails" tabIndex={-1} aria-labelledby="rails-title">
        <div className="section-heading"><p className="eyebrow">Two rails, two meanings</p><h2 id="rails-title">Choose your gesture</h2><p>{profile.paypal.environment === "live" ? "One real tip." : "One PayPal sandbox test."} One devnet experiment. Always your choice.</p></div>
        <div className="rail-grid">
        <article className="rail paypal">
          <p className="rail-number">01 / {profile.paypal.environment.toUpperCase()}</p><h3>{profile.paypal.environment === "live" ? "A two-dollar thank-you" : "A two-dollar sandbox test"}</h3>
          {profile.paypal.environment === "sandbox" && <p>Sandbox test: no real money is transferred.</p>}
          <p>A fixed <strong>{profile.paypal.displayAmount}</strong> voluntary gratitude tip through PayPal. No good, service, tax receipt, or charitable donation is promised.</p>
          {paypalReturn ? <button disabled={busy || Boolean(receipt)} onClick={capturePayPal}>{receipt ? "Payment confirmed" : `Approve final capture of ${profile.paypal.displayAmount}`}</button> : <button disabled={busy || !profile.paypal.enabled} onClick={startPayPal}>{profile.paypal.enabled ? "Continue visibly to PayPal" : "PayPal configuration pending"}</button>}
        </article>
        <article className="rail solana">
          <p className="rail-number">02 / DEVNET DEMO</p><h3>Try a Solana thank-you</h3>
          <p>This uses Solana Commerce Kit in tip mode on <strong>devnet only</strong>. Devnet tokens have no monetary value.</p>
          <fieldset><legend>Choose a bounded demo amount</legend>{profile.solana.presets.map((amount) => <label key={amount}><input type="radio" name="sol" value={amount} checked={solAmount === amount} onChange={() => { setSolAmount(amount); setSolStage(undefined); }} /> {amount} SOL</label>)}</fieldset>
          <button className="secondary" disabled={busy || !profile.solana.recipient} onClick={() => stageSolana(solAmount)}>{solStage ? "Mandate staged" : "Stage devnet mandate"}</button>
          {solStage && <div><button disabled={busy} onClick={async () => {
            const {availableDevnetWallets} = await import("./solana-payment");
            const names = availableDevnetWallets().map(wallet => wallet.name); setWallets(names);
            setStatus(names.length ? "Choose a wallet. It will ask you to approve the exact devnet amount." : "No compatible devnet wallet found. Open your Solana wallet with devnet enabled and refresh this list.");
          }}>Find devnet wallets</button>{wallets.map(wallet => <button key={wallet} disabled={busy} onClick={() => openDevnetWallet(wallet)}>Approve {solAmount} SOL with {wallet}</button>)}</div>}
        </article>
        </div>
      </section>

      <p className="status" role="status" aria-live="polite">{status}</p>
      {receipt && <section className="receipt" aria-label="Your receipt"><h2>Your signed receipt</h2><p>Keep this receipt to verify the provider reference later. It contains no payer name or email.</p><button onClick={async () => {
        try { await api("/api/receipts/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(receipt) }); setStatus("Receipt signature and all receipt fields verified."); }
        catch { setStatus("Receipt verification failed."); }
      }}>Verify this receipt</button><button onClick={() => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(receipt, null, 2)], {type:"application/json"}));
        const link = document.createElement("a"); link.href = url; link.download = "thanks2go-receipt.json";
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}>Download receipt</button></section>}
      <section className="boundary"><p className="eyebrow">Human first, by design</p><h2>Agents prepare. You approve.</h2><p>A2A and experimental WebMCP tools may inspect this profile, stage an exact ten-minute mandate, open this visible handoff, and verify a receipt. They cannot click approval, create or capture PayPal autonomously, or sign a wallet transaction.</p></section>
    </main>
    <footer><span>Thanks2Go · MIT · 2026</span><a href="https://github.com/SeCuReDmE-main-dev/thanks2go">Source and threat model</a></footer>
  </>;
}
