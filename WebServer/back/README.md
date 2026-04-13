# Temp Sent — Back (API)

API REST Node/Express.

## Run (Docker)

Depuis `WebServer/` :

- Copier `.env.example` -> `.env` (au niveau `WebServer/.env`) et remplir `FIREBASE_DATABASE_URL` + le chemin du service account.
- Lancer (depuis `WebServer/back`) :

`docker compose --env-file ../.env up -d --build`

## Endpoints

- `POST /api/v1/telemetry` -> écrit dans Firebase Realtime Database (`FIREBASE_TELEMETRY_PATH`)
- `POST /api/v1/hardware` -> écrit dans Firebase Realtime Database (`FIREBASE_HARDWARE_PATH`)

- `GET /api/v1/telemetry?source=hot|cold|both&since=<ms|iso>&until=<ms|iso>&limit=<1..1000>`
- `GET /api/v1/hardware?source=hot|cold|both&since=<ms|iso>&until=<ms|iso>&limit=<1..1000>`

## Firebase RTDB: index requis

L'API fait des requêtes `orderByChild("timestamp_server")` sur RTDB.
Si Firebase renvoie:

`Index not defined, add ".indexOn": "timestamp_server" ...`

il faut ajouter l'index dans les règles RTDB.

Template prêt à copier/coller: [firebase-rtdb.rules.json](../../firebase-rtdb.rules.json)

Note: les chemins doivent correspondre à `FIREBASE_TELEMETRY_PATH` / `FIREBASE_HARDWARE_PATH`.

Dans Firebase Console: Realtime Database → Rules → coller/merger puis Publish.

## Archivage (cron)

Le conteneur API exécute un cron (par défaut `5 0 * * *`) qui :
1) copie les entrées RTDB plus vieilles que `ARCHIVE_OLDER_THAN_HOURS` vers MariaDB,
2) purge ces entrées dans RTDB.

Tables MariaDB : `telemetry_archive`, `hardware_archive`.
