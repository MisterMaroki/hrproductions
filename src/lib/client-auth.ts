import { hash, compare } from "bcryptjs";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE = "client_session";
const SESSION_DURATION = 7 * 24 * 60 * 60; // 7 days

function getSecret() {
  const secret = process.env.CLIENT_JWT_SECRET;
  if (!secret) throw new Error("CLIENT_JWT_SECRET not set");
  return new TextEncoder().encode(secret);
}

export interface ClientJWTPayload extends JWTPayload {
  sub: string; // clientId
  email: string;
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12);
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return compare(password, passwordHash);
}

export async function createClientSessionToken(
  clientId: string,
  email: string
): Promise<string> {
  return new SignJWT({ sub: clientId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getSecret());
}

export async function verifyClientSessionToken(
  token: string
): Promise<ClientJWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as ClientJWTPayload;
  } catch {
    return null;
  }
}

export async function setClientSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    path: "/",
  });
}

export async function clearClientSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getClientSession(): Promise<ClientJWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyClientSessionToken(token);
}
