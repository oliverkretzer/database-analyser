import { ObjectId } from 'mongodb';
import { Database } from '../database.js';
import { Schedule } from '../enums/schedule.enum.js';
import { PlayerFight } from '../interfaces/anticheat/player-fight.interface.js';
import FactionFight from '../interfaces/faction-fight/faction-fight.interface.js';
import SimpleAccount from '../interfaces/faction-fight/simple-account.interface.js';
import { ITask } from '../interfaces/task.interface.js';
import { LokiLogger } from '../logger.js';

export class FactionFightTask implements ITask {
    public name: string;
    public schedule: Schedule;
    public delay: number;

    constructor() {
        this.name = 'faction-fight-task';
        this.schedule = Schedule.HALF_HOURLY;
        this.delay = 1000 * 30;
    }

    async execute(database: Database, logger: LokiLogger): Promise<void> {
        const db = database.database;
        if (!db) {
            logger.error('Database connection is not established.');
            return;
        }

        const analyzedFights: PlayerFight[] = await db.collection<PlayerFight>('player-fights').find({
            analysis: { $ne: null },
            factionFightId: { $exists: false },
            $or: [
                { factionAssignmentAttempts: { $lt: 2 } },
                { factionAssignmentAttempts: { $exists: false } }
            ]
        }).toArray();
        if (analyzedFights.length === 0) {
            logger.info('No analyzed player fights to assign to faction fights.');
            return;
        }

        const getFactionIdForAccount = async (accountId: string): Promise<string | null> => {
            const account = await db.collection<SimpleAccount>('accounts').findOne({ accountId });
            return account ? account.factionId : null;
        }

        const fightsToSave: PlayerFight[] = [];
        const potentialFactionFights: Map<string, PlayerFight[]> = new Map();
        for (const fight of analyzedFights) {
            const factionId = await getFactionIdForAccount(fight.accountId);
            if (!factionId) {
                fight.factionAssignmentAttempts = 2;
                fightsToSave.push(fight);
                continue;
            }

            if (!potentialFactionFights.has(factionId)) {
                potentialFactionFights.set(factionId, []);
            }
            potentialFactionFights.get(factionId)!.push(fight);
        }

        for (const [factionId, fights] of potentialFactionFights.entries()) {
            fights.sort((a, b) => a.created.getTime() - b.created.getTime());
            const groupedFights: PlayerFight[][] = [];
            let currentGroup: PlayerFight[] = [];
            for (const fight of fights) {
                if (currentGroup.length === 0) {
                    currentGroup.push(fight);
                } else {
                    const lastFight = currentGroup[currentGroup.length - 1];
                    const timeDiff = fight.created.getTime() - lastFight.created.getTime();
                    if (timeDiff <= 7 * 60 * 1000) { 
                        currentGroup.push(fight);
                    } else {
                        groupedFights.push(currentGroup);
                        currentGroup = [fight];
                    }
                }
            }

            if (currentGroup.length > 0) {
                groupedFights.push(currentGroup);
            }

            for (const group of groupedFights) {
                if (group.length >= 4) {
                    const memberAccountIds = Array.from(new Set(group.map(f => f.accountId)));
                    const factionFight: FactionFight = {
                        _id: new ObjectId(),
                        factionId: factionId,
                        fightIds: group.map(f => f._id),
                        memberAccountIds: memberAccountIds,
                        startTime: new Date(Math.min(...group.map(f => f.created.getTime()))),
                        endTime: new Date(Math.max(...group.map(f => f.created.getTime()))),
                        created: new Date()
                    };

                    const insertResult = await db.collection<FactionFight>('faction-fights').insertOne(factionFight);
                    for (const f of group) {
                        const newAttempts = (typeof f.factionAssignmentAttempts === 'number') ? f.factionAssignmentAttempts + 1 : 1;
                        fightsToSave.push({
                            ...f,
                            factionAssignmentAttempts: newAttempts,
                            factionFightId: insertResult.insertedId as unknown as import('mongodb').ObjectId
                        });
                    }
                }
            }
        }

        if (fightsToSave.length > 0) {
            await db.collection<PlayerFight>('player-fights').bulkWrite(
                fightsToSave.map((fight) => ({
                    updateOne: {
                        filter: { _id: fight._id },
                        update: {
                            $set: {
                                factionAssignmentAttempts: fight.factionAssignmentAttempts,
                                factionFightId: fight.factionFightId
                            }
                        }
                    }
                }))
            );
        }

        logger.info(`Faction fight assignment completed for ${fightsToSave.length} fights.`);
    }
}