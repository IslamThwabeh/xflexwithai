import { describe, expect, it, vi } from "vitest";
import { resolveUserTermsAcceptanceStatus } from "../backend/db";
import type { UserTermsAcceptance } from "../database/schema-sqlite";

const acceptance = {
  id: 1,
  userId: 42,
  termsVersion: "v1",
  acceptedAt: "2026-09-01T10:00:00.000Z",
  ipAddress: null,
  userAgent: null,
  source: "login_gate",
  orderId: null,
} as UserTermsAcceptance;

describe("terms acceptance status short-circuit", () => {
  it("skips the entitlement lookup when any recorded acceptance is valid", async () => {
    const loadClientMarker = vi.fn(async () => {
      throw new Error("the entitlement lookup must not run");
    });

    const status = await resolveUserTermsAcceptanceStatus({
      loadLatestAcceptance: async () => acceptance,
      loadClientMarker,
      loadGateSetting: async () => "true",
    });

    expect(loadClientMarker).not.toHaveBeenCalled();
    expect(status).toEqual({
      gateEnabled: true,
      isClient: true,
      accepted: true,
      requiresAcceptance: false,
      latestAcceptance: acceptance,
    });
  });

  it("retains the entitlement check and gate for an unaccepted client", async () => {
    const loadClientMarker = vi.fn(async () => true);
    const status = await resolveUserTermsAcceptanceStatus({
      loadLatestAcceptance: async () => null,
      loadClientMarker,
      loadGateSetting: async () => "true",
    });

    expect(loadClientMarker).toHaveBeenCalledOnce();
    expect(status).toEqual({
      gateEnabled: true,
      isClient: true,
      accepted: false,
      requiresAcceptance: true,
      latestAcceptance: null,
    });
  });

  it("does not require acceptance from an unaccepted non-client", async () => {
    const loadClientMarker = vi.fn(async () => false);
    const status = await resolveUserTermsAcceptanceStatus({
      loadLatestAcceptance: async () => null,
      loadClientMarker,
      loadGateSetting: async () => "true",
    });

    expect(loadClientMarker).toHaveBeenCalledOnce();
    expect(status).toMatchObject({
      gateEnabled: true,
      isClient: false,
      accepted: false,
      requiresAcceptance: false,
    });
  });

  it("still resolves client status when the gate is disabled", async () => {
    const loadClientMarker = vi.fn(async () => true);
    const status = await resolveUserTermsAcceptanceStatus({
      loadLatestAcceptance: async () => null,
      loadClientMarker,
      loadGateSetting: async () => "false",
    });

    expect(loadClientMarker).toHaveBeenCalledOnce();
    expect(status).toMatchObject({
      gateEnabled: false,
      isClient: true,
      accepted: false,
      requiresAcceptance: false,
    });
  });
});
