import {
  verifyWhitelabelPassword,
  createWhitelabelSessionToken,
  verifyWhitelabelSessionToken,
} from "../whitelabel-auth";
import { hash } from "bcryptjs";

describe("whitelabel-auth", () => {
  beforeEach(() => {
    process.env.WHITELABEL_JWT_SECRET = "test-secret-please-replace-with-a-real-long-one";
    process.env.WHITELABEL_PORTAL_USERNAME = "employer";
  });

  it("verifyWhitelabelPassword returns true for correct password", async () => {
    process.env.WHITELABEL_PORTAL_PASSWORD_HASH = await hash("hunter2", 12);
    expect(await verifyWhitelabelPassword("hunter2")).toBe(true);
  });

  it("verifyWhitelabelPassword returns false for wrong password", async () => {
    process.env.WHITELABEL_PORTAL_PASSWORD_HASH = await hash("hunter2", 12);
    expect(await verifyWhitelabelPassword("wrong")).toBe(false);
  });

  it("verifyWhitelabelPassword returns false when env hash missing", async () => {
    delete process.env.WHITELABEL_PORTAL_PASSWORD_HASH;
    expect(await verifyWhitelabelPassword("anything")).toBe(false);
  });

  it("signed session token verifies successfully", async () => {
    const token = await createWhitelabelSessionToken();
    const payload = await verifyWhitelabelSessionToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe("employer");
  });

  it("tampered token fails verification", async () => {
    const token = await createWhitelabelSessionToken();
    const tampered = token.slice(0, -2) + "xx";
    expect(await verifyWhitelabelSessionToken(tampered)).toBeNull();
  });
});
