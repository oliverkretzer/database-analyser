import { ObjectId } from "mongodb";
import { ShotLog } from "./shot-log.interface.js";
import { DamageLog } from "./damage-log.interface.js";
import { FightAnalyse } from "./fight-analyse.interface.js";

export interface PlayerFight {
    _id: ObjectId;
    accountId: string;
    shotLogs: Array<ShotLog>;
    damageLogs: Array<DamageLog>;
    lastUpdate: Date;
    created: Date;
    analysis: FightAnalyse | null;
    // When assigned to a faction fight this will hold the faction-fight _id
    factionFightId?: string | null;
    // How many times an assignment to a faction-fight was attempted. Stop trying after 2 attempts.
    factionAssignmentAttempts?: number;
}
