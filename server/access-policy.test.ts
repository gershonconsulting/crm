import test from 'node:test';
import assert from 'node:assert/strict';
import { isPilotOwner, isSameOriginMutation, publicUser } from './access-policy';
import { hashPassword, verifyPassword } from './auth-utils';
import { insertTaskSchema } from '../shared/schema';

test('only the verified, exact pilot email is allowed', () => {
  const owner = 'olivier@gershonconsulting.com';
  assert.equal(isPilotOwner(' OLIVIER@gershonconsulting.com ', true, owner), true);
  for (const email of [undefined, null, '', 'other@gershonconsulting.com', 'olivier@gershonconsulting.com.evil.test']) {
    assert.equal(isPilotOwner(email, true, owner), false);
  }
  assert.equal(isPilotOwner(owner, false, owner), false);
  assert.equal(isPilotOwner(owner, 'true', owner), false);
  assert.equal(isPilotOwner(owner, true, ''), false);
});

test('mutations require the configured origin, including login and logout', () => {
  const origin = 'https://crm.gershon.ai';
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal(isSameOriginMutation(method, origin, origin), true);
    assert.equal(isSameOriginMutation(method, undefined, origin), false);
    assert.equal(isSameOriginMutation(method, 'https://crm.gershon.ai.evil.test', origin), false);
  }
  assert.equal(isSameOriginMutation('GET', undefined, origin), true);
});

test('public user responses omit authentication material', () => {
  assert.deepEqual(publicUser({ id: 1, email: 'test@example.com', password: 'hash', googleSubject: 'subject' }), { id: 1, email: 'test@example.com' });
});

test('password hashes use random salts and reject incorrect and malformed credentials', async () => {
  const one = await hashPassword('a sample test password');
  const two = await hashPassword('a sample test password');
  assert.notEqual(one, two);
  assert.equal(await verifyPassword('a sample test password', one), true);
  assert.equal(await verifyPassword('incorrect', one), false);
  for (const invalid of ['', 'not-a-hash', 'a.b', 'legacy-hash']) assert.equal(await verifyPassword('anything', invalid), false);
});

test('task dates survive JSON transport and invalid dates are rejected', () => {
  const result = insertTaskSchema.parse({ title: 'Follow up', dueDate: '2026-11-06T12:30:00-04:00' });
  assert.equal(result.dueDate?.toISOString(), '2026-11-06T16:30:00.000Z');
  assert.equal(insertTaskSchema.parse({ title: 'No due date', dueDate: null }).dueDate, null);
  assert.equal(insertTaskSchema.safeParse({ title: 'Invalid', dueDate: 'not-a-date' }).success, false);
});
