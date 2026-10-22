import type { RequestUser } from '../middleware/requireMemberIdentity';

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}
