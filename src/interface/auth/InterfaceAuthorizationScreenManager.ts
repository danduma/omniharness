import { StateManager } from "@/lib/state-manager";

type AuthorizationScreenState = {
  password: string;
  authenticated: boolean;
  checkingSession: boolean;
  submitting: boolean;
  status: "ready" | "approved" | "denied" | "failed";
  code: string | null;
};

export class InterfaceAuthorizationScreenManager extends StateManager<AuthorizationScreenState> {
  constructor() {
    super({
      password: "",
      authenticated: false,
      checkingSession: true,
      submitting: false,
      status: "ready",
      code: null,
    });
  }

  setPassword(password: string) {
    this.patch(() => ({ password }));
  }

  async checkSession(load: () => Promise<unknown>) {
    try {
      const session = await load() as { authenticated?: boolean };
      this.patch(() => ({
        authenticated: session.authenticated === true,
        checkingSession: false,
      }));
    } catch {
      this.patch(() => ({ authenticated: false, checkingSession: false }));
    }
  }

  async approve(
    submit: (password: string) => Promise<{ code: string }>,
  ) {
    this.patch(() => ({ submitting: true, status: "ready" }));
    try {
      const result = await submit(this.getSnapshot().password);
      this.patch(() => ({
        submitting: false,
        status: "approved",
        code: result.code,
        password: "",
      }));
      return result;
    } catch (error) {
      this.patch(() => ({
        submitting: false,
        status: "failed",
        code: null,
        password: "",
      }));
      throw error;
    }
  }

  markDenied() {
    this.patch(() => ({
      status: "denied",
      submitting: false,
      password: "",
    }));
  }
}

export const interfaceAuthorizationScreenManager =
  new InterfaceAuthorizationScreenManager();
