import { RequestHandler, Router } from 'express';
import { getActiveLoanCount, listActiveMemberLoans } from '../clients/loanClient';
import { HttpError } from '../errors/httpError';
import { RequestUser, requireMemberIdentity } from '../middleware/requireMemberIdentity';
import {
  deleteMember,
  findMemberByEmail,
  findMemberById,
  listMembers,
  updateMember,
  UpdateMemberInput,
} from '../repositories/memberRepository';

export interface MemberIdParams {
  id: string;
}

export interface UpdateMemberBody {
  name?: unknown;
  email?: unknown;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const canActOnMember = (user: RequestUser | undefined, memberId: number): boolean => {
  if (!user) {
    return false;
  }

  if (user.role === 'librarian') {
    return true;
  }

  return user.role === 'member' && user.memberId === memberId;
};

export const listMembersHandler: RequestHandler<Record<string, never>> = (req, res, next) => {
  if (req.user?.role !== 'librarian') {
    next(new HttpError(403, 'Librarian role required'));
    return;
  }

  res.status(200).json(listMembers());
};

export const getMemberHandler: RequestHandler<MemberIdParams> = (req, res, next) => {
  const id = Number(req.params.id);

  if (!canActOnMember(req.user, id)) {
    next(new HttpError(403, 'You may not act on this member'));
    return;
  }

  const member = Number.isInteger(id) ? findMemberById(id) : undefined;

  if (!member) {
    next(new HttpError(404, 'Member not found'));
    return;
  }

  res.status(200).json(member);
};

export const updateMemberHandler: RequestHandler<MemberIdParams, unknown, UpdateMemberBody> = (
  req,
  res,
  next,
) => {
  const id = Number(req.params.id);

  if (!canActOnMember(req.user, id)) {
    next(new HttpError(403, 'You may not act on this member'));
    return;
  }

  if (!Number.isInteger(id) || !findMemberById(id)) {
    next(new HttpError(404, 'Member not found'));
    return;
  }

  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';

  if (email && !EMAIL_PATTERN.test(email)) {
    next(new HttpError(400, 'email must be a valid email address'));
    return;
  }

  if (email) {
    const existing = findMemberByEmail(email);

    if (existing && existing.id !== id) {
      next(new HttpError(409, 'Email already registered'));
      return;
    }
  }

  const input: UpdateMemberInput = {};

  if (name) {
    input.name = name;
  }

  if (email) {
    input.email = email;
  }

  const member = updateMember(id, input);

  if (!member) {
    next(new HttpError(404, 'Member not found'));
    return;
  }

  res.status(200).json(member);
};

export const deleteMemberHandler: RequestHandler<MemberIdParams> = async (req, res, next) => {
  const id = Number(req.params.id);

  if (!canActOnMember(req.user, id)) {
    next(new HttpError(403, 'You may not act on this member'));
    return;
  }

  if (!Number.isInteger(id) || !findMemberById(id)) {
    next(new HttpError(404, 'Member not found'));
    return;
  }

  try {
    const activeCount = await getActiveLoanCount(id);

    if (activeCount > 0) {
      next(new HttpError(409, 'Cannot delete a member with active loans'));
      return;
    }

    deleteMember(id);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const memberLoansHandler: RequestHandler<MemberIdParams> = async (req, res, next) => {
  const id = Number(req.params.id);

  if (!canActOnMember(req.user, id)) {
    next(new HttpError(403, 'You may not act on this member'));
    return;
  }

  // The local record is checked first so an unknown member never reaches loan-service.
  if (!Number.isInteger(id) || !findMemberById(id)) {
    next(new HttpError(404, 'Member not found'));
    return;
  }

  try {
    const loans = await listActiveMemberLoans(id);

    res.status(200).json(loans);
  } catch (error) {
    next(error);
  }
};

export const membersRouter = Router();

// The public /members surface is authenticated by identity headers, not the internal service key.
membersRouter.use(requireMemberIdentity);

membersRouter.get('/', listMembersHandler);
membersRouter.get('/:id', getMemberHandler);
membersRouter.get('/:id/loans', memberLoansHandler);
membersRouter.patch('/:id', updateMemberHandler);
membersRouter.delete('/:id', deleteMemberHandler);
