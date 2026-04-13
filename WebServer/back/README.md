# Temp Sent — Back (API)

API REST Node/Express.

## Run (Docker)

Depuis `back/` :

- Copier `.env.example` -> `.env` et remplir `FIREBASE_DATABASE_URL` + le chemin du service account.
- Lancer :

`docker compose --env-file .env up -d --build`

## Endpoints

- `POST /api/v1/telemetry` -> écrit dans Firebase Realtime Database (`FIREBASE_TELEMETRY_PATH`)
- `POST /api/v1/hardware` -> écrit dans Firebase Realtime Database (`FIREBASE_HARDWARE_PATH`)

- `GET /api/v1/telemetry?source=hot|cold|both&since=<ms|iso>&until=<ms|iso>&limit=<1..1000>`
- `GET /api/v1/hardware?source=hot|cold|both&since=<ms|iso>&until=<ms|iso>&limit=<1..1000>`

## Archivage (cron)

Le conteneur API exécute un cron (par défaut `5 0 * * *`) qui :
1) copie les entrées RTDB plus vieilles que `ARCHIVE_OLDER_THAN_HOURS` vers MariaDB,
2) purge ces entrées dans RTDB.

Tables MariaDB : `telemetry_archive`, `hardware_archive`.
