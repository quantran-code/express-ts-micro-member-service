import { config } from '../config';
import { HttpError } from '../errors/httpError';

export interface LoanRecord {
  id: number;
  bookId: number;
  memberId: number;
  borrowedAt: string;
  returnedAt: string | null;
  dueDate: string;
}

export interface MemberLoan {
  id: number;
  bookId: number;
  memberId: number;
  borrowedAt: string;
  returnedAt: string | null;
}

interface LoanServiceResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

const LOAN_SERVICE_UNAVAILABLE = 'Loan service unavailable';

function serviceHeaders(): Record<string, string> {
  return { 'x-service-key': config.serviceKey };
}

async function readErrorMessage(response: LoanServiceResponse): Promise<string> {
  try {
    const body: unknown = await response.json();

    if (body && typeof body === 'object' && 'error' in body) {
      const { error } = body as { error?: unknown };

      if (typeof error === 'string' && error) {
        return error;
      }
    }
  } catch {
    // A non-JSON body simply falls through to the generic message below.
  }

  return 'Loan service request failed';
}

async function requestLoanService(path: string): Promise<unknown> {
  let response: LoanServiceResponse;

  try {
    response = await fetch(`${config.loanServiceUrl}${path}`, {
      method: 'GET',
      headers: serviceHeaders(),
    });
  } catch {
    throw new HttpError(502, LOAN_SERVICE_UNAVAILABLE);
  }

  if (!response.ok) {
    throw new HttpError(response.status, await readErrorMessage(response));
  }

  try {
    return (await response.json()) as unknown;
  } catch {
    throw new HttpError(502, LOAN_SERVICE_UNAVAILABLE);
  }
}

function toMemberLoan(loan: LoanRecord): MemberLoan {
  return {
    id: loan.id,
    bookId: loan.bookId,
    memberId: loan.memberId,
    borrowedAt: loan.borrowedAt,
    returnedAt: loan.returnedAt,
  };
}

export async function getActiveLoanCount(memberId: number): Promise<number> {
  const payload = await requestLoanService(`/internal/loans/active-count?memberId=${memberId}`);

  if (!payload || typeof payload !== 'object') {
    throw new HttpError(502, LOAN_SERVICE_UNAVAILABLE);
  }

  const { count } = payload as { count?: unknown };

  if (typeof count !== 'number') {
    throw new HttpError(502, LOAN_SERVICE_UNAVAILABLE);
  }

  return count;
}

export async function listActiveMemberLoans(memberId: number): Promise<MemberLoan[]> {
  const payload = await requestLoanService(
    `/internal/loans?memberId=${memberId}&status=active`,
  );

  if (!Array.isArray(payload)) {
    throw new HttpError(502, LOAN_SERVICE_UNAVAILABLE);
  }

  const records: unknown[] = payload;

  return records.map((record) => toMemberLoan(record as LoanRecord));
}
