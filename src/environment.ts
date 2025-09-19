import dotenv from 'dotenv';
import { IEnvironment } from './interfaces/environment.interface.js';

const parsedEnv = dotenv.config().parsed;
if (!parsedEnv) {
    throw new Error('Failed to load .env file');
}

export const env: IEnvironment = {
    MONGODB_URL: parsedEnv.MONGODB_URL,
    MONGODB_DB_NAME: parsedEnv.MONGODB_DB_NAME,
    LOKI_URL: parsedEnv.LOKI_URL,
    LOKI_USER: parsedEnv.LOKI_USER,
    LOKI_PASSWORD: parsedEnv.LOKI_PASSWORD
};