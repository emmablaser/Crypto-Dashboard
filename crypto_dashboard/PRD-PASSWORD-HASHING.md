# PRD — Hashed Shared Password (No Plaintext Secret in the Repo)

**Status:** ✅ Implemented
**Scope:** Replace the plaintext `SITE_PASSWORD` with a **stored password hash** so the
real shared password never appears in code, `.env`, or git history. A **separate
offline process** turns the human-chosen password into the hash that gets
deployed.

**Shipped in:**
- `scripts/hash-password.mjs` + the `hash-password` npm script (offline hasher).
- `app/lib/auth.server.ts` — `verifyAgainstHash` / `verifyPassword` (scrypt verify).
- `app/lib/auth.server.test.ts` — unit coverage.
- `.env` — `SITE_PASSWORD_HASH` replaces `SITE_PASSWORD`.

---

## 1. Context & Problem

The dashboard is gated by a single shared password (server-side session cookie —
see [`PRD-AUTH.md`](./PRD-AUTH.md)). **Before this change**, the actual password
was stored in **plaintext**:

```ts
// app/lib/auth.server.ts (before)
const SITE_PASSWORD = process.env.SITE_PASSWORD ?? "";

export function verifyPassword(input: string): boolean {
  if (!SITE_PASSWORD) return false;
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(SITE_PASSWORD).digest();
  return timingSafeEqual(a, b); // hashing is only for a constant-time compare
}
```

The hashing here exists **only** to make the comparison timing-safe — the real
secret still lives in `.env` (`SITE_PASSWORD=crypto-dashboard`). Problems:

- Anyone with read access to the environment / deploy config sees the password.
- It is easy to leak: committed `.env`, CI logs, screenshots, shell history.
- There is no separation between "the secret a human picks" and "the value the
  app needs to verify it."

## 2. Goal

The app should be able to **verify** the shared password **without ever storing
the password itself**. Specifically:

1. The repo, `.env`, and runtime config contain **only a hash** (a verifier),
   never the plaintext password.
2. A **separate, offline process** (a small CLI script) takes the real password
   from a human and produces the hash to deploy. The password is typed at that
   moment and never persisted.
3. Login still works exactly as today from the user's perspective: type the
   shared password → unlocked.
4. Even if the stored hash leaks, recovering the password must be **expensive**
   (slow KDF + per-deployment salt), not a quick lookup.

### Non-goals

- Per-user accounts, password reset, or multi-credential support (still a single
  shared secret — see `PRD-AUTH.md §8`).
- Client-only / static-hosting variants (covered in `PRD-AUTH.md`). This PRD
  assumes the **server-side** deployment we already run.

## 3. Why Plain SHA-256 Is Not Enough

The previous code used a single unsalted `SHA-256`. As a *password verifier* that
is weak if the hash ever leaks:

- **Fast to brute force:** SHA-256 is designed to be fast; a leaked digest can be
  attacked at billions of guesses/sec on commodity GPUs.
- **No salt:** identical passwords produce identical digests, and precomputed
  rainbow tables apply directly.

The fix is a **slow, salted password hashing function (KDF)**. We use
**`scrypt`**, which is:

- Built into Node's `node:crypto` (no new dependency).
- Memory-hard and deliberately slow, so offline guessing is costly.
- Salted per hash, so the stored value is unique even if the password is reused.

> Alternatives considered: `bcrypt` / `argon2` (excellent, but add a native
> dependency) and PBKDF2 (fine, in-stdlib, but not memory-hard). `scrypt` gives
> the best security-per-dependency for this project. Decision: **scrypt**.

## 4. Design Overview

Two pieces, cleanly separated:

```
 ┌─────────────────────────────┐        ┌──────────────────────────────┐
 │  Offline (run by a human)   │        │  Runtime (the server)        │
 │                             │        │                              │
 │  npm run hash-password      │        │  verifyPassword(input)       │
 │   ↳ prompt for password     │        │   ↳ read SITE_PASSWORD_HASH  │
 │   ↳ scrypt(password, salt)  │        │   ↳ scrypt(input, salt)      │
 │   ↳ print salt:hash string  │  ───▶  │   ↳ timing-safe compare      │
 │      (paste into env)       │  hash  │   ↳ true / false             │
 └─────────────────────────────┘  only  └──────────────────────────────┘
```

- The **only** thing that crosses from offline → runtime is the **hash string**.
- The plaintext password exists only transiently in the human's terminal when
  generating the hash, and in the user's browser at login time.

### Stored hash format

A single self-describing string so one env var carries everything needed to
verify (and lets us evolve parameters later):

```
scrypt:N=16384,r=8,p=1:<saltBase64>:<hashBase64>
```

- `scrypt` — algorithm tag (future-proofing for an upgrade path).
- `N,r,p` — scrypt cost parameters, stored so old hashes still verify if we raise
  costs later.
- `salt` — random 16 bytes, base64. Public by design (salts are not secret).
- `hash` — derived key (e.g. 32 bytes), base64.

> **Delimiter note:** fields are joined with `:`, not the conventional `$`. Vite
> loads `.env` through `dotenv-expand`, which treats `$name` as a variable
> reference and would silently mangle a `$`-delimited verifier (even when
> quoted). `:` never occurs in base64, so it is a safe, expansion-proof
> separator.

## 5. Configuration Changes

| Variable | Before | After |
| --- | --- | --- |
| `SITE_PASSWORD` | plaintext password | **removed** |
| `SITE_PASSWORD_HASH` | — | `scrypt:N=...:salt:hash` (a verifier; overrides the built-in default) |
| `SESSION_SECRET` | unchanged | unchanged |

- `README.md` documents `SITE_PASSWORD_HASH` and points to `npm run
  hash-password`.
- **Built-in default (committed):** `auth.server.ts` ships a `DEFAULT_PASSWORD_HASH`
  verifier for the demo password `crypto-dashboard`, used when `SITE_PASSWORD_HASH`
  is unset. Because it is a salted scrypt **hash, not the password**, committing it
  is safe and lets a fresh clone run with no `.env`. This is a deliberate
  portfolio-project trade-off: convenience of "clone and run" over forcing each
  cloner to generate a verifier.
- **Override:** set `SITE_PASSWORD_HASH` (e.g. in a git-ignored `.env` or the
  host's secret store) to use a different password. Even if it leaks, it is a
  slow-to-crack salted verifier, not the password.
- **Migration:** delete `SITE_PASSWORD` everywhere (env, deploy secrets, shell
  history) once `SITE_PASSWORD_HASH` is in place.

## 6. The Separate Hashing Process (CLI)

A standalone script, run by a human, that never writes the password anywhere.

**Invocation**

```bash
npm run hash-password
# → prompts (hidden input) for the password, then confirms it
# → prints:  SITE_PASSWORD_HASH=scrypt:N=16384,r=8,p=1:<salt>:<hash>
```

It reads the password from a hidden TTY prompt (preferred) so it never lands in
shell history or `argv`. It writes nothing to disk; the operator copies the line
into `.env` / the host's secret store. Piped input
(`printf 'pw\npw\n' | npm run hash-password`) is also supported for CI.

**Behavior (as implemented)**

1. Read password + confirmation from stdin. On a real TTY keystrokes are masked
   (`*`); when stdin is piped, masking is skipped and lines are read directly.
   A single `readline` interface handles both prompts (a fresh interface per
   prompt would swallow the whole piped stream).
2. Reject an empty password, or a confirmation that doesn't match (exit 1).
3. Generate a cryptographically random 16-byte salt.
4. Derive the key with `scrypt(password, salt, 32, { N, r, p })`.
5. Print the `SITE_PASSWORD_HASH=...` line to stdout. Exit.

**`package.json`**

```json
{ "scripts": { "hash-password": "node scripts/hash-password.mjs" } }
```

## 7. Runtime Verification Changes

`app/lib/auth.server.ts` exposes a pure `verifyAgainstHash(input, stored)` helper
that parses the stored verifier, recomputes scrypt over the submitted password
with the **same salt + params**, and compares in constant time. `verifyPassword`
wraps it and reads `SITE_PASSWORD_HASH` **at call time** (so tests / key rotation
don't need a module reload). Malformed, non-scrypt, or empty input fails closed.

```ts
import { scryptSync, timingSafeEqual } from "node:crypto";

export function verifyAgainstHash(input: string, stored: string): boolean {
  if (!stored) return false;
  const parts = stored.split(":");
  if (parts.length !== 4) return false;
  const [scheme, params, saltB64, hashB64] = parts;
  if (scheme !== "scrypt") return false;

  const cost = Object.fromEntries(
    params.split(",").map((kv) => kv.split("=")),
  ) as Record<string, string>;
  const N = Number(cost.N), r = Number(cost.r), p = Number(cost.p);
  if (!N || !r || !p) return false;

  const expected = Buffer.from(hashB64, "base64");
  if (expected.length === 0) return false;

  let actual: Buffer;
  try {
    actual = scryptSync(input, Buffer.from(saltB64, "base64"), expected.length, {
      N, r, p,
    });
  } catch {
    return false; // e.g. scrypt cost params out of bounds
  }
  return timingSafeEqual(actual, expected);
}

export function verifyPassword(input: string): boolean {
  return verifyAgainstHash(input, process.env.SITE_PASSWORD_HASH ?? "");
}
```

- Nothing else in the auth flow changes: `login.tsx`, `requireAuth`,
  `createAuthSession`, and the session cookie all stay as-is. Only the *source of
  truth* for "is this password correct" changes from a plaintext compare to a
  KDF verify.
- `scryptSync` is acceptable for a single shared-password login (one derivation
  per submit). If contention ever matters, switch to async `scrypt`.

## 8. Security Properties

- **No plaintext secret at rest:** the password is never in code, `.env`, git, or
  CI config — only the salted scrypt verifier.
- **Leak-resistant:** a stolen `SITE_PASSWORD_HASH` forces an attacker into an
  expensive offline scrypt brute force; a strong shared password makes that
  impractical.
- **Salted:** per-deployment salt defeats rainbow tables and hides password reuse
  across environments.
- **Timing-safe compare:** unchanged property, now over the derived keys.
- **Fail closed on bad input:** `verifyAgainstHash` rejects empty, malformed, or
  non-scrypt verifiers. (`verifyPassword` falls back to the committed demo
  verifier only when `SITE_PASSWORD_HASH` is *unset* — see below.)

### Honest limitations

- **Committed demo verifier:** the default `DEFAULT_PASSWORD_HASH` ships in the
  repo for clone-and-run convenience, so the demo password (`crypto-dashboard`)
  is effectively public (it's also in the README). That's fine for a portfolio
  project, but a real deployment must override `SITE_PASSWORD_HASH` with its own
  verifier and set a secret `SESSION_SECRET`.
- Still a **single shared secret** — no per-user identity or revocation (see
  `PRD-AUTH.md §8`). Rotating it logs everyone out.
- The KDF only buys time **if the hash leaks**; it does not replace keeping the
  `SITE_PASSWORD_HASH` (in real use) and `SESSION_SECRET` out of public places.
- Security ultimately depends on the **chosen password's strength**.

## 9. Rollout / Migration  — ✅ done

1. ✅ Added `scripts/hash-password.mjs` + the `hash-password` npm script.
2. ✅ Updated `auth.server.ts` to read `SITE_PASSWORD_HASH` and verify via scrypt.
3. ✅ Ran `npm run hash-password`, put the result in `.env` as
   `SITE_PASSWORD_HASH`.
4. ✅ **Removed `SITE_PASSWORD`** from `.env`.
5. ✅ Updated `README.md` (and `PRD.md`) for the new variable and the generation
   step.
6. ✅ Verified: correct password unlocks; wrong password is rejected; missing hash
   fails closed.

### Lesson learned: the `$` → `:` delimiter

The first cut used the conventional PHC-style `$` delimiter
(`scrypt$N=...$salt$hash`). It failed at runtime because Vite loads `.env`
through **`dotenv-expand`**, which expands `$name` as a variable reference —
quietly turning the stored verifier into garbage (and **quoting didn't help** in
this Vite version). Switching the delimiter to `:` (never present in base64)
made the value expansion-proof. See the delimiter note in §4.

## 10. Testing  — ✅ implemented in `app/lib/auth.server.test.ts`

- **Unit (`verifyAgainstHash`):** a generated `(password, salt, params)` verifier
  returns `true` for the right password and `false` for wrong ones, trailing
  whitespace, empty input, an empty verifier, and malformed / non-scrypt /
  out-of-range-param strings.
- **Unit (`verifyPassword`):** reads `SITE_PASSWORD_HASH` from the environment at
  call time, and fails closed when it is unset.
- **Round-trip (manual):** a hash produced by the CLI verifies successfully and
  survives Vite's `loadEnv` intact.

## 11. Future Extensions

- **Param upgrade path:** because cost params are embedded in the stored string,
  raising `N` later is just regenerating the hash — old hashes still verify.
- **Pluggable scheme:** the `scheme:...` prefix allows swapping to argon2/bcrypt
  later without changing the env-var contract.
- **Move to a secret manager** (host secret store / Vault) for the hash instead
  of `.env` when deploying for real.
