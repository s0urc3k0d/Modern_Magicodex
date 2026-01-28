/**
 * Lightweight HTTP client for Scryfall with:
 * - User-Agent header (as recommended)
 * - Simple rate limit (delay between requests)
 * - 429 backoff using Retry-After when present
 * - Basic retry with exponential backoff for 5xx
 */

export type HttpOptions = {
  delayMs?: number; // base delay between requests
  maxRetries?: number;
  userAgent?: string;
};

export class ScryfallHttpClient {
  private delayMs: number;
  private maxRetries: number;
  private userAgent: string;

  constructor(opts?: HttpOptions) {
    this.delayMs = opts?.delayMs ?? 150;
    this.maxRetries = opts?.maxRetries ?? 4;
    this.userAgent = opts?.userAgent ?? 'Magicodex/1.0 (contact: admin@magicodex.com)';
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async getJson<T = any>(url: string): Promise<T> {
    let attempt = 0;
    let delay = this.delayMs;
    while (true) {
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': this.userAgent,
            'Accept-Encoding': 'gzip, deflate',
          },
          // keepalive is only for fetch from browser; Node keeps connections alive by default via agent
        });

        if (res.status === 429) {
          const ra = res.headers.get('Retry-After');
          const waitMs = ra ? Math.ceil(parseFloat(ra) * 1000) : Math.min(2000 * (attempt + 1), 10000);
          await this.sleep(waitMs);
          attempt++;
          if (attempt > this.maxRetries) throw new Error(`429 Too Many Requests after ${attempt} attempts`);
          continue;
        }

        if (!res.ok) {
          // 5xx → retry with exponential backoff
          if (res.status >= 500 && attempt < this.maxRetries) {
            await this.sleep(delay);
            delay *= 2;
            attempt++;
            continue;
          }
          const body = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status}: ${res.statusText} ${body}`);
        }

        const data = (await res.json()) as T;
        await this.sleep(this.delayMs);
        return data;
      } catch (err) {
        attempt++;
        if (attempt > this.maxRetries) throw err;
        await this.sleep(delay);
        delay *= 2;
      }
    }
  }
}
