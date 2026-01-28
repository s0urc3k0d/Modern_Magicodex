/**
 * Health check endpoint with detailed status
 */

import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { redisCache } from '../cache';
import { logger } from '../utils/logger';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: ComponentHealth;
    cache: ComponentHealth;
  };
}

export interface ComponentHealth {
  status: 'up' | 'down' | 'degraded';
  latencyMs?: number;
  message?: string;
}

const startTime = Date.now();

async function checkDatabase(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'up',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
    return {
      status: 'down',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkCache(): Promise<ComponentHealth> {
  const start = Date.now();
  
  if (!redisCache.isAvailable()) {
    return {
      status: 'down',
      message: 'Redis not connected',
    };
  }
  
  try {
    // Try to ping Redis
    await redisCache.set('health_check', Date.now(), 10);
    const value = await redisCache.get<number>('health_check');
    
    if (value) {
      return {
        status: 'up',
        latencyMs: Date.now() - start,
      };
    } else {
      return {
        status: 'degraded',
        latencyMs: Date.now() - start,
        message: 'Cache read/write test failed',
      };
    }
  } catch (error) {
    return {
      status: 'down',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function healthHandler(req: Request, res: Response): Promise<void> {
  const [dbHealth, cacheHealth] = await Promise.all([
    checkDatabase(),
    checkCache(),
  ]);
  
  // Determine overall status
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  if (dbHealth.status === 'down') {
    overallStatus = 'unhealthy';
  } else if (dbHealth.status === 'degraded' || cacheHealth.status === 'down') {
    overallStatus = 'degraded';
  }
  
  const health: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks: {
      database: dbHealth,
      cache: cacheHealth,
    },
  };
  
  // Set appropriate status code
  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;
  
  res.status(statusCode).json(health);
}

// Simple liveness probe (just returns 200 if process is running)
export function livenessHandler(req: Request, res: Response): void {
  res.status(200).json({ status: 'alive' });
}

// Readiness probe (checks if app can serve traffic)
export async function readinessHandler(req: Request, res: Response): Promise<void> {
  try {
    // Quick database check
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not ready', message: 'Database unavailable' });
  }
}
