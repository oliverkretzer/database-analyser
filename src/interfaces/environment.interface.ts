export interface IEnvironment {
    MONGODB_URL: string;
    MONGODB_DB_NAME: string;
    LOKI_URL: string;
    LOKI_USER: string;
    LOKI_PASSWORD: string;
    // Optional Discord logging configuration
    DISCORD_API_BASE?: string;
    DISCORD_API_KEY?: string;
}