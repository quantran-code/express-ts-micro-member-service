import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from './app';
import { config } from './config';
import { createMember, resetMembers } from './repositories/memberRepository';

const withServiceKey = { 'x-service-key': config.serviceKey };
const asLibrarian = { 'x-user-id': '1', 'x-user-role': 'librarian' };
const asMember = { 'x-user-id': '2', 'x-user-role': 'member', 'x-user-member-id': '1' };

describe('requestId in error responses', () => {
  beforeEach(() => {
    resetMembers();
  });

  it('echoes an incoming x-request-id on the 404 handler', async () => {
    const response = await request(app)
      .get('/does-not-exist')
      .set(withServiceKey)
      .set('x-request-id', 'incoming-request-id');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Not Found', requestId: 'incoming-request-id' });
  });

  it('generates a requestId when no x-request-id header is sent', async () => {
    const response = await request(app).get('/does-not-exist').set(withServiceKey);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Not Found');
    expect(typeof response.body.requestId).toBe('string');
    expect(response.body.requestId.length).toBeGreaterThan(0);
    expect(Object.keys(response.body).sort()).toEqual(['error', 'requestId']);
  });

  it('generates a requestId when the x-request-id header is empty', async () => {
    const response = await request(app)
      .get('/does-not-exist')
      .set(withServiceKey)
      .set('x-request-id', '');

    expect(response.status).toBe(404);
    expect(typeof response.body.requestId).toBe('string');
    expect(response.body.requestId.length).toBeGreaterThan(0);
  });

  it('echoes an incoming x-request-id on a 403 from a route handler', async () => {
    createMember({ name: 'Ada', email: 'ada@library.test' });

    const response = await request(app)
      .get('/members')
      .set(asMember)
      .set('x-request-id', 'echo-me');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'Librarian role required',
      requestId: 'echo-me',
    });
  });

  it('adds a generated requestId to a 404 from a route handler', async () => {
    const response = await request(app).get('/members/999').set(asLibrarian);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Member not found');
    expect(typeof response.body.requestId).toBe('string');
    expect(response.body.requestId.length).toBeGreaterThan(0);
  });

  it('adds a requestId to the service key 401', async () => {
    const response = await request(app)
      .get('/internal/members')
      .set('x-request-id', 'gateway-call-42');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: 'Invalid service key',
      requestId: 'gateway-call-42',
    });
  });

  it('leaves success responses unchanged', async () => {
    const response = await request(app)
      .get('/health')
      .set('x-request-id', 'gateway-call-43');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'member-service' });
  });
});
