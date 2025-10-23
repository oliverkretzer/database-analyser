import { Database } from '../database.js';
import { Schedule } from '../enums/schedule.enum.js';
import { fightHelper } from '../helper/fight-helper.js';
import { PlayerFight } from '../interfaces/anticheat/player-fight.interface.js';
import { ITask } from '../interfaces/task.interface.js';
import { LokiLogger } from '../logger.js';

export class AnticheatTask implements ITask {
    public name: string;
    public schedule: Schedule;

    constructor() {
        this.name = 'anticheat-task';
        this.schedule = Schedule.SERVER_TICK;
    }

    async execute(database: Database, logger: LokiLogger): Promise<void> {
        const db = database.database;
        if (!db) {
            logger.error('Database connection is not established.');
            return;
        }
        const newFights = await db.collection<PlayerFight>('player-fights').find({ analysis: null }).toArray();
        if (newFights.length === 0) {
            logger.info('No new player fights to analyze.');
            return;
        }

        const fightsToSave: PlayerFight[] = [];
        for (const fight of newFights) {
            const analysis = await fightHelper.analyzeFight(fight);
            if (analysis) {
                fight.analysis = analysis;
                fightsToSave.push(fight);
            }
        }

        if (fightsToSave.length > 0) {
            await db.collection<PlayerFight>('player-fights').bulkWrite(
                fightsToSave.map((fight) => ({
                    updateOne: {
                        filter: { _id: fight._id },
                        update: { $set: { analysis: fight.analysis } }
                    }
                }))
            );
        }
        logger.info(`Anticheat analysis completed for ${fightsToSave.length} fights.`);
    }
}