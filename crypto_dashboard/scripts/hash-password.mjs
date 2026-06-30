#!/usr/bin/env node
/**
 * Offline password-hashing tool.
 *
 * Reads the shared password (hidden when run interactively) and prints a salted
 * scrypt verifier to paste into `.env` as SITE_PASSWORD_HASH. The plaintext
 * password is never written to disk, argv, or shell history — it lives only in
 * this process while the hash is derived.
 *
 *   npm run hash-password                    # interactive, masked prompt
 *   printf 'pw\npw\n' | npm run hash-password # piped (e.g. CI)
 *
 * Output:  SITE_PASSWORD_HASH=scrypt:N=16384,r=8,p=1:<salt>:<hash>
 *
 * The fields are joined with `:` (not `$`) so the value survives dotenv/Vite
 * env loading, which expands `$name` as a variable reference.
 */
import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline";

const N = 16384;
const r = 8;
const p = 1;
const KEYLEN = 32;
const SALT_BYTES = 16;

/** Reads up to two lines (password + confirmation) from stdin. */
function readCredentials() {
  const isTty = Boolean(process.stdin.isTTY);
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  // Mask keystrokes on a real TTY so the password never echoes. The prompt
  // label itself must still print, so only non-label writes get masked.
  let activePrompt = "";
  let masking = false;
  if (isTty) {
    const writeOutput = rl._writeToOutput.bind(rl);
    rl._writeToOutput = (chunk) => {
      if (!masking || chunk.includes(activePrompt)) writeOutput(chunk);
      else rl.output.write("*");
    };
  }

  return new Promise((resolve) => {
    const lines = [];
    const prompts = ["Shared password: ", "\nConfirm password: "];

    const ask = () => {
      if (lines.length >= 2) {
        rl.close();
        resolve(lines);
        return;
      }
      activePrompt = prompts[lines.length];
      masking = isTty;
      rl.question(activePrompt, (answer) => {
        masking = false;
        lines.push(answer);
        ask();
      });
    };

    // When stdin is piped it ends after its lines; resolve with what we have.
    rl.on("close", () => resolve(lines));
    ask();
  });
}

const [password, confirm] = await readCredentials();

if (!password) {
  console.error("\nPassword must not be empty.");
  process.exit(1);
}
if (confirm !== undefined && password !== confirm) {
  console.error("\nPasswords do not match.");
  process.exit(1);
}

const salt = randomBytes(SALT_BYTES);
const hash = scryptSync(password, salt, KEYLEN, { N, r, p });
const encoded = `scrypt:N=${N},r=${r},p=${p}:${salt.toString("base64")}:${hash.toString("base64")}`;

console.log("\nAdd this line to your .env (replacing any existing SITE_PASSWORD_HASH):\n");
console.log(`SITE_PASSWORD_HASH=${encoded}`);
