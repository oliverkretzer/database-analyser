import { Database } from '../database.js';
import { discordLogger } from '../discord-logger.js';
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

                if (
                    fight.analysis.hitRate > 0.35 || 
                    fight.analysis.serverHitRate > 0.4 || 
                    fight.analysis.distFlag > 60 || 
                    fight.analysis.angleFlag > 60 ||
                    fight.analysis.boneCenterDistanceFlag > 60
                ) {
                    await discordLogger.sendEvent('anticheat_fight_detection', {
                        fightId: fight._id.toString(),
                        accountId: fight.accountId,
                        hitRate: fight.analysis.hitRate,
                        serverHitRate: fight.analysis.serverHitRate,
                        totalHits: fight.analysis.hitCount,
                        totalShots: fight.analysis.shotCount,
                        shouldHitButDidNot: fight.analysis.shouldHitButDidNot,
                        aimingOnTargetHitCount: fight.analysis.aimingOnTargetHitCount
                    });
                }
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
            await discordLogger.sendEvent('anticheat_fight_analysis_completed', {
                analyzedFights: fightsToSave.length
            });
        }
        logger.info(`Anticheat analysis completed for ${fightsToSave.length} fights.`);
    }
}