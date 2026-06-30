import { scryptSync, timingSafeEqual } from "node:crypto";
import { createCookieSessionStorage, redirect } from "react-router";

/**
 * Shared-password access control.
 *
 * The whole dashboard sits behind a single site-wide password (no usernames).
 * A correct password sets a signed, httpOnly session cookie so the visitor
 * stays "unlocked" without re-entering it on every request.
 *
 * The real password is never stored — only a salted scrypt verifier produced
 * offline by `npm run hash-password`. See PRD-PASSWORD-HASHING.md.
 *
 * Configure via environment variables:
 *   SITE_PASSWORD_HASH — scrypt verifier `scrypt:N=...,r=...,p=...:salt:hash`
 *                        (required in production; generate with hash-password)
 *   SESSION_SECRET     — secret used to sign the session cookie
 */

const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-please-change";

if (!process.env.SITE_PASSWORD_HASH) {
  console.warn(
    "[auth] SITE_PASSWORD_HASH is not set. Run `npm run hash-password` and put the output in .env (see README). Until then, login will reject every password.",
  );
}

/**
 * Verifies a password against a stored scrypt verifier in constant time.
 *
 * Format: `scrypt:N=<n>,r=<r>,p=<p>:<saltBase64>:<hashBase64>`. A `:` delimiter
 * (not `$`) is used so the value survives dotenv/Vite env expansion, which
 * treats `$name` as a variable reference. The salt and cost params travel with
 * the hash so old verifiers keep working if we raise costs later. Anything
 * malformed or non-scrypt fails closed.
 */
export function verifyAgainstHash(input: string, stored: string): boolean {
  if (!stored) return false;
  const parts = stored.split(":");
  if (parts.length !== 4) return false;
  const [scheme, params, saltB64, hashB64] = parts;
  if (scheme !== "scrypt") return false;

  const cost = Object.fromEntries(
    params.split(",").map((kv) => kv.split("=")),
  ) as Record<string, string>;
  const N = Number(cost.N);
  const r = Number(cost.r);
  const p = Number(cost.p);
  if (!N || !r || !p) return false;

  const expected = Buffer.from(hashB64, "base64");
  if (expected.length === 0) return false;

  let actual: Buffer;
  try {
    actual = scryptSync(input, Buffer.from(saltB64, "base64"), expected.length, {
      N,
      r,
      p,
    });
  } catch {
    return false;
  }
  return timingSafeEqual(actual, expected);
}

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__crypto_session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [SESSION_SECRET],
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
});

function getSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

/**
 * Checks a submitted password against the configured scrypt verifier. Reads the
 * env var at call time so tests (and key rotation) can change it without a
 * module reload. Fails closed when nothing is configured.
 */
export function verifyPassword(input: string): boolean {
  return verifyAgainstHash(input, process.env.SITE_PASSWORD_HASH ?? "");
}

export async function isAuthed(request: Request): Promise<boolean> {
  const session = await getSession(request);
  return session.get("authed") === true;
}

/** Redirects to /login when the request isn't authenticated. */
export async function requireAuth(request: Request): Promise<void> {
  if (await isAuthed(request)) return;
  throw redirect("/login");
}

export async function createAuthSession(redirectTo: string) {
  const session = await sessionStorage.getSession();
  session.set("authed", true);
  return redirect(redirectTo, {
    headers: { "Set-Cookie": await sessionStorage.commitSession(session) },
  });
}

export async function logout(request: Request) {
  const session = await getSession(request);
  return redirect("/login", {
    headers: { "Set-Cookie": await sessionStorage.destroySession(session) },
  });
}
