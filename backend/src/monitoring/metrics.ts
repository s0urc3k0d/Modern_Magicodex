/**
 * Prometheus Metrics for Magicodex
 * Exposes metrics at /api/metrics endpoint
 */

import { Request, Response, NextFunction } from 'express';

// Simple in-memory metrics store (no external dependency)
// For production, consider using prom-client package

interface MetricValue {
  value: number;
  labels?: Record<string, string>;
  timestamp: number;
}

interface HistogramBucket {
  le: number;
  count: number;
}

interface Histogram {
  buckets: HistogramBucket[];
  sum: number;
  count: number;
}

class MetricsRegistry {
  private counters: Map<string, MetricValue[]> = new Map();
  private gauges: Map<string, MetricValue> = new Map();
  private histograms: Map<string, Map<string, Histogram>> = new Map();
  
  // Default histogram buckets for request duration (in ms)
  private defaultBuckets = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

  // Counter: monotonically increasing value
  incCounter(name: string, labels?: Record<string, string>, value: number = 1): void {
    const key = this.labelsToKey(name, labels);
    const existing = this.counters.get(key) || [];
    existing.push({ value, labels, timestamp: Date.now() });
    this.counters.set(key, existing);
  }

  getCounter(name: string, labels?: Record<string, string>): number {
    const key = this.labelsToKey(name, labels);
    const values = this.counters.get(key) || [];
    return values.reduce((sum, v) => sum + v.value, 0);
  }

  // Gauge: value that can go up or down
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.labelsToKey(name, labels);
    this.gauges.set(key, { value, labels, timestamp: Date.now() });
  }

  getGauge(name: string, labels?: Record<string, string>): number {
    const key = this.labelsToKey(name, labels);
    return this.gauges.get(key)?.value || 0;
  }

  // Histogram: observe values and track distribution
  observeHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const labelKey = JSON.stringify(labels || {});
    
    if (!this.histograms.has(name)) {
      this.histograms.set(name, new Map());
    }
    
    const histMap = this.histograms.get(name)!;
    
    if (!histMap.has(labelKey)) {
      histMap.set(labelKey, {
        buckets: this.defaultBuckets.map(le => ({ le, count: 0 })),
        sum: 0,
        count: 0,
      });
    }
    
    const hist = histMap.get(labelKey)!;
    hist.sum += value;
    hist.count += 1;
    
    for (const bucket of hist.buckets) {
      if (value <= bucket.le) {
        bucket.count += 1;
      }
    }
  }

  private labelsToKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;
    const sortedLabels = Object.keys(labels).sort().map(k => `${k}="${labels[k]}"`).join(',');
    return `${name}{${sortedLabels}}`;
  }

  // Export all metrics in Prometheus format
  toPrometheusFormat(): string {
    const lines: string[] = [];
    
    // Export counters
    const counterNames = new Set<string>();
    for (const key of this.counters.keys()) {
      const name = key.split('{')[0];
      counterNames.add(name);
    }
    
    for (const name of counterNames) {
      lines.push(`# HELP ${name} Counter metric`);
      lines.push(`# TYPE ${name} counter`);
      
      for (const [key, values] of this.counters.entries()) {
        if (key.startsWith(name)) {
          const total = values.reduce((sum, v) => sum + v.value, 0);
          lines.push(`${key} ${total}`);
        }
      }
    }
    
    // Export gauges
    const gaugeNames = new Set<string>();
    for (const key of this.gauges.keys()) {
      const name = key.split('{')[0];
      gaugeNames.add(name);
    }
    
    for (const name of gaugeNames) {
      lines.push(`# HELP ${name} Gauge metric`);
      lines.push(`# TYPE ${name} gauge`);
      
      for (const [key, metric] of this.gauges.entries()) {
        if (key.startsWith(name)) {
          lines.push(`${key} ${metric.value}`);
        }
      }
    }
    
    // Export histograms
    for (const [name, histMap] of this.histograms.entries()) {
      lines.push(`# HELP ${name} Histogram metric`);
      lines.push(`# TYPE ${name} histogram`);
      
      for (const [labelKey, hist] of histMap.entries()) {
        const labels = labelKey === '{}' ? '' : labelKey.slice(1, -1);
        const labelPrefix = labels ? `{${labels},` : '{';
        
        for (const bucket of hist.buckets) {
          lines.push(`${name}_bucket${labelPrefix}le="${bucket.le}"} ${bucket.count}`);
        }
        lines.push(`${name}_bucket${labelPrefix}le="+Inf"} ${hist.count}`);
        lines.push(`${name}_sum${labels ? `{${labels}}` : ''} ${hist.sum}`);
        lines.push(`${name}_count${labels ? `{${labels}}` : ''} ${hist.count}`);
      }
    }
    
    return lines.join('\n');
  }

  // Get metrics as JSON (for internal use)
  toJSON(): object {
    return {
      counters: Object.fromEntries(
        Array.from(this.counters.entries()).map(([k, v]) => [k, v.reduce((s, x) => s + x.value, 0)])
      ),
      gauges: Object.fromEntries(
        Array.from(this.gauges.entries()).map(([k, v]) => [k, v.value])
      ),
      histograms: Object.fromEntries(
        Array.from(this.histograms.entries()).map(([name, histMap]) => [
          name,
          Object.fromEntries(Array.from(histMap.entries()))
        ])
      ),
    };
  }

  // Reset all metrics (useful for testing)
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
}

// Singleton instance
export const metrics = new MetricsRegistry();

// =============================================================================
// Pre-defined metrics
// =============================================================================

export const METRIC_NAMES = {
  // HTTP metrics
  HTTP_REQUESTS_TOTAL: 'http_requests_total',
  HTTP_REQUEST_DURATION_MS: 'http_request_duration_ms',
  HTTP_REQUESTS_IN_FLIGHT: 'http_requests_in_flight',
  
  // Auth metrics
  AUTH_LOGIN_TOTAL: 'auth_login_total',
  AUTH_REGISTER_TOTAL: 'auth_register_total',
  AUTH_REFRESH_TOTAL: 'auth_refresh_total',
  AUTH_FAILURES_TOTAL: 'auth_failures_total',
  
  // Database metrics
  DB_QUERIES_TOTAL: 'db_queries_total',
  DB_QUERY_DURATION_MS: 'db_query_duration_ms',
  
  // Cache metrics
  CACHE_HITS_TOTAL: 'cache_hits_total',
  CACHE_MISSES_TOTAL: 'cache_misses_total',
  
  // Scryfall sync metrics
  SYNC_RUNS_TOTAL: 'sync_runs_total',
  SYNC_CARDS_PROCESSED: 'sync_cards_processed_total',
  SYNC_DURATION_MS: 'sync_duration_ms',
  
  // Business metrics
  COLLECTION_CARDS_ADDED: 'collection_cards_added_total',
  DECKS_CREATED: 'decks_created_total',
  USERS_ACTIVE: 'users_active_gauge',
} as const;

// =============================================================================
// Express middleware for request metrics
// =============================================================================

let inFlightRequests = 0;

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  inFlightRequests++;
  
  metrics.setGauge(METRIC_NAMES.HTTP_REQUESTS_IN_FLIGHT, inFlightRequests);
  
  // On response finish
  res.on('finish', () => {
    inFlightRequests--;
    metrics.setGauge(METRIC_NAMES.HTTP_REQUESTS_IN_FLIGHT, inFlightRequests);
    
    const duration = Date.now() - startTime;
    const labels = {
      method: req.method,
      path: normalizePathForMetrics(req.path),
      status: String(res.statusCode),
    };
    
    metrics.incCounter(METRIC_NAMES.HTTP_REQUESTS_TOTAL, labels);
    metrics.observeHistogram(METRIC_NAMES.HTTP_REQUEST_DURATION_MS, duration, {
      method: req.method,
      path: normalizePathForMetrics(req.path),
    });
  });
  
  next();
}

// Normalize paths to avoid high cardinality (replace IDs with :id)
function normalizePathForMetrics(path: string): string {
  return path
    .replace(/\/[a-f0-9-]{24,}/gi, '/:id')  // MongoDB-style IDs
    .replace(/\/[a-z0-9]{20,}/gi, '/:id')    // CUID
    .replace(/\/\d+/g, '/:id')               // Numeric IDs
    .replace(/\?.*/g, '');                    // Remove query string
}

// =============================================================================
// Metrics endpoint handler
// =============================================================================

export function metricsHandler(req: Request, res: Response): void {
  const format = req.query.format || 'prometheus';
  
  if (format === 'json') {
    res.json(metrics.toJSON());
  } else {
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(metrics.toPrometheusFormat());
  }
}

// =============================================================================
// Helper functions for recording metrics
// =============================================================================

export function recordAuthLogin(success: boolean): void {
  metrics.incCounter(METRIC_NAMES.AUTH_LOGIN_TOTAL, { success: String(success) });
  if (!success) {
    metrics.incCounter(METRIC_NAMES.AUTH_FAILURES_TOTAL, { type: 'login' });
  }
}

export function recordAuthRegister(success: boolean): void {
  metrics.incCounter(METRIC_NAMES.AUTH_REGISTER_TOTAL, { success: String(success) });
}

export function recordCacheAccess(hit: boolean, cache: string): void {
  if (hit) {
    metrics.incCounter(METRIC_NAMES.CACHE_HITS_TOTAL, { cache });
  } else {
    metrics.incCounter(METRIC_NAMES.CACHE_MISSES_TOTAL, { cache });
  }
}

export function recordSyncRun(type: string, success: boolean, cardsProcessed: number, durationMs: number): void {
  metrics.incCounter(METRIC_NAMES.SYNC_RUNS_TOTAL, { type, success: String(success) });
  metrics.incCounter(METRIC_NAMES.SYNC_CARDS_PROCESSED, { type }, cardsProcessed);
  metrics.observeHistogram(METRIC_NAMES.SYNC_DURATION_MS, durationMs, { type });
}

export function recordCollectionAdd(count: number = 1): void {
  metrics.incCounter(METRIC_NAMES.COLLECTION_CARDS_ADDED, {}, count);
}

export function recordDeckCreated(): void {
  metrics.incCounter(METRIC_NAMES.DECKS_CREATED);
}

export function setActiveUsers(count: number): void {
  metrics.setGauge(METRIC_NAMES.USERS_ACTIVE, count);
}
