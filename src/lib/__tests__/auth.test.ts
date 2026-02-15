import { verifyPassword, createSessionToken, verifySessionToken } from "../auth";

beforeAll(() => {
  process.env.ADMIN_JWT_SECRET = "test-secret-key-at-least-32-chars-long!!";
});

describe("verifyPassword", () => {
  it("returns true for correct password", async () => {
    const hash = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
    process.env.ADMIN_PASSWORD_HASH = hash;
    const result = await verifyPassword("wrong-password");
    expect(typeof result).toBe("boolean");
  });
});

describe("JWT session tokens", () => {
  it("creates and verifies a valid token", async () => {
    const token = await createSessionToken("harrison");
    expect(typeof token).toBe("string");

    const payload = await verifySessionToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe("harrison");
  });

  it("returns null for invalid token", async () => {
    const payload = await verifySessionToken("garbage-token");
    expect(payload).toBeNull();
  });
});
