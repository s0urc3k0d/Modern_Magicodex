/**
 * Structured Logger using Pino
 * Provides JSON logging in production and pretty printing in development
 */

import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import type { Request, Response, NextFunction } from 'express';

// Determine log level from environment
const getLogLevel = (): string => {
  const level = process.env.LOG_LEVEL?.toLowerCase();
  if (level && ['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(level)) {
    return level;
  }
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
};

// Create the base logger
const baseOptions: pino.LoggerOptions = {
  level: getLogLevel(),
  formatters: {
    level: (label) => ({ level: label }),
    bindings: () => ({}), // Remove pid and hostname for cleaner logs
  },
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
};

// Pretty print in development
const transport = process.env.NODE_ENV !== 'production'
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    }
  : undefined;

export const logger = pino({
  ...baseOptions,
  transport,
});

// Child logger with request context
export interface RequestContext {
  reqId: string;
  userId?: string;
  method?: string;
  path?: string;
}

export function createRequestLogger(context: RequestContext) {
  return logger.child(context);
}

// Express middleware to attach request ID and logger
export interface LoggedRequest extends Request {
  reqId: string;
  log: pino.Logger;
}

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const reqId = (req.headers['x-request-id'] as string) || uuidv4();
  const loggedReq = req as LoggedRequest;
  
  loggedReq.reqId = reqId;
  loggedReq.log = logger.child({
    reqId,
    method: req.method,
    path: req.path,
  });

  // Set response header
  res.setHeader('X-Request-ID', reqId);

  // Log request start
  loggedReq.log.info({ query: req.query }, 'Request started');

  // Log response on finish
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      statusCode: res.statusCode,
      durationMs: duration,
    };

    if (res.statusCode >= 500) {
      loggedReq.log.error(logData, 'Request completed with error');
    } else if (res.statusCode >= 400) {
      loggedReq.log.warn(logData, 'Request completed with client error');
    } else {
      loggedReq.log.info(logData, 'Request completed');
    }
  });

  next();
}

// Specific loggers for different modules
export const dbLogger = logger.child({ module: 'database' });
export const cacheLogger = logger.child({ module: 'cache' });
export const scryfallLogger = logger.child({ module: 'scryfall' });
export const authLogger = logger.child({ module: 'auth' });
export const syncLogger = logger.child({ module: 'sync' });

// Performance logging helper
export function logPerformance(
  log: pino.Logger,
  operation: string,
  startTime: number,
  metadata?: Record<string, unknown>
) {
  const duration = Date.now() - startTime;
  log.info({ operation, durationMs: duration, ...metadata }, `${operation} completed`);
}

export default logger;
