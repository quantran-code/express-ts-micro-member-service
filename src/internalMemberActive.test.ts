import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from './app';
import { config } from './config';
import { createMember, findMemberById, resetMembers } from './repositories/memberRepository';

const withServiceKey = { 'x-service-key': config.serviceKey };

describe('PATCH /internal/members/:id/active', () => {
  beforeEach(() => {
    resetMembers();
    createMember({ name: 'Ada', email: 'ada@library.test' });
  });

  it('deactivates the member and returns the full member', async () => {
    const response = await request(app)
      .patch('/internal/members/1/active')
      .set(withServiceKey)
      .send({ active: false });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: 1,
      name: 'Ada',
      email: 'ada@library.test',
      active: false,
    });

    const readBack = await request(app).get('/internal/members/1').set(withServiceKey);

    expect(readBack.status).toBe(200);
    expect(readBack.body.active).toBe(false);
  });

  it('reactivates a deactivated member', async () => {
    await request(app)
      .patch('/internal/members/1/active')
      .set(withServiceKey)
      .send({ active: false });

    const response = await request(app)
      .patch('/internal/members/1/active')
      .set(withServiceKey)
      .send({ active: true });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: 1,
      name: 'Ada',
      email: 'ada@library.test',
      active: true,
    });
  });

  it('responds 400 and leaves the member unchanged when active is missing', async () => {
    const response = await request(app)
      .patch('/internal/members/1/active')
      .set(withServiceKey)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('active must be a boolean');
    expect(findMemberById(1)?.active).toBe(true);
  });

  it('responds 400 and leaves the member unchanged when active is not a boolean', async () => {
    const asString = await request(app)
      .patch('/internal/members/1/active')
      .set(withServiceKey)
      .send({ active: 'false' });

    expect(asString.status).toBe(400);
    expect(asString.body.error).toBe('active must be a boolean');
    expect(findMemberById(1)?.active).toBe(true);

    const asNumber = await request(app)
      .patch('/internal/members/1/active')
      .set(withServiceKey)
      .send({ active: 0 });

    expect(asNumber.status).toBe(400);
    expect(asNumber.body.error).toBe('active must be a boolean');
    expect(findMemberById(1)?.active).toBe(true);
  });

  it('responds 404 when no member has that id', async () => {
    const response = await request(app)
      .patch('/internal/members/999/active')
      .set(withServiceKey)
      .send({ active: false });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Member not found');
  });

  it('responds 404 when the id is not a number', async () => {
    const response = await request(app)
      .patch('/internal/members/abc/active')
      .set(withServiceKey)
      .send({ active: false });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Member not found');
  });

  it('responds 401 without a valid service key and leaves the member unchanged', async () => {
    const missing = await request(app)
      .patch('/internal/members/1/active')
      .send({ active: false });

    expect(missing.status).toBe(401);
    expect(missing.body.error).toBe('Invalid service key');
    expect(findMemberById(1)?.active).toBe(true);

    const wrong = await request(app)
      .patch('/internal/members/1/active')
      .set('x-service-key', 'not-the-service-key')
      .send({ active: false });

    expect(wrong.status).toBe(401);
    expect(wrong.body.error).toBe('Invalid service key');
    expect(findMemberById(1)?.active).toBe(true);
  });
});
