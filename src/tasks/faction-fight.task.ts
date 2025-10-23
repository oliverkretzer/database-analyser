import { Database } from '../database.js';
import { Schedule } from '../enums/schedule.enum.js';
import { ITask } from '../interfaces/task.interface.js';
import { LokiLogger } from '../logger.js';
import { PlayerFight } from '../interfaces/anticheat/player-fight.interface.js';
import { FactionFight } from '../interfaces/faction-fight/faction-fight.interface.js';
import { ObjectId } from 'mongodb';

// Configuration: time window (ms) and threshold
const TIME_WINDOW_MS = 1000 * 60 * 5; // 5 minutes
const MEMBER_THRESHOLD = 4; // more than 4 other members => create faction fight

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
        logger.info(`[${this.name}] Executing faction fight task...`);
        const db = database.database;
        if (!db) {
            logger.error('Database connection is not established.');
            return;
        }

        // Only consider fights that have been attempted less than 2 times
        const unassignedFights = await db.collection<PlayerFight>('player-fights').find({
            factionFightId: { $in: [null, undefined] },
            $or: [
                { factionAssignmentAttempts: { $exists: false } },
                { factionAssignmentAttempts: { $lt: 2 } }
            ]
        }).toArray();
        if (unassignedFights.length === 0) {
            logger.info('No unassigned player fights found.');
            return;
        }

        // Fetch accounts for these fights to determine factionId
        const accountIds = Array.from(new Set(unassignedFights.map(f => f.accountId)));
        // accounts collection shape is unknown; we only need accountId -> factionId
        const accounts = await db.collection('accounts').find({ accountId: { $in: accountIds } }).toArray();
        const accountMap: Record<string, { accountId?: string; factionId?: string }> = {};
        type AccountLite = { accountId?: string; factionId?: string };
        for (const acc of accounts) {
            const a = acc as unknown as AccountLite;
            const aid = a.accountId;
            const fid = a.factionId;
            if (aid) accountMap[aid] = { accountId: aid, factionId: fid };
        }

        // Build fights grouped by factionId. Also collect fights that have no faction so we can mark that we attempted them.
        const fightsByFaction: Record<string, PlayerFight[]> = {};
        const fightsWithoutFaction: PlayerFight[] = [];
        for (const fight of unassignedFights) {
            const acc = accountMap[fight.accountId];
            const factionId = acc ? acc.factionId ?? null : null;
            if (!factionId) {
                fightsWithoutFaction.push(fight);
                continue; // skip fights without faction
            }
            if (!fightsByFaction[factionId]) fightsByFaction[factionId] = [];
            fightsByFaction[factionId].push(fight);
        }

        const factionFightsToInsert: FactionFight[] = [];
        const playerFightUpdates: { _id: ObjectId; factionFightId: ObjectId }[] = [];

        // For each faction, detect clusters in time using a symmetric +/- TIME_WINDOW_MS window
        for (const [factionId, fights] of Object.entries(fightsByFaction)) {
            // Sort fights by created time
            fights.sort((a, b) => a.created.getTime() - b.created.getTime());

            const n = fights.length;
            let l = 0;
            let r = 0;
            // track fights already planned for a faction-fight to avoid duplicates
            const plannedFightIds = new Set<string>();

            for (let i = 0; i < n; i++) {
                const center = fights[i].created.getTime();

                // move left to the first fight >= center - TIME_WINDOW_MS
                while (l < n && fights[l].created.getTime() < center - TIME_WINDOW_MS) l++;
                // ensure r is at least i
                if (r < i) r = i;
                // move right to include fights <= center + TIME_WINDOW_MS
                while (r + 1 < n && fights[r + 1].created.getTime() <= center + TIME_WINDOW_MS) r++;

                // collect fights in [l..r] that are not yet planned
                const windowFights: PlayerFight[] = [];
                for (let k = l; k <= r; k++) {
                    const idHex = fights[k]._id.toHexString();
                    if (!plannedFightIds.has(idHex)) windowFights.push(fights[k]);
                }

                if (windowFights.length === 0) continue;

                const uniqueAccounts = new Set(windowFights.map(f => f.accountId));

                if (uniqueAccounts.size > MEMBER_THRESHOLD) {
                    const startTime = new Date(Math.min(...windowFights.map(f => f.created.getTime())));
                    const endTime = new Date(Math.max(...windowFights.map(f => f.created.getTime())));
                    const fightIds = windowFights.map(f => f._id);
                    const memberAccountIds = Array.from(uniqueAccounts);

                    const factionFight: FactionFight = {
                        factionId,
                        fightIds,
                        memberAccountIds,
                        startTime,
                        endTime,
                        created: new Date()
                    };

                    factionFightsToInsert.push(factionFight);

                    // Mark planned fights so they won't be used in another cluster for this faction
                    const tempId = new ObjectId();
                    for (const wf of windowFights) {
                        playerFightUpdates.push({ _id: wf._id, factionFightId: tempId });
                        plannedFightIds.add(wf._id.toHexString());
                    }

                    // skip centers inside this cluster
                    i = r;
                    l = r + 1;
                }
            }
        }

        if (factionFightsToInsert.length === 0) {
            logger.info('No faction fights detected.');
            const idsToMark = [
                ...fightsWithoutFaction.map(f => f._id),
                ...unassignedFights.map(f => f._id) // mark all evaluated fights to avoid immediate re-run
            ];
            if (idsToMark.length > 0) {
                // Increment attempts for the evaluated fights
                await db.collection<PlayerFight>('player-fights').updateMany(
                    { _id: { $in: idsToMark } },
                    { $inc: { factionAssignmentAttempts: 1 } }
                );
            }
            return;
        }

        // Insert faction fights
        const insertResult = await db.collection<FactionFight>('faction-fights').insertMany(factionFightsToInsert);
        const insertedIds = Object.values(insertResult.insertedIds);

        // Map temp ObjectIds to real insertedIds by order
        // We created a tempId per inserted factionFight in the same order, so map accordingly
        // Build an array of real ids aligned with factionFightsToInsert
        const realIds: ObjectId[] = insertedIds.map(id => id as ObjectId);

        // Now update player fights: for each inserted faction fight, find corresponding playerFightUpdates entries and set the real id
        for (let i = 0; i < factionFightsToInsert.length; i++) {
            const realId = realIds[i];
            // Count how many player updates we assigned for this faction fight by comparing fightIds
            const fightIds = factionFightsToInsert[i].fightIds.map(id => id.toHexString());
            const updatesForThis: { _id: ObjectId; factionFightId: ObjectId }[] = playerFightUpdates.filter(u => fightIds.includes(u._id.toHexString()));
            if (updatesForThis.length === 0) continue;
            // Bulk update these player fights to set factionFightId
            await db.collection<PlayerFight>('player-fights').bulkWrite(
                updatesForThis.map(u => ({
                    updateOne: {
                        filter: { _id: u._id },
                        update: { $set: { factionFightId: realId } }
                    }
                }))
            );
        }

    // Update attempt counts for all evaluated fights as well
        const evaluatedIds = unassignedFights.map(f => f._id);
        if (evaluatedIds.length > 0) {
            // Increment attempts for all evaluated fights
            await db.collection<PlayerFight>('player-fights').updateMany(
                { _id: { $in: evaluatedIds } },
                { $inc: { factionAssignmentAttempts: 1 } }
            );
        }

        logger.info(`Created ${factionFightsToInsert.length} faction fights and updated ${playerFightUpdates.length} player-fights.`);
    }
}