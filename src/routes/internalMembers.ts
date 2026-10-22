import { RequestHandler, Router } from 'express';
import { HttpError } from '../errors/httpError';
import {
  createMember,
  findMemberByEmail,
  findMemberById,
  listMembers,
  setMemberActive,
} from '../repositories/memberRepository';

export interface CreateMemberBody {
  name?: string;
  email?: string;
}

export interface MemberIdParams {
  id: string;
}

export interface SetMemberActiveBody {
  active?: unknown;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const createMemberHandler: RequestHandler<Record<string, never>, unknown, CreateMemberBody> = (
  req,
  res,
  next,
) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';

  if (!name) {
    next(new HttpError(400, 'name is required'));
    return;
  }

  if (!email || !EMAIL_PATTERN.test(email)) {
    next(new HttpError(400, 'email must be a valid email address'));
    return;
  }

  if (findMemberByEmail(email)) {
    next(new HttpError(409, 'Email already registered'));
    return;
  }

  const member = createMember({ name, email });

  res.status(201).json(member);
};

export const getMemberHandler: RequestHandler<MemberIdParams> = (req, res, next) => {
  const id = Number(req.params.id);

  const member = Number.isInteger(id) ? findMemberById(id) : undefined;

  if (!member) {
    next(new HttpError(404, 'Member not found'));
    return;
  }

  res.status(200).json(member);
};

export const listMembersHandler: RequestHandler<Record<string, never>> = (req, res) => {
  res.status(200).json(listMembers());
};

export const setMemberActiveHandler: RequestHandler<
  MemberIdParams,
  unknown,
  SetMemberActiveBody
> = (req, res, next) => {
  const id = Number(req.params.id);

  // A malformed id is treated as an absent member.
  if (!Number.isInteger(id) || id <= 0 || !findMemberById(id)) {
    next(new HttpError(404, 'Member not found'));
    return;
  }

  const active: unknown = req.body?.active;

  if (typeof active !== 'boolean') {
    next(new HttpError(400, 'active must be a boolean'));
    return;
  }

  const member = setMemberActive(id, active);

  if (!member) {
    next(new HttpError(404, 'Member not found'));
    return;
  }

  res.status(200).json(member);
};

export const internalMembersRouter = Router();

internalMembersRouter.post('/members', createMemberHandler);
internalMembersRouter.get('/members', listMembersHandler);
internalMembersRouter.get('/members/:id', getMemberHandler);
internalMembersRouter.patch('/members/:id/active', setMemberActiveHandler);
