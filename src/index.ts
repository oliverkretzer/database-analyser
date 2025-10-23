import { Database } from "./database.js";
import { LokiLogger } from "./logger.js";
import { Scheduler } from "./scheduler.js";
import { AnticheatTask } from "./tasks/anticheat-task.js";

class DatabaseAnalyzer {

    private logger: LokiLogger;
    private database: Database;
    private scheduler: Scheduler;

    constructor() {
        this.logger = new LokiLogger();
        this.database = new Database(this.logger);
        this.scheduler = new Scheduler(this.database, this.logger);

        this.scheduler.registerTask(new AnticheatTask());

        this.errorHandling();
        this.logger.info('Database Analyzer started with scheduled tasks.');
        this.logger.info('Registered tasks: ' + this.scheduler.getTasks().map(task => task.name).join(', '));
    }

    public errorHandling(): void {
        // Graceful shutdown
        process.on('SIGINT', () => {
            this.logger.info('Shutting down gracefully...');
            this.scheduler.stopAllTasks();
            this.database.close();
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            this.logger.info('Shutting down gracefully...');
            this.scheduler.stopAllTasks();
            this.database.close();
            process.exit(0);
        });
    }
}

new DatabaseAnalyzer();