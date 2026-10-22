import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from './app';
import { config } from './config';
import { createMember, resetMembers } from './repositories/memberRepository';

const withServiceKey = { 'x-service-key': config.serviceKey };

describe('GET /internal/members', () => {
  beforeEach(() => {
    resetMembers();
  });

  it('responds 200 with every member as a bare array', async () => {
    createMember({ name: 'Ada', email: 'Ada@Library.test' });
    createMember({ name: 'Grace', email: 'grace@library.test' });

    const response = await request(app).get('/internal/members').set(withServiceKey);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: 1, name: 'Ada', email: 'ada@library.test', active: true },
      { id: 2, name: 'Grace', email: 'grace@library.test', active: true },
    ]);
  });

  it('responds 200 with an empty array when no member exists', async () => {
    const response = await request(app).get('/internal/members').set(withServiceKey);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('responds 401 without a service key', async () => {
    createMember({ name: 'Ada', email: 'ada@library.test' });

    const response = await request(app).get('/internal/members');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid service key');
  });

  it('responds 401 with a wrong service key', async () => {
    createMember({ name: 'Ada', email: 'ada@library.test' });

    const response = await request(app)
      .get('/internal/members')
      .set('x-service-key', 'not-the-service-key');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid service key');
  });
});
