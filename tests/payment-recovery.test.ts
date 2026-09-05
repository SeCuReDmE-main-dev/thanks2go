import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../apps/web/src/client-api.js";
import { recoverExpiredMandate, type PaymentRecoveryTarget } from "../apps/web/src/payment-recovery.js";

function target(): PaymentRecoveryTarget {
  return {
    storage: {removeItem: vi.fn()},
    currentUrl: "https://thanks2go.securedme.ca/p/securedme?paypal=return&token=ORDER123&PayerID=PAYER&keep=yes#receipt",
    replaceUrl: vi.fn(),
    deactivatePayPalReturn: vi.fn(),
    deactivateSolanaStage: vi.fn()
  };
}

describe("expired payment recovery", () => {
  it("clears the PayPal token and stale return while leaving an explicit inactive restart", () => {
    const state = target();
    expect(recoverExpiredMandate(new ApiError("expired", "MANDATE_EXPIRED", 410), "paypal", state)).toBe(true);
    expect(state.storage.removeItem).toHaveBeenCalledWith("thanks2go:paypal-mandate");
    expect(state.replaceUrl).toHaveBeenCalledWith("/p/securedme?keep=yes#receipt");
    expect(state.deactivatePayPalReturn).toHaveBeenCalledOnce();
    expect(state.deactivateSolanaStage).not.toHaveBeenCalled();
  });

  it("deactivates an expired Solana stage without touching PayPal resume state", () => {
    const state = target();
    expect(recoverExpiredMandate(new ApiError("expired", "MANDATE_EXPIRED", 410), "solana-devnet", state)).toBe(true);
    expect(state.deactivateSolanaStage).toHaveBeenCalledOnce();
    expect(state.storage.removeItem).not.toHaveBeenCalled();
    expect(state.replaceUrl).not.toHaveBeenCalled();
  });

  it("preserves idempotent resume state for every non-expiration error", () => {
    const state = target();
    expect(recoverExpiredMandate(new ApiError("gateway", "RAIL_REJECTED", 502), "paypal", state)).toBe(false);
    expect(state.storage.removeItem).not.toHaveBeenCalled();
    expect(state.replaceUrl).not.toHaveBeenCalled();
    expect(state.deactivatePayPalReturn).not.toHaveBeenCalled();
    expect(state.deactivateSolanaStage).not.toHaveBeenCalled();
  });
});
