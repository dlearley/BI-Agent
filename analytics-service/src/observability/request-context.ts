import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';

export interface RequestContext {
  correlationId: string;
  userId?: string;
  route?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existingCorrelationId = req.headers['x-request-id'];
  const correlationId = Array.isArray(existingCorrelationId)
    ? existingCorrelationId[0]
    : existingCorrelationId || randomUUID();

  res.setHeader('x-request-id', correlationId);

  storage.run({
    correlationId,
    route: req.originalUrl,
  }, () => {
    next();
  });
}

export function setUserContext(userId?: string): void {
  const store = storage.getStore();
  if (store) {
    store.userId = userId;
  }
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}
