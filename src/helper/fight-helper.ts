import { FightAnalyse } from "../interfaces/anticheat/fight-analyse.interface.js";
import { PlayerFight } from "../interfaces/anticheat/player-fight.interface.js";
import { ShotAnalyse } from "../interfaces/anticheat/shot-analyse.interface.js";
import { ShotLog } from "../interfaces/anticheat/shot-log.interface.js";

class FightHelper {
    private readonly angleThreshold = 1.1;
    private readonly distThreshold = 0.4;
    private readonly alignmentThreshold = 0.99;
    private readonly centerDistThreshold = 0.12;

    /**
     * Analysiert alle Shots in einem Fight und gibt die Ergebnisse zurück.
     */
    public async analyzeFight(fight: PlayerFight): Promise<FightAnalyse> {
        if (!fight.shotLogs || (fight.shotLogs.length < 5 && fight.damageLogs.length < 5)) {
            return {
                distThreshold: 0,
                angleThreshold: 0,
                boneCenterDistance: 0,
                aimAlignment: 0,
                distFlag: 0,
                angleFlag: 0,
                boneCenterDistanceFlag: 0,
                aimAlignmentFlag: 0,
                shotCount: 0,
                hitCount: 0,
                hitRate: 0,
                serverHitRate: 0,
                shouldHitCount: 0,
                shouldHitButDidNot: 0,
                shouldHitRate: 0,
                aimingOnTargetCount: 0,
                aimingOnTargetRate: 0,
                aimingOnTargetHitCount: 0,
                targetMovingCount: 0,
                targetMovingRate: 0,
                targetMovingHitCount: 0,
                targetMovingHitRate: 0,
                otherTotalDamage: 0,
                totalDamage: 0,
                averageTotalDamage: 0,
                averageOtherTotalDamage: 0,
                averageDistance: 0,
                lowRange: 0,
                midRange: 0,
                highRange: 0,
                noRange: 0,
                weapons: [],
                boneHits: [],
                detailedDamage: []
            } satisfies FightAnalyse;
        }

        const stats = {
            // Durchschnittswerte für die Analyse
            distThresholdCount: 0,
            distThreshold: 0.0,

            angleThresholdCount: 0,
            angleThreshold: 0.0,

            boneCenterDistanceCount: 0,
            boneCenterDistance: 0.0,

            aimAlignmentCount: 0,
            aimAlignment: 0.0,

            // Flags
            distFlag: 0,
            angleFlag: 0,
            boneCenterDistanceFlag: 0,
            aimAlignmentFlag: 0,

            // Counter
            hitCount: 0,
            shouldHitCount: 0,
            aimingOnTargetCount: 0,
            targetMovingCount: 0,
            targetMovingHitCount: 0,
            weapons: [] as Array<{ weaponHash: number; shots: number }>,

            damageCount: 0,
            damage: 0,

            otherDamageCount: 0,
            otherDamage: 0,

            detailedDamage: [] as Array<{ weaponHash: number; amount: number; count: number }>,

            boneHits: [] as Array<{ bone: string; count: number }>,

            // Shot Range
            lowRange: 0,
            midRange: 0,
            highRange: 0,
            noRange: 0,
            distance: 0
        };

        for (const shot of fight.shotLogs) {
            const analysis = this.analyzeShot(shot);
            if (analysis.distThreshold >= 0) {
                stats.distThresholdCount++;
                stats.distThreshold += analysis.distThreshold;
                if (analysis.distThreshold > this.distThreshold) stats.distFlag++;
            }

            if (analysis.angleThreshold >= 0) {
                stats.angleThresholdCount++;
                stats.angleThreshold += analysis.angleThreshold;
                if (analysis.angleThreshold > this.angleThreshold) stats.angleFlag++;
            }

            if (analysis.boneCenterDistance >= 0) {
                stats.boneCenterDistanceCount++;
                stats.boneCenterDistance += analysis.boneCenterDistance;
                if (analysis.boneCenterDistance < this.centerDistThreshold) stats.boneCenterDistanceFlag++;
            }

            if (analysis.aimAlignment >= 0) {
                stats.aimAlignmentCount++;
                stats.aimAlignment += analysis.aimAlignment;
                if (analysis.aimAlignment < this.alignmentThreshold) stats.aimAlignmentFlag++;
            }

            if (shot.hit) stats.hitCount++;
            if (shot.shouldHit) stats.shouldHitCount++;
            if (shot.aimingOnTarget) stats.aimingOnTargetCount++;
            if (shot.targetMoving) {
                stats.targetMovingCount++;
                if (shot.hit) stats.targetMovingHitCount++;
            }

            if (shot.weaponHash) {
                const weapon = stats.weapons.find((w) => w.weaponHash === shot.weaponHash);
                if (weapon) {
                    weapon.shots++;
                } else {
                    stats.weapons.push({ weaponHash: shot.weaponHash, shots: 1 });
                }
            }

            if (shot.boneName !== null) {
                const bone = stats.boneHits.find((b) => b.bone === shot.boneName);
                if (bone) {
                    bone.count++;
                } else {
                    stats.boneHits.push({ bone: shot.boneName, count: 1 });
                }
            }

            if (shot.playerPos && shot.targetPos) {
                const distanceToTarget = this.distance(shot.playerPos, shot.targetPos);
                stats.distance += distanceToTarget;
                if (distanceToTarget < 10) {
                    stats.lowRange++;
                } else if (distanceToTarget < 35) {
                    stats.midRange++;
                } else {
                    stats.highRange++;
                }
            } else {
                stats.noRange++;
            }
        }

        for (const damageLog of fight.damageLogs) {
            if (damageLog.damageType === 3) {
                stats.damageCount++;
                stats.damage += damageLog.weaponDamage;
                const detailed = stats.detailedDamage.find((d) => d.weaponHash === damageLog.weaponType);
                if (detailed) {
                    detailed.amount += damageLog.weaponDamage;
                    detailed.count++;
                } else {
                    stats.detailedDamage.push({
                        weaponHash: damageLog.weaponType,
                        amount: damageLog.weaponDamage,
                        count: 1
                    });
                }
            } else {
                stats.otherDamageCount++;
                stats.otherDamage += damageLog.weaponDamage;
            }
        }

        const shotCount = fight.shotLogs.length;
        const finalStats: FightAnalyse = {
            distThreshold: stats.distThreshold / stats.distThresholdCount,
            angleThreshold: stats.angleThreshold / stats.angleThresholdCount,
            boneCenterDistance: stats.boneCenterDistance / stats.boneCenterDistanceCount,
            aimAlignment: stats.aimAlignment / stats.aimAlignmentCount,

            distFlag: stats.distFlag,
            angleFlag: stats.angleFlag,
            boneCenterDistanceFlag: stats.boneCenterDistanceFlag,
            aimAlignmentFlag: stats.aimAlignmentFlag,

            shotCount,
            hitCount: stats.hitCount,
            hitRate: stats.hitCount / shotCount,
            serverHitRate: stats.damageCount / shotCount,

            shouldHitCount: stats.shouldHitCount,
            shouldHitButDidNot: stats.hitCount - stats.shouldHitCount, // müsste negativ sein wegen Spread
            shouldHitRate: stats.shouldHitCount / shotCount,

            aimingOnTargetCount: stats.aimingOnTargetCount,
            aimingOnTargetRate: stats.aimingOnTargetCount / shotCount,
            aimingOnTargetHitCount: stats.hitCount - stats.aimingOnTargetCount, // müsste negativ sein wegen Spread

            targetMovingCount: stats.targetMovingCount,
            targetMovingRate: stats.targetMovingCount / shotCount,

            targetMovingHitCount: stats.targetMovingHitCount,
            targetMovingHitRate: stats.targetMovingHitCount / stats.targetMovingCount,

            otherTotalDamage: stats.otherDamage,
            averageOtherTotalDamage: stats.otherDamage / stats.otherDamageCount,

            totalDamage: stats.damage,
            averageTotalDamage: stats.damage / stats.damageCount,

            detailedDamage: stats.detailedDamage.map((d) => ({
                weaponHash: d.weaponHash,
                amount: d.amount,
                count: d.count,
                average: d.amount / d.count
            })),

            weapons: stats.weapons,
            boneHits: stats.boneHits,

            averageDistance: stats.distance / shotCount,
            lowRange: stats.lowRange,
            midRange: stats.midRange,
            highRange: stats.highRange,
            noRange: stats.noRange,
        } satisfies FightAnalyse;
        return finalStats;
    }

    /**
     * Analysiert einen einzelnen Shot und gibt die Ergebnisse zurück.
     */
    public analyzeShot(shot: ShotLog): ShotAnalyse {
        const distThreshold = this.getDistThreshold(shot);
        const angleThreshold = this.getAngleThreshold(shot);
        const boneCenterDistance = this.getBoneCenterDistance(shot);
        const aimAlignment = this.getAimAlignment(shot);
        return {
            distThreshold,
            angleThreshold,
            boneCenterDistance,
            aimAlignment
        };
    }

    private getDistThreshold(shot: ShotLog): number {
        if (!shot.hit || !shot.realHitPosition) return -1;

        const hitDistance = this.distance(shot.shotStart, shot.realHitPosition);
        const dir = this.normalizeVector(shot.shotDirection);
        const expectedDistanceVector = {
            x: shot.shotStart.x + dir.x * hitDistance,
            y: shot.shotStart.y + dir.y * hitDistance,
            z: shot.shotStart.z + dir.z * hitDistance
        };
        const actualDistance = this.distance(shot.realHitPosition, expectedDistanceVector);
        return actualDistance;
    }

    private getAngleThreshold(shot: ShotLog): number {
        if (!shot.hit || !shot.realHitPosition) return -1;

        const hitVector = {
            x: shot.realHitPosition.x - shot.shotStart.x,
            y: shot.realHitPosition.y - shot.shotStart.y,
            z: shot.realHitPosition.z - shot.shotStart.z
        };

        const normalizedHitVector = this.normalizeVector(hitVector);
        const normalizedShotVector = this.normalizeVector(shot.shotDirection);

        const dotProduct =
            normalizedHitVector.x * normalizedShotVector.x +
            normalizedHitVector.y * normalizedShotVector.y +
            normalizedHitVector.z * normalizedShotVector.z;
        return Math.acos(Math.max(-1, Math.min(1, dotProduct))) * (180 / Math.PI);
    }

    private getBoneCenterDistance(shot: ShotLog): number {
        if (!shot.hit || !shot.boneCenter || !shot.realHitPosition) return -1;
        const dx = shot.realHitPosition.x - shot.boneCenter.x;
        const dy = shot.realHitPosition.y - shot.boneCenter.y;
        const dz = shot.realHitPosition.z - shot.boneCenter.z;
        return this.getVectorLength(dx, dy, dz);
    }

    private getAimAlignment(shot: ShotLog): number {
        if (!shot.hit || !shot.realHitPosition) return -1;
        const aimDir = this.getDirectionFromRotation(shot.cameraRotation);
        const toHit = this.normalizeVector({
            x: shot.realHitPosition.x - shot.cameraPosition.x,
            y: shot.realHitPosition.y - shot.cameraPosition.y,
            z: shot.realHitPosition.z - shot.cameraPosition.z
        });
        return this.dotProduct(aimDir, toHit);
    }

    // --- Helper-Funktionen ---

    private getVectorLength(x: number, y: number, z: number): number {
        return Math.sqrt(x * x + y * y + z * z);
    }

    private dotProduct(v1: { x: number; y: number; z: number }, v2: { x: number; y: number; z: number }): number {
        return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    }

    private getDirectionFromRotation(rot: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
        const pitch = (rot.x * Math.PI) / 180;
        const yaw = (rot.z * Math.PI) / 180;
        const x = -Math.sin(yaw) * Math.cos(pitch);
        const y = Math.cos(yaw) * Math.cos(pitch);
        const z = Math.sin(pitch);
        return { x, y, z };
    }

    private normalizeVector(vector: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
        const length = this.getVectorLength(vector.x, vector.y, vector.z);
        if (length === 0) return { x: 0, y: 0, z: 0 };
        return {
            x: vector.x / length,
            y: vector.y / length,
            z: vector.z / length
        };
    }

    private distance(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
        return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) + (a.z - b.z) * (a.z - b.z));
    }
}

export const fightHelper = new FightHelper();
