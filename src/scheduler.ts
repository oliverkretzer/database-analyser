import * as cron from 'node-cron';
import { Database } from './database.js';
import { ITask } from './interfaces/task.interface.js';
import { LokiLogger } from './logger.js';

export class Scheduler {
    private tasks: ITask[] = [];
    private database: Database;
    private logger: LokiLogger;
    private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();

    constructor(database: Database, logger: LokiLogger) {
        this.database = database;
        this.logger = logger;
    }

    public registerTask(task: ITask): void {
        this.tasks.push(task);
        this.scheduleTask(task);
    }

    private scheduleTask(task: ITask): void {
        const job = cron.schedule(task.schedule, async () => {
            try {
                if (task.delay) {
                    this.logger.info(`Delaying task ${task.name} for ${task.delay} ms`);
                    await new Promise(resolve => setTimeout(resolve, task.delay));
                }
                this.logger.info(`Executing scheduled task: ${task.name}`);
                await task.execute(this.database, this.logger);
                this.logger.info(`Task ${task.name} completed successfully.`);
            } catch (error) {
                this.logger.error(`Task ${task.name} failed: ${error}`, { error });
            }
        });

        this.scheduledJobs.set(task.name, job);
        this.logger.info(`Task ${task.name} scheduled with cron expression: ${task.schedule}`);
    }

    public unregisterTask(taskName: string): void {
        const job = this.scheduledJobs.get(taskName);
        if (job) {
            job.destroy();
            this.scheduledJobs.delete(taskName);
            this.tasks = this.tasks.filter(task => task.name !== taskName);
            this.logger.info(`Task ${taskName} unregistered and stopped.`);
        }
    }

    public stopAllTasks(): void {
        for (const [taskName, job] of this.scheduledJobs) {
            job.destroy();
            this.logger.info(`Stopped task: ${taskName}`);
        }
        this.scheduledJobs.clear();
    }

    public getTasks(): ITask[] {
        return this.tasks;
    }

    public getScheduledJobs(): string[] {
        return Array.from(this.scheduledJobs.keys());
    }
}