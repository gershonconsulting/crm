import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import express from 'express';
import type { AddressInfo } from 'node:net';

test('HTTP auth gate protects every CRM route without a database or Google credentials', async () => {
  process.env.NODE_ENV = 'test';
  process.env.APP_URL = 'http://localhost:5000';
  process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/unused';
  process.env.SESSION_SECRET = randomBytes(32).toString('hex');
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  const { setupAuth } = await import('./auth');
  const { pool } = await import('./db');
  const app = express();
  app.use(express.json());
  setupAuth(app);
  app.get('/api/contacts', (_req, res) => res.json([{ name: 'private' }]));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    for (const path of ['/api/contacts', '/api/deals', '/api/users', '/api/auth/me', '/api/import/streak-data']) {
      const result = await fetch(base + path);
      assert.equal(result.status, 401, path);
      assert.equal(result.headers.get('cache-control'), 'no-store');
      assert.doesNotMatch(await result.text(), /private/);
    }
    assert.deepEqual(await (await fetch(base + '/api/auth/methods')).json(), { password: true, google: false });
    assert.equal((await fetch(base + '/api/auth/google')).status, 503);
    for (const path of ['/api/auth/login', '/api/auth/logout', '/api/users']) {
      assert.equal((await fetch(base + path, { method: 'POST', headers: { origin: 'https://untrusted.example' } })).status, 403);
    }
    const mutation = await fetch(base + '/api/contacts', { method: 'POST', headers: { origin: 'http://localhost:5000' } });
    assert.equal(mutation.status, 401);
    const callback = await fetch(base + '/api/auth/google/callback?state=invalid&code=invalid', { redirect: 'manual' });
    assert.equal(callback.status, 302);
    assert.equal(callback.headers.get('location'), '/?signin=failed');
    assert.equal((await fetch(base + '/api/auth/login', { method: 'POST', headers: { origin: 'http://localhost:5000', 'content-type': 'application/json' }, body: '{}' })).status, 400);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await pool.end();
  }
});
