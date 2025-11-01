import { env } from './environment.js';
import https from 'https';
import http from 'http';

interface PostOptions {
    timeout?: number;
}

export class DiscordLogger {
    private apiBase?: string;
    private apiKey?: string;
    private enabled: boolean;
    private healthy: boolean = false;
    private readonly retryAttempts: number = 3;
    private readonly requestTimeout: number = 3000;

    constructor() {
        this.apiBase = env.DISCORD_API_BASE;
        this.apiKey = env.DISCORD_API_KEY;
        this.enabled = !!(this.apiBase && this.apiKey);

        if (!this.enabled) {
            console.warn('[DiscordLogger] DISCORD_API_BASE or DISCORD_API_KEY not set. Discord logging disabled.');
        }
    }

    public async init(): Promise<void> {
        if (!this.enabled) return;
        try {
            await this.performHealthCheck();
            this.healthy = true;
            console.info('[DiscordLogger] Health check passed.');
        } catch (err) {
            this.healthy = false;
            console.warn('[DiscordLogger] Health check failed:', (err as Error).message);
        }
    }

    public isHealthy(): boolean {
        return this.enabled && this.healthy;
    }

    public async sendEvent(eventType: string, eventData: unknown): Promise<void> {
        if (!this.isHealthy()) return;
        const payload = {
            source: 'fivem',
            event_type: eventType,
            data: eventData
        };
        try {
            await this.postWithRetry('/api/events', payload, this.retryAttempts);
        } catch (error) {
            console.error('[DiscordLogger] Failed to send event:', error);
        }
    }

    private async performHealthCheck(): Promise<void> {
        if (!this.apiBase) throw new Error('API base not configured');
        const { protocol, hostname, port, pathname } = new URL(this.apiBase.replace(/\/+$/, '') + '/health');
        const useHttps = protocol === 'https:';

        await new Promise<void>((resolve, reject) => {
            const options: http.RequestOptions = {
                hostname,
                port: port || (useHttps ? 443 : 80),
                path: pathname,
                method: 'GET',
                headers: {
                    'Authorization': this.apiKey ? `Bearer ${this.apiKey}` : undefined
                }
            };

            const req = (useHttps ? https : http).request(options, (res) => {
                // Expect 200
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    resolve();
                } else {
                    reject(new Error(`Health endpoint returned ${res.statusCode}`));
                }
                res.resume();
            });

            req.setTimeout(this.requestTimeout, () => {
                req.destroy(new Error('Health check timeout'));
            });

            req.on('error', (err) => reject(err));
            req.end();
        });
    }

    private async postWithRetry(path: string, body: unknown, attemptsLeft: number): Promise<void> {
        try {
            await this.post(path, body, { timeout: this.requestTimeout });
        } catch (err) {
            const retryable = this.isRetryableError(err);
            const isLast = attemptsLeft <= 1;

            if (!retryable || isLast) {
                throw err instanceof Error ? err : new Error(String(err));
            }

            const attempt = this.retryAttempts - attemptsLeft + 1;
            const baseDelay = Math.min(Math.pow(2, attempt) * 1000, 30000);
            const jitter = Math.random() * 1000;
            const delay = Math.min(baseDelay + jitter, 30000);
            await new Promise((r) => setTimeout(r, delay));
            return this.postWithRetry(path, body, attemptsLeft - 1);
        }
    }

    private isRetryableError(error: unknown): boolean {
        if (error instanceof Error) {
            const msg = error.message.toLowerCase();
            return (
                msg.includes('timeout') ||
                msg.includes('econnaborted') ||
                msg.includes('enotfound') ||
                msg.includes('econnrefused') ||
                msg.includes('reset') ||
                msg.includes('socket')
            );
        }
        return false;
    }

    private async post(path: string, body: unknown, options: PostOptions = {}): Promise<void> {
        if (!this.apiBase) throw new Error('API base not configured');

        const base = this.apiBase.replace(/\/+$/, '');
        const url = new URL(base + path);
        const useHttps = url.protocol === 'https:';
        const postData = JSON.stringify(body);

        await new Promise<void>((resolve, reject) => {
            const req = (useHttps ? https : http).request({
                hostname: url.hostname,
                port: url.port || (useHttps ? 443 : 80),
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                    ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {})
                },
                agent: useHttps ? new https.Agent({ keepAlive: true, keepAliveMsecs: 1000, maxSockets: 10 }) : new http.Agent({ keepAlive: true, keepAliveMsecs: 1000, maxSockets: 10 })
            }, (res) => {
                const status = res.statusCode || 0;
                const chunks: Buffer[] = [];
                res.on('data', (d) => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
                res.on('end', () => {
                    const bodyStr = Buffer.concat(chunks).toString('utf8');
                    if (status >= 200 && status < 300) {
                        resolve();
                    } else if (status >= 500) {
                        reject(new Error(`Server error ${status}: ${bodyStr.slice(0, 500)}`));
                    } else {
                        reject(new Error(`Unexpected status ${status}: ${bodyStr.slice(0, 500)}`));
                    }
                });
            });

            const timeout = options.timeout ?? this.requestTimeout;
            req.setTimeout(timeout, () => req.destroy(new Error('Request timeout')));
            req.on('error', (err) => reject(err));

            req.write(postData);
            req.end();
        });
    }
}

export const discordLogger = new DiscordLogger();
