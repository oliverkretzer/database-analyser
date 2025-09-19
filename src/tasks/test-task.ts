import { Database } from '../database.js';
import { Schedule } from '../enums/schedule.enum.js';
import { ITask } from '../interfaces/task.interface.js';
import { LokiLogger } from '../logger.js';

export class TestTask implements ITask {
    public name: string;
    public schedule: Schedule;

    constructor() {
        this.name = 'test-task';
        this.schedule = Schedule.SERVER_TICK;
    }

    async execute(database: Database, logger: LokiLogger): Promise<void> {
        logger.info(`[${this.name}] Executing test task...`);
    }
}