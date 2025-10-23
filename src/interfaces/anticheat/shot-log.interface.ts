export interface ShotLog {
    shotSend: number;
    shotReceived: number | null;

    hit: boolean;
    shouldHit: boolean;
    aimingOnTarget: boolean;
    targetMoving: boolean;

    weaponHash: number;
    entityStartHealth: number | null;
    entityEndHealth: number | null;

    // onGunShot
    cameraPosition: { x: number; y: number; z: number };
    cameraRotation: { x: number; y: number; z: number };

    shotStart: { x: number; y: number; z: number };
    shotDirection: { x: number; y: number; z: number };
    raycastHitPos: { x: number; y: number; z: number };

    playerPos: { x: number; y: number; z: number } | null;
    targetPos: { x: number; y: number; z: number } | null;

    // onEntityDamaged
    boneId: number | null;
    boneName: string | null;
    boneCenter: { x: number; y: number; z: number } | null;
    realHitPosition: { x: number; y: number; z: number } | null;
}
