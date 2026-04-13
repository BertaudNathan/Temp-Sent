# Temp Sent — Front

Front minimal pour:
- afficher la télémétrie (via API -> RTDB/MariaDB),
- afficher l'historique (via API -> MariaDB),
- envoyer des commandes d'actionneurs (POST vers l'API).

## Run (local)

Depuis `WebServer/front`:

- `npm install`
- Copier `WebServer/.env.example` -> `WebServer/.env` et remplir `VITE_API_BASE_URL`.
- `npm run dev`

## Run (Docker)

- Les variables Vite sont lues au build (pas au run). Si tu veux Dockeriser le front avec un `.env` partagé, le plus simple est de lancer le build depuis `WebServer/` (contexte qui contient `WebServer/.env`).
