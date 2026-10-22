import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from './app';
import { config } from './config';
import { resetMembers } from './repositories/memberRepository';

const withServiceKey = { 'x-service-key': config.serviceKey };
const asLibrarian = { 'x-user-id': '1', 'x-user-role': 'librarian' };
const asMember = { 'x-user-id': '2', 'x-user-role': 'member', 'x-user-member-id': '7' };

describe('public /members identity', () => {
  beforeEach(() => {
    resetMembers();
  });

  it('responds 401 without identity headers and without a service key', async () => {
    const response = await request(app).get('/members');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid user identity');
  });

  it('responds 401 when x-user-id is not a positive integer', async () => {
    const response = await request(app)
      .get('/members')
      .set('x-user-id', 'abc')
      .set('x-user-role', 'librarian');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid user identity');
  });

  it('responds 401 when x-user-role is missing', async () => {
    const response = await request(app).get('/members').set('x-user-id', '1');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid user identity');
  });

  it('responds 401 for PATCH and DELETE without identity headers', async () => {
    const patchResponse = await request(app).patch('/members/1').send({ name: 'Ada' });

    expect(patchResponse.status).toBe(401);
    expect(patchResponse.body.error).toBe('Invalid user identity');

    const deleteResponse = await request(app).delete('/members/1');

    expect(deleteResponse.status).toBe(401);
    expect(deleteResponse.body.error).toBe('Invalid user identity');
  });

  it('responds 401 when a member has no x-user-member-id', async () => {
    const response = await request(app)
      .get('/members/7')
      .set('x-user-id', '2')
      .set('x-user-role', 'member');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid user identity');
  });

  it('lets a member with x-user-member-id through the identity middleware', async () => {
    const response = await request(app).get('/members/7').set(asMember);

    expect(response.status).not.toBe(401);
  });

  it('lets a librarian without x-user-member-id through the identity middleware', async () => {
    const response = await request(app).get('/members/7').set(asLibrarian);

    expect(response.status).not.toBe(401);
  });

  it('still requires the service key for /internal and for unknown paths', async () => {
    const internalWithoutKey = await request(app)
      .post('/internal/members')
      .send({ name: 'Ada', email: 'ada@library.test' });

    expect(internalWithoutKey.status).toBe(401);
    expect(internalWithoutKey.body.error).toBe('Invalid service key');

    const unknownWithoutKey = await request(app).get('/does-not-exist');

    expect(unknownWithoutKey.status).toBe(401);

    const unknownWithKey = await request(app).get('/does-not-exist').set(withServiceKey);

    expect(unknownWithKey.status).toBe(404);
    expect(unknownWithKey.body.error).toBe('Not Found');
    expect(typeof unknownWithKey.body.requestId).toBe('string');
    expect(unknownWithKey.body.requestId.length).toBeGreaterThan(0);
  });

  it('still responds 200 on /health without any headers', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'member-service' });
  });
});
