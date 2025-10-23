import { Database } from '../database.js';
import { Schedule } from '../enums/schedule.enum.js';
import { ITask } from '../interfaces/task.interface.js';
import { LokiLogger } from '../logger.js';

export class FactionFightTask implements ITask {
    public name: string;
    public schedule: Schedule;
    public delay: number;

    constructor() {
        this.name = 'faction-fight-task';
        this.schedule = Schedule.SERVER_TICK;
        this.delay = 1000 * 30;
    }

    async execute(database: Database, logger: LokiLogger): Promise<void> {
        logger.info(`[${this.name}] Executing faction fight task...`);
    }
}