/**
 * Registry für maximalen Waffenschaden.
 * Hash: GTA V Weapon Hash (Dezimal)
 * Value: Maximaler Schaden pro Treffer
 */
class WeaponDamageHelper {
    private readonly weaponMaxDamage = new Map<number, number>([
        [-1357824103, 26], // Advanced Rifle
        [-1063057011, 27], // Special Carbine
    ]);

    /**
     * Prüft ob der Schaden für eine Waffe valide ist (nicht über Maximum).
     * @param weaponHash Der Weapon Hash
     * @param damage Der verursachte Schaden
     * @param tolerance Toleranz für Rundungsfehler (default: 1)
     * @returns true wenn valide oder Waffe unbekannt, false wenn zu hoch
     */
    public isValidDamage(weaponHash: number, damage: number): boolean {
        const maxDamage = this.weaponMaxDamage.get(weaponHash);
        if (!maxDamage) return true;
        return damage <= maxDamage;
    }
}

export const weaponDamageHelper = new WeaponDamageHelper();
