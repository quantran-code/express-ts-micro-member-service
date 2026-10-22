import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from './app';
import { config } from './config';
import { createMember, resetMembers } from './repositories/memberRepository';

const withServiceKey = { 'x-service-key': config.serviceKey };

describe('GET /internal/members/:id', () => {
  beforeEach(() => {
    resetMembers();
  });

  it('responds 200 with the member for an existing id', async () => {
    const member = createMember({ name: 'Ada', email: 'Ada@Library.test' });

    const response = await request(app)
      .get(`/internal/members/${member.id}`)
      .set(withServiceKey);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 1, name: 'Ada', email: 'ada@library.test' });
  });

  it('responds 404 when no member has that id', async () => {
    const response = await request(app).get('/internal/members/999').set(withServiceKey);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Member not found');
  });

  it('responds 404 when the id is not a number', async () => {
    const response = await request(app).get('/internal/members/abc').set(withServiceKey);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Member not found');
  });

  it('responds 401 without a valid service key', async () => {
    const member = createMember({ name: 'Ada', email: 'ada@library.test' });

    const missing = await request(app).get(`/internal/members/${member.id}`);

    expect(missing.status).toBe(401);
    expect(missing.body.error).toBe('Invalid service key');

    const wrong = await request(app)
      .get(`/internal/members/${member.id}`)
      .set('x-service-key', 'not-the-service-key');

    expect(wrong.status).toBe(401);
    expect(wrong.body.error).toBe('Invalid service key');
  });
});
