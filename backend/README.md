# UrbanFlow Mobility — Backend

API NestJS : calcul d'itinéraires multimodaux (transport en commun, vélo, marche), import GTFS/GTFS-RT/GBFS, empreinte carbone, auth.

Voir le [README racine](../README.md) pour la vue d'ensemble, [../design.md](../design.md) pour l'architecture, [../endpoints.md](../endpoints.md) pour l'API.

## Prérequis

- Node.js, pnpm
- Postgres + PostGIS (`docker compose up -d` depuis la racine)

## Setup

```bash
pnpm install
cp .env.example .env
```

Renseigner dans `.env` :
- `DB_*` — connexion Postgres (par défaut alignée avec `docker-compose.yml`)
- `JWT_SECRET` — secret pour les tokens d'auth
- `OPENROUTESERVICE_API_KEY` — clé gratuite sur [openrouteservice.org](https://openrouteservice.org/dev/#/signup), utilisée pour le calcul d'itinéraires marche/vélo
- `GTFS_*` / `GBFS_*` — URLs des flux TaM/Vélomagg (valeurs par défaut déjà correctes pour Montpellier)
- `CORS_ORIGIN` — origine autorisée (frontend, `http://localhost:3001` en dev)

## Lancer

```bash
pnpm run start:dev     # mode watch
pnpm run start         # sans watch
pnpm run start:prod    # depuis dist/ (après build)
```

L'API écoute par défaut sur le port 3000.

## Migrations de schéma

Le schéma est décrit par des migrations versionnées dans `src/migrations/`.
En `development` et `test`, TypeORM synchronise encore le schéma au démarrage
(base jetable) ; partout ailleurs — production incluse — c'est `migration:run`
qui crée et fait évoluer les tables.

```bash
pnpm run migration:show      # ce qui est appliqué / en attente
pnpm run migration:run       # applique les migrations manquantes
pnpm run migration:revert    # annule la dernière
```

Après avoir modifié une entité :

```bash
pnpm run migration:generate src/migrations/NomDuChangement
```

TypeORM compare les entités à la base et écrit le SQL correspondant.
**Relire le fichier généré avant de le commiter** : un renommage de colonne est
produit comme un `DROP` suivi d'un `ADD`, ce qui perd les données — le
remplacer par un `ALTER TABLE ... RENAME COLUMN`.

Un déploiement doit lancer `pnpm run migration:run` avant de démarrer l'API.

## Import des données GTFS

```bash
pnpm run import:gtfs
```

Télécharge et importe le référentiel statique GTFS (arrêts, lignes, horaires) en base. Le rafraîchissement GTFS-RT/GBFS se fait ensuite automatiquement via polling planifié (voir `src/integration`).

## Tests

```bash
pnpm run test        # unitaires
pnpm run test:e2e    # end-to-end
pnpm run test:cov    # couverture
```

## Lint / format

```bash
pnpm run lint
pnpm run format
```

## Structure

```
src/
  auth/         # authentification (JWT)
  carbon/       # calcul empreinte carbone
  common/       # utilitaires partagés
  database/     # config TypeORM
  integration/  # import/sync GTFS, GTFS-RT, GBFS
  journeys/     # sauvegarde des itinéraires
  profile/      # Mobility Profile utilisateur
  routing/      # calcul d'itinéraires (MobilityProvider par mode)
```
