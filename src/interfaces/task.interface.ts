import { Database } from '../database.js';
import { Schedule } from '../enums/schedule.enum.js';
import { LokiLogger } from '../logger.js';

export interface ITask {
    name: string;
    schedule: Schedule;
    delay?: number;
    execute(database: Database, logger: LokiLogger): Promise<void>;
}