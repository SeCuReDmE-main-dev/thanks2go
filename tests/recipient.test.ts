import { describe, expect, it } from "vitest";
import { verifyRecipientControl } from "../api/recipient.js";

describe("recipient control proof", () => {
  it("accepts only the receiving key covered by the signed challenge", () => {
    expect(verifyRecipientControl("6ywCP21EgS6a7y752rHT38qDypsb9NNLi2Db5iYXd9qj")).toBe(true);
    expect(verifyRecipientControl("11111111111111111111111111111111")).toBe(false);
    expect(verifyRecipientControl("")).toBe(false);
  });
});
