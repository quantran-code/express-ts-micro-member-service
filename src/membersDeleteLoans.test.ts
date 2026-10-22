import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app from './app';
import { config } from './config';
import { createMember, findMemberById, resetMembers } from './repositories/memberRepository';

const asLibrarian = { 'x-user-id': '1', 'x-user-role': 'librarian' };
const asMember = { 'x-user-id': '2', 'x-user-role': 'member', 'x-user-member-id': '1' };
const asOtherMember = { 'x-user-id': '3', 'x-user-role': 'member', 'x-user-member-id': '99' };

interface StubResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

interface StubInit {
  method?: string;
  headers?: Record<string, string>;
}

interface LoanServiceCall {
  url: string;
  headers: Record<string, string>;
}

function jsonResponse(body: unknown, status = 200): StubResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

function stubLoanService(respond: (url: string) => StubResponse): LoanServiceCall[] {
  const calls: LoanServiceCall[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init?: StubInit) => {
      calls.push({ url: input, headers: { ...(init?.headers ?? {}) } });

      return Promise.resolve(respond(input));
    }),
  );

  return calls;
}

function stubLoanServiceFailure(): LoanServiceCall[] {
  const calls: LoanServiceCall[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init?: StubInit) => {
      calls.push({ url: input, headers: { ...(init?.headers ?? {}) } });

      return Promise.reject(new Error('connect ECONNREFUSED'));
    }),
  );

  return calls;
}

describe('DELETE /members/:id', () => {
  beforeEach(() => {
    resetMembers();
    createMember({ name: 'Ada', email: 'ada@library.test' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('responds 204 with an empty body and removes the member when there are no active loans', async () => {
    stubLoanService(() => jsonResponse({ count: 0 }));

    const response = await request(app).delete('/members/1').set(asLibrarian);

    expect(response.status).toBe(204);
    expect(response.text ?? '').toBe('');

    const readBack = await request(app).get('/members/1').set(asLibrarian);

    expect(readBack.status).toBe(404);
    expect(readBack.body.error).toBe('Member not found');
  });

  it('asks loan-service for the member active count with the service key', async () => {
    const calls = stubLoanService(() => jsonResponse({ count: 0 }));

    await request(app).delete('/members/1').set(asLibrarian);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${config.loanServiceUrl}/internal/loans/active-count?memberId=1`);
    expect(calls[0].headers['x-service-key']).toBe(config.serviceKey);
  });

  it('responds 409 and keeps the member when they have active loans', async () => {
    stubLoanService(() => jsonResponse({ count: 2 }));

    const response = await request(app).delete('/members/1').set(asLibrarian);

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('Cannot delete a member with active loans');
    expect(findMemberById(1)).toBeDefined();
  });

  it('responds 403 without calling loan-service when a member deletes another member', async () => {
    const calls = stubLoanService(() => jsonResponse({ count: 0 }));

    const response = await request(app).delete('/members/1').set(asOtherMember);

    expect(response.status).toBe(403);
    expect(calls).toHaveLength(0);
    expect(findMemberById(1)).toBeDefined();
  });

  it('responds 404 for an unknown member', async () => {
    const calls = stubLoanService(() => jsonResponse({ count: 0 }));

    const response = await request(app).delete('/members/999').set(asLibrarian);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Member not found');
    expect(calls).toHaveLength(0);
  });

  it('responds 502 when loan-service is unreachable', async () => {
    stubLoanServiceFailure();

    const response = await request(app).delete('/members/1').set(asLibrarian);

    expect(response.status).toBe(502);
    expect(response.body.error).toBe('Loan service unavailable');
    expect(findMemberById(1)).toBeDefined();
  });
});

describe('GET /members/:id/loans', () => {
  beforeEach(() => {
    resetMembers();
    createMember({ name: 'Ada', email: 'ada@library.test' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('responds 200 with the active loans without any dueDate field', async () => {
    const calls = stubLoanService(() =>
      jsonResponse([
        {
          id: 3,
          bookId: 10,
          memberId: 1,
          borrowedAt: '2024-01-01T00:00:00.000Z',
          returnedAt: null,
          dueDate: '2024-01-15T00:00:00.000Z',
        },
      ]),
    );

    const response = await request(app).get('/members/1/loans').set(asLibrarian);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: 3,
        bookId: 10,
        memberId: 1,
        borrowedAt: '2024-01-01T00:00:00.000Z',
        returnedAt: null,
      },
    ]);
    expect(response.text).not.toContain('dueDate');
    expect(calls[0].url).toBe(`${config.loanServiceUrl}/internal/loans?memberId=1&status=active`);
    expect(calls[0].headers['x-service-key']).toBe(config.serviceKey);
  });

  it('responds 200 for the member asking for their own loans', async () => {
    stubLoanService(() => jsonResponse([]));

    const response = await request(app).get('/members/1/loans').set(asMember);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('responds 404 without calling loan-service for an unknown local member', async () => {
    const calls = stubLoanService(() => jsonResponse([]));

    const response = await request(app).get('/members/999/loans').set(asLibrarian);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Member not found');
    expect(calls).toHaveLength(0);
  });

  it('responds 403 when a member asks for another member loans', async () => {
    const calls = stubLoanService(() => jsonResponse([]));

    const response = await request(app).get('/members/1/loans').set(asOtherMember);

    expect(response.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it('responds 502 when loan-service is unreachable', async () => {
    stubLoanServiceFailure();

    const response = await request(app).get('/members/1/loans').set(asLibrarian);

    expect(response.status).toBe(502);
    expect(response.body.error).toBe('Loan service unavailable');
  });
});
