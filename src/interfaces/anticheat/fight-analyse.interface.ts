export interface FightAnalyse {
    distThreshold: number;
    angleThreshold: number;
    boneCenterDistance: number;
    aimAlignment: number;

    distFlag: number;
    angleFlag: number;
    boneCenterDistanceFlag: number;
    aimAlignmentFlag: number;

    shotCount: number;
    hitCount: number;
    hitRate: number;
    serverHitRate: number;

    shouldHitCount: number;
    shouldHitButDidNot: number; // müsste negativ sein wegen Spread
    shouldHitRate: number;

    aimingOnTargetCount: number;
    aimingOnTargetRate: number;
    aimingOnTargetHitCount: number; // müsste negativ sein wegen Spread

    targetMovingCount: number;
    targetMovingRate: number;
    targetMovingHitCount: number;
    targetMovingHitRate: number;

    otherTotalDamage: number;
    averageOtherTotalDamage: number;

    detailedDamage: Array<{ weaponHash: number; amount: number; count: number; average: number }>;

    totalDamage: number;
    averageTotalDamage: number;

    averageDistance: number;
    lowRange: number;
    midRange: number;
    highRange: number;
    noRange: number;

    weapons: Array<{ weaponHash: number; shots: number }>;
    boneHits: Array<{ bone: string; count: number }>;
}
