import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { app } from "electron";
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";

const CONVEX_URL = process.env.CONVEX_URL || "https://notable-sardine-697.convex.cloud";

const tokenPath = join(app.getPath("userData"), "auth-token.json");

interface SavedAuth {
  token: string;
  refreshToken?: string;
}

function loadSavedAuth(): SavedAuth | null {
  try {
    const data = JSON.parse(readFileSync(tokenPath, "utf-8"));
    if (!data.token) return null;
    return { token: data.token, refreshToken: data.refreshToken };
  } catch {
    return null;
  }
}

function saveAuth(auth: SavedAuth) {
  writeFileSync(tokenPath, JSON.stringify(auth), "utf-8");
}

function clearToken() {
  try {
    unlinkSync(tokenPath);
  } catch {}
}

export class ConvexService {
  private client: ConvexHttpClient;
  private token: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    this.client = new ConvexHttpClient(CONVEX_URL);

    const saved = loadSavedAuth();
    if (saved) {
      this.token = saved.token;
      this.refreshToken = saved.refreshToken ?? null;
      this.client.setAuth(saved.token);
    }
  }

  private setTokens(tokens: { token: string; refreshToken?: string }) {
    this.token = tokens.token;
    this.refreshToken = tokens.refreshToken ?? this.refreshToken;
    this.client.setAuth(this.token);
    saveAuth({ token: this.token, refreshToken: this.refreshToken ?? undefined });
  }

  async signIn(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Clear any stale auth so the action runs unauthenticated
      this.client.clearAuth();
      const signInRef = makeFunctionReference<"action">("auth:signIn");
      const result: any = await this.client.action(signInRef, {
        provider: "password",
        params: { email, password, flow: "signIn" },
      });

      if (result?.tokens?.token) {
        this.setTokens(result.tokens);
        return { success: true };
      }

      return { success: false, error: "Invalid credentials" };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in failed";
      return { success: false, error: message };
    }
  }

  async signUp(email: string, password: string, name: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Clear any stale auth so the action runs unauthenticated
      this.client.clearAuth();
      const signInRef = makeFunctionReference<"action">("auth:signIn");
      const result: any = await this.client.action(signInRef, {
        provider: "password",
        params: { email, password, name, flow: "signUp" },
      });

      if (result?.tokens?.token) {
        this.setTokens(result.tokens);
        return { success: true };
      }

      return { success: false, error: "Could not create account" };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign up failed";
      return { success: false, error: message };
    }
  }

  /** Try to refresh the token using the saved refresh token. Returns true if successful. */
  private async tryRefresh(): Promise<boolean> {
    if (!this.refreshToken) return false;
    try {
      this.client.clearAuth();
      const signInRef = makeFunctionReference<"action">("auth:signIn");
      const result: any = await this.client.action(signInRef, {
        provider: "password",
        params: { refreshToken: this.refreshToken },
      });
      if (result?.tokens?.token) {
        this.setTokens(result.tokens);
        return true;
      }
    } catch {
      // Refresh failed — token is truly expired
    }
    return false;
  }

  disconnect() {
    this.token = null;
    this.refreshToken = null;
    this.client.clearAuth();
    clearToken();
  }

  /** Check auth, attempting a token refresh if the saved token is expired. */
  async isAuthenticated(): Promise<boolean> {
    if (!this.token) return false;

    // Try a lightweight query to check if the token is still valid
    try {
      const ref = makeFunctionReference<"query">("users:current");
      await this.client.query(ref, {});
      return true;
    } catch {
      // Token expired — try refresh
      if (await this.tryRefresh()) return true;
      // Refresh also failed — clear stale auth
      this.disconnect();
      return false;
    }
  }

  private ensureAuth() {
    if (!this.token) {
      throw new Error("Not authenticated. Please sign in first.");
    }
  }

  private isUnauthenticatedError(err: unknown): boolean {
    if (err instanceof Error) {
      return err.message.includes("Unauthenticated") || err.message.includes("OIDC token");
    }
    return false;
  }

  async query(name: string, args: Record<string, unknown> = {}) {
    this.ensureAuth();
    const ref = makeFunctionReference<"query">(name);
    try {
      return await this.client.query(ref, args);
    } catch (err) {
      if (this.isUnauthenticatedError(err) && await this.tryRefresh()) {
        return await this.client.query(ref, args);
      }
      throw err;
    }
  }

  async mutation(name: string, args: Record<string, unknown> = {}) {
    this.ensureAuth();
    const ref = makeFunctionReference<"mutation">(name);
    try {
      return await this.client.mutation(ref, args);
    } catch (err) {
      if (this.isUnauthenticatedError(err) && await this.tryRefresh()) {
        return await this.client.mutation(ref, args);
      }
      throw err;
    }
  }
}
