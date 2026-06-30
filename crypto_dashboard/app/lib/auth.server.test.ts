import { randomBytes, scryptSync } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { verifyAgainstHash, verifyPassword } from "./auth.server";

const N = 16384;
const r = 8;
const p = 1;

function makeHash(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, { N, r, p });
  return `scrypt:N=${N},r=${r},p=${p}:${salt.toString("base64")}:${hash.toString(
    "base64",
  )}`;
}

describe("verifyAgainstHash", () => {
  const stored = makeHash("correct horse");

  it("accepts the correct password", () => {
    expect(verifyAgainstHash("correct horse", stored)).toBe(true);
  });

  it("rejects an incorrect password", () => {
    expect(verifyAgainstHash("wrong", stored)).toBe(false);
    expect(verifyAgainstHash("correct horse ", stored)).toBe(false);
    expect(verifyAgainstHash("", stored)).toBe(false);
  });

  it("fails closed for an empty or missing verifier", () => {
    expect(verifyAgainstHash("anything", "")).toBe(false);
  });

  it("rejects malformed verifier strings", () => {
    expect(verifyAgainstHash("x", "not-a-hash")).toBe(false);
    expect(verifyAgainstHash("x", "scrypt:N=16384,r=8,p=1:onlythreeparts")).toBe(
      false,
    );
    expect(verifyAgainstHash("x", "bcrypt:N=16384,r=8,p=1:c2FsdA==:aGFzaA==")).toBe(
      false,
    );
    expect(
      verifyAgainstHash("x", "scrypt:N=0,r=0,p=0:c2FsdA==:aGFzaA=="),
    ).toBe(false);
  });
});

describe("verifyPassword", () => {
  const original = process.env.SITE_PASSWORD_HASH;
  afterEach(() => {
    process.env.SITE_PASSWORD_HASH = original;
  });

  it("reads the configured verifier from the environment at call time", () => {
    process.env.SITE_PASSWORD_HASH = makeHash("s3cret");
    expect(verifyPassword("s3cret")).toBe(true);
    expect(verifyPassword("nope")).toBe(false);
  });

  it("fails closed when no verifier is configured", () => {
    delete process.env.SITE_PASSWORD_HASH;
    expect(verifyPassword("s3cret")).toBe(false);
  });
});
