import { Request } from 'express';
import { randomUUID } from 'node:crypto';

export function resolveRequestId(req: Request): string {
  const provided = req.header('x-request-id');

  if (provided && provided.trim()) {
    return provided;
  }

  return randomUUID();
}
