import { createInterface } from 'node:readline';
import { hashPassword, PasswordSchema } from '../auth/passwords.ts';
import { createPgDb } from '../db/db.ts';

/**
 * Sets a user's password (Argon2id) directly in the database — used once
 * after seeding to give the `admin` account a real password.
 *
 *   DATABASE_URL=… node apps/api/dist/cli/set-password.js admin
 *   (type the password, then Enter — it is read from stdin, not argv, so it
 *    doesn't end up in shell history or process lists)
 *
 * Flags: --temporary  → the user must choose a new password at next sign-in.
 */
async function main() {
  const args = process.argv.slice(2);
  const username = args.find((a) => !a.startsWith('--'));
  const temporary = args.includes('--temporary');
  const url = process.env.DATABASE_URL;
  if (!username || !url) {
    console.error('Usage: DATABASE_URL=… node dist/cli/set-password.js <username> [--temporary]  (password on stdin)');
    process.exit(2);
  }
  const password = await readLine(process.stdin.isTTY ? `New password for ${username}: ` : '');
  const parsed = PasswordSchema.safeParse(password);
  if (!parsed.success) {
    console.error(parsed.error.issues.map((i) => i.message).join('\n'));
    process.exit(2);
  }
  const db = createPgDb(url, 1);
  try {
    const hash = await hashPassword(parsed.data);
    const { rowCount } = await db.tx(async (q) => {
      const r = await q.query(
        `UPDATE users SET password_hash = $2, must_change_password = $3, password_changed_at = CURRENT_TIMESTAMP, failed_login_count = 0, locked_until = NULL
          WHERE username_normalized = lower($1) AND deleted_at IS NULL`,
        [username, hash, temporary],
      );
      // Existing sessions end with the old password.
      await q.query('UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE revoked_at IS NULL AND user_id IN (SELECT id FROM users WHERE username_normalized = lower($1))', [username]);
      return r;
    });
    if (!rowCount) {
      console.error(`No user named "${username}".`);
      process.exitCode = 1;
    } else {
      console.log(`Password updated for ${username}${temporary ? ' (must change at next sign-in)' : ''}.`);
    }
  } finally {
    await db.close();
  }
}

function readLine(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
    if (prompt) process.stdout.write(prompt);
    rl.once('line', (line) => {
      // Resolve first: close() fires 'close' synchronously, which would resolve with ''.
      resolve(line.replace(/\r$/, ''));
      rl.close();
    });
    rl.once('close', () => resolve(''));
  });
}

await main();
