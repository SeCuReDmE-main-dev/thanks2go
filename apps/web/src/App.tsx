import { useEffect, useMemo, useState } from "react";
import { PaymentButton } from "@solana-commerce/kit";
import QRCode from "qrcode";
import { registerThanks2GoTools } from "./webmcp";

type Profile = {
  profileUrl: string; displayName: string;
  attestation: { originControlled: boolean; railDestinationControlled: boolean; humanIdentityVerified: false };
  paypal: { enabled: boolean; displayAmount: string };
  solana: { network: "devnet"; recipient: string; presets: [string, string, string] };
};
type Stage = { mandateToken: string; mandate: { id: string; rail: string; amount: unknown; expiresAt: string }; reference?: string };

const api = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, init);
  const body = await response.json();
  if (!response.ok) throw new Error(body.message ?? "Request failed");
  return body as T;
};

export default function App() {
  const [profile, setProfile] = useState<Profile>();
  const [solAmount, setSolAmount] = useState("0.001");
  const [solStage, setSolStage] = useState<Stage>();
  const [status, setStatus] = useState("Choose a rail. Nothing happens without your click.");
  const [busy, setBusy] = useState(false);
  const [profileQr, setProfileQr] = useState("");
  const query = useMemo(() => new URLSearchParams(location.search), []);

  useEffect(() => {
    api<Profile>("/api/profiles/securedme").then(setProfile).catch((error) => setStatus(error.message));
  }, []);
  useEffect(() => {
    if (!profile) return;
    QRCode.toDataURL(profile.profileUrl, { errorCorrectionLevel: "M", margin: 1, width: 180, color: { dark: "#132015", light: "#eaff86" } }).then(setProfileQr).catch(() => undefined);
    let controller: AbortController | undefined;
    registerThanks2GoTools(profile.profileUrl).then((value) => { controller = value; }).catch(() => undefined);
    return () => controller?.abort();
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
    if (!profile) return;
    setBusy(true);
    try {
      const stage = await api<Stage>("/api/intents/stage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileUrl: profile.profileUrl, rail: "paypal" }) });
      sessionStorage.setItem("thanks2go:paypal-mandate", stage.mandateToken);
      const order = await api<{ approveUrl: string }>("/api/paypal/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mandateToken: stage.mandateToken, humanApproved: true }) });
      location.assign(order.approveUrl);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to open PayPal"); setBusy(false); }
  }

  async function capturePayPal() {
    const orderId = query.get("token");
    const mandateToken = sessionStorage.getItem("thanks2go:paypal-mandate");
    if (!orderId || !mandateToken) return;
    setBusy(true);
    try {
      const receipt = await api<Record<string, unknown>>(`/api/paypal/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mandateToken, humanApproved: true }) });
      sessionStorage.removeItem("thanks2go:paypal-mandate");
      setStatus(`Confirmed by PayPal. Receipt ${String(receipt.providerReference).slice(0, 12)}… contains no payer name or email.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Capture was not confirmed"); }
    finally { setBusy(false); }
  }

  async function verifySolana(signature: string) {
    if (!solStage) { setStatus("No active devnet mandate. Stage the selected amount first."); return; }
    try {
      await api("/api/solana/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mandateToken: solStage.mandateToken, signature }) });
      setStatus(`Solana devnet demonstration confirmed: ${signature.slice(0, 12)}… This is not production money.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Devnet verification failed"); }
  }

  if (!profile) return <main id="main" className="shell"><p role="status">{status}</p></main>;
  const paypalReturn = query.get("paypal") === "return" && Boolean(query.get("token"));

  return <>
    <header className="topbar"><a className="brand" href="/p/securedme">Thanks2Go</a><span>Gratitude stays human.</span></header>
    <main id="main" className="shell">
      <section className="hero" aria-labelledby="title">
        <p className="eyebrow">A generosity experiment by SecuredMe</p>
        <h1 id="title">A small thank-you.<br/><em>Explicitly chosen.</em></h1>
        <p className="lede">Thanks2Go lets a creator declare one canonical gratitude profile. Agents can inspect and stage. Only you can approve a rail.</p>
      </section>

      <section className="identity" aria-labelledby="recipient-title">
        <div><p className="label">Declared recipient</p><h2 id="recipient-title">{profile.displayName}</h2><p>Each rail reports its own configuration or control evidence. Human identity is not asserted.</p></div>
        <ul aria-label="Verification claims"><li>Origin controlled</li><li>Solana destination {profile.solana.recipient ? "control proof verified" : "proof pending"}</li><li>PayPal {profile.paypal.enabled ? "configured" : "configuration pending"}</li><li>No identity claim</li></ul>
        {profileQr && <figure><img src={profileQr} width="128" height="128" alt="QR code containing only the canonical Thanks2Go profile URL"/><figcaption>Profile URL only—never a payment.</figcaption></figure>}
      </section>

      <section id="rails" className="rails" tabIndex={-1} aria-labelledby="rails-title">
        <div className="section-heading"><p className="eyebrow">Two rails, two meanings</p><h2 id="rails-title">Choose your gesture</h2></div>
        <article className="rail paypal">
          <p className="rail-number">01 / LIVE</p><h3>One real dollar</h3>
          <p>A fixed <strong>{profile.paypal.displayAmount}</strong> voluntary gratitude tip through PayPal. No good, service, tax receipt, or charitable donation is promised.</p>
          {paypalReturn ? <button disabled={busy} onClick={capturePayPal}>Approve final capture of $1</button> : <button disabled={busy || !profile.paypal.enabled} onClick={startPayPal}>{profile.paypal.enabled ? "Continue visibly to PayPal" : "PayPal configuration pending"}</button>}
        </article>
        <article className="rail solana">
          <p className="rail-number">02 / DEVNET DEMO</p><h3>Try a Solana thank-you</h3>
          <p>This uses Solana Commerce Kit in tip mode on <strong>devnet only</strong>. Devnet tokens have no monetary value.</p>
          <fieldset><legend>Choose a bounded demo amount</legend>{profile.solana.presets.map((amount) => <label key={amount}><input type="radio" name="sol" value={amount} checked={solAmount === amount} onChange={() => { setSolAmount(amount); setSolStage(undefined); }} /> {amount} SOL</label>)}</fieldset>
          <button className="secondary" disabled={busy || !profile.solana.recipient} onClick={() => stageSolana(solAmount)}>{solStage ? "Mandate staged" : "Stage devnet mandate"}</button>
          {solStage && <PaymentButton
            config={{ merchant: { name: "SecuredMe", wallet: profile.solana.recipient, description: "Voluntary gratitude — devnet demonstration" }, mode: "tip", network: "devnet", allowedMints: ["SOL"], showQR: false, showMerchantInfo: true, debug: false }}
            onPayment={(amount: number) => { if (amount.toFixed(3) !== Number(solAmount).toFixed(3)) throw new Error("Amount differs from the staged mandate"); }}
            onPaymentSuccess={verifySolana}
            onPaymentError={(error: Error) => setStatus(error.message)}
            onCancel={() => setStatus("Solana devnet action cancelled. Nothing was sent.")}
          >
            <button>Open wallet for staged devnet tip</button>
          </PaymentButton>}
        </article>
      </section>

      <p className="status" role="status" aria-live="polite">{status}</p>
      <section className="boundary"><h2>What agents can—and cannot—do</h2><p>A2A and experimental WebMCP tools may inspect this profile, stage an exact ten-minute mandate, open this visible handoff, and verify a receipt. They cannot click approval, create or capture PayPal autonomously, or sign a wallet transaction.</p></section>
    </main>
    <footer><span>Thanks2Go · MIT · 2026</span><a href="https://github.com/SeCuReDmE-main-dev/thanks2go">Source and threat model</a></footer>
  </>;
}
