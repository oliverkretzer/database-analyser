export enum Schedule {
    SERVER_TICK = '*/15 * * * *',  // Alle 15 Minuten
    HOURLY = '0 * * * *',             // Jede Stunde
    DAILY = '0 5 * * *',              // Täglich um 5 Uhr nachts
}