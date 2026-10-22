import { RequestHandler } from 'express';
import { HttpError } from '../errors/httpError';

export interface RequestUser {
  id: number;
  role: string;
  memberId: number | null;
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export const requireMemberIdentity: RequestHandler = (req, res, next) => {
  const userId = parsePositiveInteger(req.header('x-user-id'));
  const role = (req.header('x-user-role') ?? '').trim();

  if (userId === undefined || !role) {
    next(new HttpError(401, 'Invalid user identity'));
    return;
  }

  const memberId = parsePositiveInteger(req.header('x-user-member-id'));

  if (role === 'member' && memberId === undefined) {
    next(new HttpError(401, 'Invalid user identity'));
    return;
  }

  req.user = { id: userId, role, memberId: memberId ?? null };

  next();
};
