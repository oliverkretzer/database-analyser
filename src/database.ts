import { Db, MongoClient } from 'mongodb';
import { env } from './environment.js';
import { LokiLogger } from './logger.js';

export class Database {
    private logger: LokiLogger;
    public client: MongoClient | undefined;
    public database: Db | undefined;

    constructor(logger: LokiLogger) {
        this.logger = logger;
        this.client = undefined;
        this.database = undefined;
        this.connect();
    }

    public async connect(): Promise<void> {
        if (this.client) return;

        if (!env.MONGODB_URL) {
            throw new Error("MONGODB_URL is not defined in environment variables");
        }

        if (!env.MONGODB_DB_NAME) {
            throw new Error("MONGODB_DB_NAME is not defined in environment variables");
        }

        this.client = new MongoClient(env.MONGODB_URL, {
            maxPoolSize: 20, // Maximum number of connections
            minPoolSize: 1, // Minimum number of connections
            maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
            serverSelectionTimeoutMS: 5000, // How long to try selecting a server
            socketTimeoutMS: 45000, // How long a send or receive on a socket can take
            family: 4, // Use IPv4, skip IPv6
            connectTimeoutMS: 10000, // How long to wait for initial connection
            retryWrites: true, // Retry failed writes
            compressors: ['zlib'], // Enable compression
            zlibCompressionLevel: 6 // Compression level
        });
        
        for (let retries = 0; retries < 3; retries++) {
            try {
                await this.client.connect();
                break;
            } catch (error) {
                this.logger.error(`Attempt ${retries + 1} to connect to the database failed. Retrying in 5 seconds...`, { error });
                if (retries === 2) {
                    throw new Error(`Failed to connect to the database after 3 attempts. Error: ${error}`);
                }
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }
        }

        this.database = this.client.db(env.MONGODB_DB_NAME);
        this.logger.info("Connected to MongoDB");
    }

    public async close(): Promise<void> {
        if (this.client) {
            await this.client.close();
            this.client = undefined;
            this.database = undefined;
            this.logger.info("Disconnected from MongoDB");
        }
    }
}