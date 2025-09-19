import { env } from './environment.js';
import https from 'https';
import http from 'http';

export class LokiLogger {
    private url: string;
    private auth: string;

    constructor() {
        if (!env.LOKI_URL) {
            throw new Error('LOKI_URL is not defined in environment variables');
        }

        if (!env.LOKI_USER || !env.LOKI_PASSWORD) {
            throw new Error('LOKI_USER and LOKI_PASSWORD must be defined in environment variables');
        }

        this.url = env.LOKI_URL;
        this.auth = `Basic ${Buffer.from(`${env.LOKI_USER}:${env.LOKI_PASSWORD}`).toString('base64')}`;
    }

    async log(level: string, message: string, meta: Record<string, unknown> = {}) {
        if (!this.url) return;

        const logEntry = {
            streams: [{
                stream: { service_name: 'cold-database-analyser', level },
                values: [[Date.now() * 1000000 + '', JSON.stringify({ message, ...meta })]]
            }]
        };

        const postData = JSON.stringify(logEntry);
        const url = new URL(this.url);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: '/loki/api/v1/push',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                ...(this.auth && { 'Authorization': this.auth })
            }
        };

        const req = (url.protocol === 'https:' ? https : http).request(options, (res) => {
            if (res.statusCode !== 204) {
                console.error(`Loki log failed: ${res.statusCode}`);
            }
        });

        req.on('error', (e) => {
            console.error(`Loki log error: ${e.message}`);
        });

        console.log(postData);
        req.write(postData);
        req.end();
    }

    info(message: string, meta?: Record<string, unknown>) {
        this.log('info', message, meta);
    }

    error(message: string, meta?: Record<string, unknown>) {
        this.log('error', message, meta);
    }

    warn(message: string, meta?: Record<string, unknown>) {
        this.log('warn', message, meta);
    }
}
