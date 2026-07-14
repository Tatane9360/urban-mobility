# UrbanFlow Mobility

PWA de mobilité multimodale pour Montpellier Méditerranée Métropole : agrège transport en commun (GTFS/GTFS-RT), vélo partagé (GBFS) et marche pour calculer des itinéraires qualifiés par durée et empreinte carbone.

Voir [PRD_UrbanFlow_Mobility.md](./PRD_UrbanFlow_Mobility.md) pour le produit, [design.md](./design.md) pour l'architecture, [CONTEXT.md](./CONTEXT.md) pour le vocabulaire du domaine, [endpoints.md](./endpoints.md) pour l'API.

## Structure

- [`backend/`](./backend/README.md) — API NestJS (routing, GTFS/GBFS, auth, carbone)
- [`frontend/`](./frontend/README.md) — PWA Next.js

## Démarrage rapide

```bash
# Base de données (Postgres + PostGIS)
docker compose up -d

# Backend (voir backend/README.md pour la config .env)
cd backend && pnpm install && pnpm run start:dev

# Frontend
cd frontend && pnpm install && pnpm dev
```

Détails spécifiques (variables d'environnement, scripts, tests) dans le README de chaque app.
