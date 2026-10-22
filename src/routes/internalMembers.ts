import { RequestHandler, Router } from 'express';
import { HttpError } from '../errors/httpError';
import { createMember, findMemberByEmail, findMemberById } from '../repositories/memberRepository';

export interface CreateMemberBody {
  name?: string;
  email?: string;
}

export interface MemberIdParams {
  id: string;
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

export const internalMembersRouter = Router();

internalMembersRouter.post('/members', createMemberHandler);
internalMembersRouter.get('/members/:id', getMemberHandler);
