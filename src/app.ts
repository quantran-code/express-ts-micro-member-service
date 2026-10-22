import express, {
  ErrorRequestHandler,
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from 'express';
import { HttpError } from './errors/httpError';
import { requireServiceKey } from './middleware/requireServiceKey';
import { resolveRequestId } from './requestId';
import { internalMembersRouter } from './routes/internalMembers';
import { membersRouter } from './routes/members';

const app = express();

app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', service: 'member-service' });
});

// Every route other than /health and the public /members surface requires the internal service key.
const serviceKeyGate: RequestHandler = (req, res, next) => {
  if (req.path === '/health' || req.path === '/members' || req.path.startsWith('/members/')) {
    next();
    return;
  }

  requireServiceKey(req, res, next);
};

app.use(serviceKeyGate);

app.use('/internal', internalMembersRouter);
app.use('/members', membersRouter);

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: 'Not Found', requestId: resolveRequestId(req) });
};

// eslint-disable-next-line no-unused-vars
export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const status = err instanceof HttpError ? err.status : 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error',
    requestId: resolveRequestId(req),
  });
};

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
