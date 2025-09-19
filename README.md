# Cold Database Analyser

Ein TypeScript-basiertes Tool zur Analyse und Verwaltung von Cold-Datenbanken für FiveM-Server. Das System ermöglicht die geplante Ausführung von Datenbank-Tasks mit integriertem Logging über Loki.

## Übersicht

Dieses Projekt bietet eine robuste Infrastruktur für die Automatisierung von Datenbank-Operationen in FiveM-Umgebungen. Es verwendet MongoDB als Datenbank-Backend und Loki für zentralisiertes Logging.

## Features

- **Geplante Task-Ausführung**: Cron-basierte Scheduler für wiederkehrende Datenbank-Tasks
- **Robuste Datenbank-Verbindung**: Automatische Retry-Logik und Connection Pooling
- **Zentralisiertes Logging**: Integration mit Loki für strukturierte Logs
- **Graceful Shutdown**: Saubere Beendigung bei SIGINT/SIGTERM
- **TypeScript-Unterstützung**: Vollständig typisiert für bessere Code-Qualität
- **Modulare Architektur**: Einfache Erweiterung durch neue Tasks

## Projektstruktur

```
src/
├── database.ts           # MongoDB-Verbindungsmanagement
├── environment.ts        # Umgebungsvariablen-Handling
├── index.ts             # Haupteinstiegspunkt
├── logger.ts            # Loki-Logger-Implementierung
├── scheduler.ts         # Cron-basierter Task-Scheduler
├── enums/
│   └── schedule.enum.ts  # Vordefinierte Cron-Schedules
├── interfaces/
│   ├── environment.interface.ts  # Environment-Variablen-Interface
│   └── task.interface.ts         # Task-Interface
└── tasks/
    └── test-task.ts      # Beispiel-Task-Implementierung
```

## Installation

1. **Abhängigkeiten installieren:**
   ```bash
   npm install
   ```

2. **TypeScript kompilieren:**
   ```bash
   npm run build
   ```

3. **Umgebungsvariablen konfigurieren:**
   Erstelle eine `.env`-Datei im Projektroot mit folgenden Variablen:
   ```env
   MONGODB_URL=mongodb://localhost:27017
   MONGODB_DB_NAME=cold_database
   LOKI_URL=http://localhost:3100
   LOKI_USER=your_loki_username
   LOKI_PASSWORD=your_loki_password
   ```

## Verwendung

### Starten der Anwendung

```bash
npm start
```

Die Anwendung startet automatisch alle registrierten Tasks gemäß ihrer Schedule-Konfiguration.

### Hinzufügen neuer Tasks

1. Erstelle eine neue Klasse in `src/tasks/`, die `ITask` implementiert:
   ```typescript
   import { Database } from '../database.js';
   import { Schedule } from '../enums/schedule.enum.js';
   import { ITask } from '../interfaces/task.interface.js';
   import { LokiLogger } from '../logger.js';

   export class MyCustomTask implements ITask {
       public name: string = 'my-custom-task';
       public schedule: Schedule = Schedule.HOURLY;

       async execute(database: Database, logger: LokiLogger): Promise<void> {
           logger.info(`[${this.name}] Executing custom task...`);
           // Deine Datenbank-Operationen hier
       }
   }
   ```

2. Registriere den Task in `src/index.ts`:
   ```typescript
   import { MyCustomTask } from './tasks/my-custom-task.js';

   // In der DatabaseAnalyzer-Klasse
   this.scheduler.registerTask(new MyCustomTask());
   ```

## Konfiguration

### Schedule-Optionen

Das System bietet vordefinierte Schedule-Optionen:

- `Schedule.SERVER_TICK`: Alle 15 Minuten (`*/15 * * * *`)
- `Schedule.HOURLY`: Jede Stunde (`0 * * * *`)
- `Schedule.DAILY`: Täglich um 5 Uhr morgens (`0 5 * * *`)

### Datenbank-Konfiguration

Die MongoDB-Verbindung ist mit folgenden Optionen konfiguriert:
- Connection Pool: 20 max, 1 min
- Timeout: 45s Socket, 10s Connect, 5s Server Selection
- Retry Writes: Aktiviert
- Kompression: zlib Level 6

## Logging

Alle Logs werden an Loki gesendet mit folgenden Informationen:
- Service Name: `cold-database-analyser`
- Log Levels: `info`, `error`, etc.
- Zusätzliche Metadaten werden automatisch eingeschlossen

## Entwicklung

### Build
```bash
npm run build
```

### Linting
```bash
npm run lint
```

### Erweiterte Konfiguration

Für Produktionsumgebungen:
- Passe die MongoDB-Connection-Parameter an deine Bedürfnisse an
- Konfiguriere Loki für Hochverfügbarkeit
- Implementiere Health Checks für die Tasks
- Füge Monitoring und Alerting hinzu

## Abhängigkeiten

- **mongodb**: MongoDB-Treiber
- **node-cron**: Cron-Scheduling
- **winston**: Logging-Framework (für Loki-Integration)
- **dotenv**: Umgebungsvariablen-Management
- **typescript**: TypeScript-Compiler

## Lizenz

Dieses Projekt ist unter der MIT-Lizenz lizenziert.