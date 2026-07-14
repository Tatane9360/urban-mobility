# UrbanFlow Mobility — Frontend

PWA Next.js pour la recherche d'itinéraires multimodaux.

Voir le [README racine](../README.md) pour la vue d'ensemble.

## Prérequis

- Node.js, pnpm
- Backend lancé (voir [../backend/README.md](../backend/README.md)), par défaut sur `http://localhost:3000`

## Setup

```bash
pnpm install
```

## Lancer

```bash
pnpm dev
```

Disponible sur [http://localhost:3001](http://localhost:3001).

## Build / prod

```bash
pnpm build
pnpm start
```

## Lint

```bash
pnpm lint
```

## Structure

```
app/          # routes (App Router) : history, login, register, profile...
src/
  components/ # composants UI
  features/   # logique par fonctionnalité
  lib/        # utilitaires, clients API
```
