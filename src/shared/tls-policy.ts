export type NativeTlsPolicyInput = {
  standardTrust: "trusted" | "untrusted";
  presentedSpki: string;
  storedSpki: string | null;
};

export type NativeTlsPolicyDecision =
  | {
      decision: "allow-standard";
      requiresConfirmation: false;
    }
  | {
      decision: "allow-pinned";
      requiresConfirmation: false;
      presentedSpki: string;
    }
  | {
      decision: "confirm-pin";
      requiresConfirmation: true;
      presentedSpki: string;
    }
  | {
      decision: "pin-mismatch";
      requiresConfirmation: true;
      presentedSpki: string;
      storedSpki: string;
    };

export function resolveNativeTlsPolicy(
  input: NativeTlsPolicyInput,
): NativeTlsPolicyDecision {
  if (input.standardTrust === "trusted") {
    return {
      decision: "allow-standard",
      requiresConfirmation: false,
    };
  }
  if (!input.storedSpki) {
    return {
      decision: "confirm-pin",
      requiresConfirmation: true,
      presentedSpki: input.presentedSpki,
    };
  }
  if (input.storedSpki === input.presentedSpki) {
    return {
      decision: "allow-pinned",
      requiresConfirmation: false,
      presentedSpki: input.presentedSpki,
    };
  }
  return {
    decision: "pin-mismatch",
    requiresConfirmation: true,
    presentedSpki: input.presentedSpki,
    storedSpki: input.storedSpki,
  };
}
