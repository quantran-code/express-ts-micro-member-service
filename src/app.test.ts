import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from './app';
import { config } from './config';
import { listMembers, resetMembers } from './repositories/memberRepository';

const withServiceKey = { 'x-service-key': config.serviceKey };

describe('member-service app', () => {
  beforeEach(() => {
    resetMembers();
  });

  describe('GET /health', () => {
    it('responds 200 without an x-service-key header', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok', service: 'member-service' });
    });
  });

  describe('service key gate', () => {
    it('responds 401 when the x-service-key header is missing', async () => {
      const response = await request(app)
        .post('/internal/members')
        .send({ name: 'Ada', email: 'ada@library.test' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid service key');
      expect(listMembers()).toHaveLength(0);
    });

    it('responds 401 when the x-service-key header does not match', async () => {
      const response = await request(app)
        .post('/internal/members')
        .set('x-service-key', 'not-the-service-key')
        .send({ name: 'Ada', email: 'ada@library.test' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid service key');
      expect(listMembers()).toHaveLength(0);
    });

    it('responds 401 for an unknown path without a key and 404 with one', async () => {
      const withoutKey = await request(app).get('/does-not-exist');

      expect(withoutKey.status).toBe(401);

      const withKey = await request(app).get('/does-not-exist').set(withServiceKey);

      expect(withKey.status).toBe(404);
      expect(withKey.body).toEqual({ error: 'Not Found' });
    });
  });

  describe('POST /internal/members', () => {
    it('creates the member and returns the lowercased email', async () => {
      const response = await request(app)
        .post('/internal/members')
        .set(withServiceKey)
        .send({ name: '  Ada  ', email: 'Ada@Library.test' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        id: 1,
        name: 'Ada',
        email: 'ada@library.test',
        active: true,
      });
      expect(listMembers()).toHaveLength(1);
    });

    it('defaults the new member to active', async () => {
      const response = await request(app)
        .post('/internal/members')
        .set(withServiceKey)
        .send({ name: 'Ada', email: 'ada@library.test' });

      expect(response.status).toBe(201);
      expect(response.body.active).toBe(true);

      const [stored] = listMembers();

      expect(stored.active).toBe(true);
    });

    it('keeps incrementing ids by one from 1', async () => {
      const first = await request(app)
        .post('/internal/members')
        .set(withServiceKey)
        .send({ name: 'Ada', email: 'ada@library.test' });

      const second = await request(app)
        .post('/internal/members')
        .set(withServiceKey)
        .send({ name: 'Grace', email: 'grace@library.test' });

      expect(first.status).toBe(201);
      expect(first.body.id).toBe(1);
      expect(second.status).toBe(201);
      expect(second.body.id).toBe(2);
    });

    it('restarts ids at 1 after a reset', async () => {
      await request(app)
        .post('/internal/members')
        .set(withServiceKey)
        .send({ name: 'Ada', email: 'ada@library.test' });

      resetMembers();

      const response = await request(app)
        .post('/internal/members')
        .set(withServiceKey)
        .send({ name: 'Grace', email: 'grace@library.test' });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe(1);
    });

    it('responds 400 when the name is missing', async () => {
      const response = await request(app)
        .post('/internal/members')
        .set(withServiceKey)
        .send({ email: 'ada@library.test' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('name is required');
      expect(listMembers()).toHaveLength(0);
    });

    it('responds 400 when the name is blank', async () => {
      const response = await request(app)
        .post('/internal/members')
        .set(withServiceKey)
        .send({ name: '   ', email: 'ada@library.test' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('name is required');
      expect(listMembers()).toHaveLength(0);
    });

    it('responds 400 when the email is missing', async () => {
      const response = await request(app)
        .post('/internal/members')
        .set(withServiceKey)
        .send({ name: 'Ada' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('email must be a valid email address');
      expect(listMembers()).toHaveLength(0);
    });

    it('responds 400 when the email is not a valid address', async () => {
      const response = await request(app)
        .post('/internal/members')
        .set(withServiceKey)
        .send({ name: 'Ada', email: 'not-an-email' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('email must be a valid email address');
      expect(listMembers()).toHaveLength(0);
    });

    it('responds 409 when the email is already registered in a different case', async () => {
      const first = await request(app)
        .post('/internal/members')
        .set(withServiceKey)
        .send({ name: 'Ada', email: 'ada@library.test' });

      expect(first.status).toBe(201);

      const duplicate = await request(app)
        .post('/internal/members')
        .set(withServiceKey)
        .send({ name: 'Ada Again', email: 'ADA@Library.test' });

      expect(duplicate.status).toBe(409);
      expect(duplicate.body.error).toBe('Email already registered');
      expect(listMembers()).toHaveLength(1);
    });
  });
});
