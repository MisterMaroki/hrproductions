import { compare } from "bcryptjs";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE = "whitelabel_session";
const SESSION_DURATION = 24 * 60 * 60; // 24h in seconds

function getSecret(): Uint8Array {
  const secret = process.env.WHITELABEL_JWT_SECRET;
  if (!secret) throw new Error("WHITELABEL_JWT_SECRET not set");
  return new TextEncoder().encode(secret);
}

export interface WhitelabelJWTPayload extends JWTPayload {
  sub: string; // username
}

export async function verifyWhitelabelPassword(submitted: string): Promise<boolean> {
  const hash = process.env.WHITELABEL_PORTAL_PASSWORD_HASH;
  if (!hash) return false;
  try {
    return await compare(submitted, hash);
  } catch {
    return false;
  }
}

export async function createWhitelabelSessionToken(): Promise<string> {
  const username = process.env.WHITELABEL_PORTAL_USERNAME || "employer";
  return new SignJWT({ sub: username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getSecret());
}

export async function verifyWhitelabelSessionToken(
  token: string
): Promise<WhitelabelJWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as WhitelabelJWTPayload;
  } catch {
    return null;
  }
}

export async function setWhitelabelSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    path: "/",
  });
}

export async function clearWhitelabelSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getWhitelabelSession(): Promise<WhitelabelJWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyWhitelabelSessionToken(token);
}
