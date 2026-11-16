import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { bearer, createTestContext, PASSWORDS, type TestContext } from '../test/harness.ts';

let t: TestContext;
beforeAll(async () => {
  t = await createTestContext();
}, 60_000);
afterAll(() => t.close());

const login = (username: string, password: string) => t.app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password } });

describe('platform', () => {
  test('GET /health checks the database', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });

  test('unknown routes and errors use the error envelope', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
  });

  test('CORS allows only configured origins', async () => {
    const ok = await t.app.inject({ method: 'OPTIONS', url: '/api/auth/login', headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'POST' } });
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const bad = await t.app.inject({ method: 'OPTIONS', url: '/api/auth/login', headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' } });
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('security headers are set', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/health' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
  });

  test('oversized and malformed bodies are rejected', async () => {
    const big = await t.app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'x', password: 'y'.repeat(600 * 1024) } });
    expect(big.statusCode).toBe(413);
    const bad = await t.app.inject({ method: 'POST', url: '/api/auth/login', headers: { 'content-type': 'application/json' }, payload: '{"username":' });
    expect(bad.statusCode).toBe(400);
    const proto = await t.app.inject({ method: 'POST', url: '/api/auth/login', headers: { 'content-type': 'application/json' }, payload: '{"__proto__":{"admin":true},"username":"a","password":"b"}' });
    expect(proto.statusCode).toBe(400);
  });
});

describe('login', () => {
  test('returns a bearer token and the public profile — never the password hash', async () => {
    const res = await login('NguyenVanA01', PASSWORDS.student); // case-insensitive username
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ tokenType: 'Bearer', user: { username: 'nguyenvana01', role: 'STUDENT' } });
    expect(res.body).not.toMatch(/password_hash|passwordHash|argon2/);
    // Only an HMAC of the token is stored.
    const { rows } = await t.db.query<{ token_hash: string }>('SELECT token_hash FROM auth_sessions');
    expect(rows.some((r) => r.token_hash === body.token)).toBe(false);
    expect(rows.every((r) => /^[0-9a-f]{64}$/.test(r.token_hash))).toBe(true);
  });

  test('wrong password and unknown user look identical', async () => {
    const a = await login('tranthib02', 'wrong-password');
    const b = await login('nobody-here', 'wrong-password');
    expect(a.statusCode).toBe(401);
    expect(b.statusCode).toBe(401);
    expect(a.json()).toEqual(b.json());
  });

  test('strict body: extra fields such as role are rejected', async () => {
    const res = await t.app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'admin', password: PASSWORDS.admin, role: 'ADMIN' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_FAILED');
  });

  test('five wrong passwords lock the account for a while (even the right password fails)', async () => {
    for (let i = 0; i < 5; i++) expect((await login('tranthib02', `bad-${i}-password`)).statusCode).toBe(401);
    expect((await login('tranthib02', PASSWORDS.student)).statusCode).toBe(401);
    await t.db.query(`UPDATE users SET locked_until = NULL, failed_login_count = 0 WHERE username = 'tranthib02'`);
    expect((await login('tranthib02', PASSWORDS.student)).statusCode).toBe(200);
  });

  test('disabled accounts cannot sign in', async () => {
    await t.db.query(`UPDATE users SET status = 'DISABLED' WHERE username = 'leminhc03'`);
    const res = await login('leminhc03', PASSWORDS.student);
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('ACCOUNT_DISABLED');
    await t.db.query(`UPDATE users SET status = 'ACTIVE' WHERE username = 'leminhc03'`);
  });
});

describe('session', () => {
  test('me / logout; a revoked token stops working', async () => {
    const token = await t.login('nguyenvana01');
    const me = await t.app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer(token) });
    expect(me.statusCode).toBe(200);
    expect(me.json().user).toMatchObject({ username: 'nguyenvana01', role: 'STUDENT' });
    expect(me.body).not.toContain('sessionId');

    expect((await t.app.inject({ method: 'POST', url: '/api/auth/logout', headers: bearer(token) })).statusCode).toBe(204);
    expect((await t.app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer(token) })).statusCode).toBe(401);
  });

  test('missing or forged tokens are 401', async () => {
    expect((await t.app.inject({ method: 'GET', url: '/api/me/progress' })).statusCode).toBe(401);
    const forged = await t.app.inject({ method: 'GET', url: '/api/me/progress', headers: bearer('A'.repeat(43)) });
    expect(forged.statusCode).toBe(401);
    expect(forged.json().error.code).toBe('UNAUTHENTICATED');
  });

  test('must_change_password blocks everything except changing it', async () => {
    await t.db.query(`UPDATE users SET must_change_password = TRUE WHERE username = 'tranthib02'`);
    const token = await t.login('tranthib02');
    const blocked = await t.app.inject({ method: 'GET', url: '/api/curriculum', headers: bearer(token) });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().error.code).toBe('PASSWORD_CHANGE_REQUIRED');

    const weak = await t.app.inject({ method: 'POST', url: '/api/auth/change-password', headers: bearer(token), payload: { currentPassword: PASSWORDS.student, newPassword: 'short' } });
    expect(weak.statusCode).toBe(400);
    const changed = await t.app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: bearer(token),
      payload: { currentPassword: PASSWORDS.student, newPassword: 'A-brand-new-pass-9' },
    });
    expect(changed.statusCode).toBe(204);
    expect((await t.app.inject({ method: 'GET', url: '/api/curriculum', headers: bearer(token) })).statusCode).toBe(200);
    expect((await login('tranthib02', 'A-brand-new-pass-9')).statusCode).toBe(200);
  });
});

describe('login rate limit', () => {
  test('too many attempts from one IP get 429', async () => {
    const limited = await createTestContext({ LOGIN_RATE_LIMIT: '3' });
    try {
      const codes: number[] = [];
      for (let i = 0; i < 4; i++) {
        codes.push((await limited.app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'admin', password: 'wrong-password' } })).statusCode);
      }
      expect(codes).toEqual([401, 401, 401, 429]);
    } finally {
      await limited.close();
    }
  }, 60_000);
});
