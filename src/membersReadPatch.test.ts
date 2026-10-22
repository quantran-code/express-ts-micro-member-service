import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from './app';
import { createMember, resetMembers } from './repositories/memberRepository';

const asLibrarian = { 'x-user-id': '1', 'x-user-role': 'librarian' };
const asMember = { 'x-user-id': '2', 'x-user-role': 'member', 'x-user-member-id': '1' };
const asOtherMember = { 'x-user-id': '3', 'x-user-role': 'member', 'x-user-member-id': '99' };

describe('GET /members', () => {
  beforeEach(() => {
    resetMembers();
  });

  it('responds 200 with every member for a librarian', async () => {
    createMember({ name: 'Ada', email: 'Ada@Library.test' });
    createMember({ name: 'Grace', email: 'grace@library.test' });

    const response = await request(app).get('/members').set(asLibrarian);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: 1, name: 'Ada', email: 'ada@library.test' },
      { id: 2, name: 'Grace', email: 'grace@library.test' },
    ]);
  });

  it('responds 403 for a member', async () => {
    createMember({ name: 'Ada', email: 'ada@library.test' });

    const response = await request(app).get('/members').set(asMember);

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Librarian role required');
  });
});

describe('GET /members/:id', () => {
  beforeEach(() => {
    resetMembers();
  });

  it('responds 200 for a librarian', async () => {
    createMember({ name: 'Ada', email: 'Ada@Library.test' });

    const response = await request(app).get('/members/1').set(asLibrarian);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 1, name: 'Ada', email: 'ada@library.test' });
  });

  it('responds 200 for the member whose own id matches', async () => {
    createMember({ name: 'Ada', email: 'ada@library.test' });

    const response = await request(app).get('/members/1').set(asMember);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 1, name: 'Ada', email: 'ada@library.test' });
  });

  it('responds 403 when a member requests another member', async () => {
    createMember({ name: 'Ada', email: 'ada@library.test' });

    const response = await request(app).get('/members/1').set(asOtherMember);

    expect(response.status).toBe(403);
  });

  it('responds 404 for an unknown id', async () => {
    const response = await request(app).get('/members/999').set(asLibrarian);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Member not found');
  });

  it('responds 404 when the id is not a number', async () => {
    const response = await request(app).get('/members/abc').set(asLibrarian);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Member not found');
  });
});

describe('PATCH /members/:id', () => {
  beforeEach(() => {
    resetMembers();
  });

  it('updates the name and a later GET shows it', async () => {
    createMember({ name: 'Ada', email: 'ada@library.test' });

    const response = await request(app)
      .patch('/members/1')
      .set(asLibrarian)
      .send({ name: '  Ada Lovelace  ' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 1, name: 'Ada Lovelace', email: 'ada@library.test' });

    const readBack = await request(app).get('/members/1').set(asLibrarian);

    expect(readBack.status).toBe(200);
    expect(readBack.body.name).toBe('Ada Lovelace');
  });

  it('responds 409 when the email belongs to a different member in another case', async () => {
    createMember({ name: 'Ada', email: 'ada@library.test' });
    createMember({ name: 'Grace', email: 'grace@library.test' });

    const response = await request(app)
      .patch('/members/2')
      .set(asLibrarian)
      .send({ email: 'ADA@Library.test' });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('Email already registered');

    const readBack = await request(app).get('/members/2').set(asLibrarian);

    expect(readBack.body.email).toBe('grace@library.test');
  });

  it('responds 200 with the lowercased email when the member keeps their own email', async () => {
    createMember({ name: 'Ada', email: 'ada@library.test' });

    const response = await request(app)
      .patch('/members/1')
      .set(asMember)
      .send({ email: 'ADA@Library.test' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 1, name: 'Ada', email: 'ada@library.test' });
  });

  it('responds 400 when the email is not a valid address', async () => {
    createMember({ name: 'Ada', email: 'ada@library.test' });

    const response = await request(app)
      .patch('/members/1')
      .set(asLibrarian)
      .send({ email: 'not-an-email' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('email must be a valid email address');

    const readBack = await request(app).get('/members/1').set(asLibrarian);

    expect(readBack.body.email).toBe('ada@library.test');
  });

  it('responds 200 and leaves the member unchanged for an empty body', async () => {
    createMember({ name: 'Ada', email: 'ada@library.test' });

    const response = await request(app).patch('/members/1').set(asLibrarian).send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 1, name: 'Ada', email: 'ada@library.test' });
  });

  it('responds 200 and leaves the member unchanged for unknown fields', async () => {
    createMember({ name: 'Ada', email: 'ada@library.test' });

    const response = await request(app)
      .patch('/members/1')
      .set(asLibrarian)
      .send({ role: 'librarian', name: '   ' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 1, name: 'Ada', email: 'ada@library.test' });
  });

  it('responds 403 when a member patches another member', async () => {
    createMember({ name: 'Ada', email: 'ada@library.test' });

    const response = await request(app)
      .patch('/members/1')
      .set(asOtherMember)
      .send({ name: 'Hacked' });

    expect(response.status).toBe(403);
  });

  it('responds 404 for an unknown id', async () => {
    const response = await request(app)
      .patch('/members/999')
      .set(asLibrarian)
      .send({ name: 'Ada' });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Member not found');
  });
});
