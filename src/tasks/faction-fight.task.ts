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
        this.schedule = Schedule.SERVER_TICK;
        this.delay = 1000 * 45;
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
        }).limit(1000).toArray();
        if (analyzedFights.length === 0) {
            logger.info('No analyzed player fights to assign to faction fights.');
            return;
        }

        logger.info(`Processing ${analyzedFights.length} analyzed player fights for faction fight assignment.`);

        // Cache für Fraktions-Lookups
        const factionCache: Map<string, string | null> = new Map();
        const getFactionIdForAccount = async (accountId: string): Promise<string | null> => {
            if (factionCache.has(accountId)) {
                return factionCache.get(accountId)!;
            }
            const account = await db.collection<SimpleAccount>('accounts').findOne({ _id: new ObjectId(accountId) });
            const factionId = account ? account.factionId : null;
            factionCache.set(accountId, factionId);
            return factionId;
        }

        const fightsToSave: PlayerFight[] = [];
        const potentialFactionFights: Map<string, PlayerFight[]> = new Map();
        for (const fight of analyzedFights) {
            const factionId = await getFactionIdForAccount(fight.accountId);
            if (!factionId) {
                // Erhöhe die Anzahl der Versuche statt sie auf 2 zu setzen
                fight.factionAssignmentAttempts = (fight.factionAssignmentAttempts ?? 0) + 1;
                fightsToSave.push(fight);
                continue;
            }

            if (!potentialFactionFights.has(factionId)) {
                potentialFactionFights.set(factionId, []);
            }
            potentialFactionFights.get(factionId)!.push(fight);
        }

        // Lade die letzten 5 Faction Fights pro Fraktion für zeitliche Überlappungsprüfung
        const factionIds = Array.from(potentialFactionFights.keys());
        const existingFactionFightsMap: Map<string, FactionFight[]> = new Map();
        
        for (const factionId of factionIds) {
            const recentFights = await db.collection<FactionFight>('faction-fights')
                .find({ factionId: factionId })
                .sort({ endTime: -1 })
                .limit(5)
                .toArray();
            existingFactionFightsMap.set(factionId, recentFights);
        }

        // Hilfsfunktion: Prüft ob zwei Zeiträume überlappen (mit 7 Minuten Toleranz)
        const timeRangesOverlap = (start1: Date, end1: Date, start2: Date, end2: Date): boolean => {
            const tolerance = 7 * 60 * 1000; // 7 Minuten
            return start1.getTime() - tolerance <= end2.getTime() && 
                   end1.getTime() + tolerance >= start2.getTime();
        };

        const factionFightsToUpdate: Map<string, FactionFight> = new Map();

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

            if (currentGroup.length > 0) groupedFights.push(currentGroup);
            
            const existingFights = existingFactionFightsMap.get(factionId) || [];
            
            for (const group of groupedFights) {
                if (group.length >= 4) {
                    const groupStartTime = new Date(Math.min(...group.map(f => f.created.getTime())));
                    const groupEndTime = new Date(Math.max(...group.map(f => f.lastUpdate.getTime())));
                    
                    // Prüfe ob es einen existierenden Faction Fight gibt, der zeitlich überlappt
                    let matchingFactionFight = existingFights.find(ff => 
                        timeRangesOverlap(groupStartTime, groupEndTime, ff.startTime, ff.endTime)
                    );
                    
                    if (matchingFactionFight) {
                        // Füge Fights zu existierendem Faction Fight hinzu
                        const existingFightIds = new Set(matchingFactionFight.fightIds);
                        const existingMemberIds = new Set(matchingFactionFight.memberAccountIds);
                        
                        for (const f of group) {
                            if (!existingFightIds.has(f._id.toString())) {
                                existingFightIds.add(f._id.toString());
                            }
                            if (!existingMemberIds.has(f.accountId)) {
                                existingMemberIds.add(f.accountId);
                            }
                            f.factionFightId = matchingFactionFight._id.toString();
                            fightsToSave.push(f);
                        }
                        
                        // Aktualisiere Zeiträume falls nötig
                        matchingFactionFight.fightIds = Array.from(existingFightIds);
                        matchingFactionFight.memberAccountIds = Array.from(existingMemberIds);
                        matchingFactionFight.startTime = new Date(Math.min(
                            matchingFactionFight.startTime.getTime(),
                            groupStartTime.getTime()
                        ));
                        matchingFactionFight.endTime = new Date(Math.max(
                            matchingFactionFight.endTime.getTime(),
                            groupEndTime.getTime()
                        ));
                        
                        factionFightsToUpdate.set(matchingFactionFight._id.toString(), matchingFactionFight);
                    } else {
                        // Erstelle neuen Faction Fight
                        const memberAccountIds = Array.from(new Set(group.map(f => f.accountId)));
                        const factionFight: FactionFight = {
                            _id: new ObjectId(),
                            factionId: factionId,
                            fightIds: group.map(f => f._id.toString()),
                            memberAccountIds: memberAccountIds,
                            startTime: groupStartTime,
                            endTime: groupEndTime,
                            created: new Date()
                        };

                        const insertResult = await db.collection<FactionFight>('faction-fights').insertOne(factionFight);
                        for (const f of group) {
                            f.factionFightId = insertResult.insertedId.toString();
                            fightsToSave.push(f);
                        }
                        
                        // Füge den neuen Faction Fight zu existingFights hinzu für nachfolgende Gruppen
                        existingFights.push(factionFight);
                    }
                }
            }
        }

        // Falls es noch analysierte Fights gibt, die weder zu einer FactionFight zugewiesen
        // noch in fightsToSave enthalten sind (z.B. Gruppen zu klein), erhöhe deren Versuche
        const processedFightIds = new Set(fightsToSave.map(f => f._id.toString()));
        for (const fight of analyzedFights) {
            if (!processedFightIds.has(fight._id.toString()) && !fight.factionFightId) {
                fight.factionAssignmentAttempts = (fight.factionAssignmentAttempts ?? 0) + 1;
                fightsToSave.push(fight);
            }
        }

        // Update existierende Faction Fights
        if (factionFightsToUpdate.size > 0) {
            await db.collection<FactionFight>('faction-fights').bulkWrite(
                Array.from(factionFightsToUpdate.values()).map((factionFight) => ({
                    updateOne: {
                        filter: { _id: factionFight._id },
                        update: {
                            $set: {
                                fightIds: factionFight.fightIds,
                                memberAccountIds: factionFight.memberAccountIds,
                                startTime: factionFight.startTime,
                                endTime: factionFight.endTime
                            }
                        }
                    }
                }))
            );
            logger.info(`Updated ${factionFightsToUpdate.size} existing faction fights.`);
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