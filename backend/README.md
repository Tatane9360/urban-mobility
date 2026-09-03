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

La base Neon existait avant les migrations : son schéma avait été créé par
`synchronize`. `InitialSchema` y a donc été enregistrée comme déjà appliquée
(baseline) plutôt que rejouée, ce qui aurait échoué sur des tables existantes.
Rien à refaire — c'est noté ici pour expliquer pourquoi la première migration
n'a jamais « tourné » en production.

### En production (Render)

Le déploiement doit appliquer les migrations **avant** de démarrer l'API.
Dans les settings du service Render :

- **Build Command** : `pnpm install --frozen-lockfile && pnpm build`
- **Start Command** : `pnpm migration:run:prod && pnpm start:prod`

Render détecte `pnpm-lock.yaml` et fournit pnpm sans configuration. Le champ
`packageManager` du `package.json` fige la version utilisée, pour que le build
en ligne résolve exactement les mêmes dépendances qu'en local.

Les migrations sont enchaînées à la Start Command plutôt que placées dans la
Pre-Deploy Command, qui est réservée aux plans payants. Le `&&` donne la même
garantie : si une migration échoue, le process sort en erreur et l'API ne
démarre pas — Render garde alors l'ancienne version en ligne, plutôt que de
servir une API face à un schéma à moitié migré.

`migration:run:prod` travaille depuis `dist/` (le build compilé) et non via
ts-node. S'il ne reste rien à appliquer il affiche « No migrations are
pending » et rend la main en une seconde — c'est le cas normal d'un
déploiement sans changement de schéma.

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
