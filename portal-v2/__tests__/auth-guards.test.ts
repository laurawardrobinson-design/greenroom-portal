import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase clients before importing guards
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { AuthError, authErrorResponse } from "@/lib/auth/guards";

describe("AuthError", () => {
  it("creates error with message and status code", () => {
    const err = new AuthError("Not authenticated", 401);
    expect(err.message).toBe("Not authenticated");
    expect(err.statusCode).toBe(401);
    expect(err.name).toBe("AuthError");
  });
});

describe("authErrorResponse", () => {
  it("returns AuthError message and status", async () => {
    const err = new AuthError("Forbidden", 403);
    const response = authErrorResponse(err);
    const body = await response.json();
    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });

  it("returns generic 500 for unknown errors — no DB details leaked", async () => {
    const err = new Error(
      'duplicate key value violates unique constraint "users_email_key"'
    );
    const response = authErrorResponse(err);
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.error).toBe("Internal server error");
    // Must NOT contain DB constraint name
    expect(JSON.stringify(body)).not.toContain("users_email_key");
  });

  it("returns 400 for ZodError without exposing field details", async () => {
    const err = new Error("Validation failed");
    err.name = "ZodError";
    const response = authErrorResponse(err);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid input");
  });

  it("never exposes stack traces", async () => {
    const err = new Error("Something broke");
    const response = authErrorResponse(err);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("at Object");
    expect(JSON.stringify(body)).not.toContain(".ts:");
  });
});
