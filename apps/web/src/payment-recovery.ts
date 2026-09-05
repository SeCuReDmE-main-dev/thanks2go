import { ApiError } from "./client-api.js";

export type PaymentRecoveryTarget = {
  storage: Pick<Storage, "removeItem">;
  currentUrl: string;
  replaceUrl: (url: string) => void;
  deactivatePayPalReturn: () => void;
  deactivateSolanaStage: () => void;
};

export function recoverExpiredMandate(error: unknown, rail: "paypal" | "solana-devnet", target: PaymentRecoveryTarget): boolean {
  if (!(error instanceof ApiError) || error.code !== "MANDATE_EXPIRED") return false;
  if (rail === "paypal") {
    target.storage.removeItem("thanks2go:paypal-mandate");
    const url = new URL(target.currentUrl);
    url.searchParams.delete("paypal");
    url.searchParams.delete("token");
    url.searchParams.delete("PayerID");
    target.replaceUrl(`${url.pathname}${url.search}${url.hash}`);
    target.deactivatePayPalReturn();
  } else {
    target.deactivateSolanaStage();
  }
  return true;
}
