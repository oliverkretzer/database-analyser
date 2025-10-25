import { ObjectId } from 'mongodb';

export interface FactionFight {
    _id: ObjectId;
    factionId: string;
    fightIds: Array<ObjectId>;
    memberAccountIds: Array<string>;
    startTime: Date;
    endTime: Date;
    created: Date;
}

export default FactionFight;
