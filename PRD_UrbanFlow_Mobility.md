# Product Requirements Document — UrbanFlow Mobility

**Version :** 1.0
**Statut :** MVP (prototype fonctionnel)
**Date :** Juillet 2026
**Auteur :** _(à compléter)_
**Contexte :** Titre 6 — Concepteur Développeur de Solutions Digitales (RNCP 36146)

---

## 1. Executive Summary

**Problem Statement**
Dans une métropole de 500 000 habitants (terrain d'application : Montpellier Méditerranée Métropole), l'offre de mobilité est fragmentée entre de multiples opérateurs et modes (transports en commun, vélos partagés, marche), chacun avec sa propre application. L'usager ne dispose d'aucun outil unique lui permettant de comparer, en temps réel, l'ensemble des options selon le temps de trajet et l'impact carbone.

**Proposed Solution**
Une Progressive Web App (PWA) de mobilité multimodale qui agrège les données ouvertes réelles du territoire (GTFS/GTFS-RT pour les transports en commun, GBFS pour les vélos en libre-service) et calcule des itinéraires combinant plusieurs modes, chaque proposition étant qualifiée par sa durée et son empreinte carbone. La plateforme est conçue comme un outil de service public : souveraineté numérique, conformité RGPD et éco-conception y sont des exigences structurantes.

**Success Criteria (KPIs mesurables)**
1. Les **4 fonctionnalités** du MVP (F1, F2, F3, calcul carbone) sont fonctionnelles et démontrables avec des données réelles.
2. Le planificateur (F2) retourne au moins **un itinéraire multimodal** (≥ 2 modes chaînés) pour tout couple origine/destination valide dans le périmètre de la métropole.
3. Les données temps réel (positions véhicules GTFS-RT, disponibilité vélos GBFS) sont rafraîchies avec une latence ≤ **30 secondes**.
4. Le temps de réponse d'une recherche d'itinéraire est ≤ **3 secondes** en conditions nominales.
5. L'application est **installable** (PWA : manifest + service worker validés par Lighthouse) et obtient un score Lighthouse **Performance ≥ 80** et **Accessibilité ≥ 90** sur mobile.
6. Chaque itinéraire affiche une **empreinte carbone** et une comparaison avec le même trajet en voiture individuelle.

---

## 2. User Experience & Functionality

### User Personas

- **L'usager quotidien (pendulaire)** : se déplace domicile-travail, cherche l'itinéraire le plus rapide ou le plus écologique, veut suivre son impact dans le temps.
- **L'usager occasionnel / visiteur** : ne connaît pas le réseau, veut un itinéraire clair sans créer de compte (mode invité).
- **La collectivité (commanditaire)** : bénéficie indirectement de l'outil (report modal, données d'usage agrégées et anonymisées pour le pilotage des politiques de mobilité).

### User Stories & Acceptance Criteria

#### F1 — Inscription, connexion et profil de mobilité

- **Story** : En tant qu'usager, je veux créer un compte et définir mes préférences de mobilité afin d'obtenir des itinéraires personnalisés.
- **Acceptance Criteria** :
  - Inscription/connexion sécurisée (email + mot de passe haché, JWT).
  - Profil éditable : modes préférés, adresses favorites, indicateur d'accessibilité PMR *(champ prévu, filtrage non implémenté dans le MVP)*.
  - Un usager non authentifié (invité) peut rechercher un itinéraire, mais ne peut ni sauvegarder ni consulter d'historique.

#### F2 — Planificateur d'itinéraires multimodal *(fonctionnalité clé)*

- **Story** : En tant qu'usager, je veux saisir une origine et une destination afin d'obtenir des itinéraires combinant marche, transports en commun et vélo partagé.
- **Acceptance Criteria** :
  - Saisie origine/destination par géolocalisation, adresse (géocodage) ou clic sur la carte.
  - Retourne ≥ 1 itinéraire multimodal chaînant au moins 2 modes.
  - Chaque itinéraire affiche : durée totale, détail par segment (mode, durée), tracé sur la carte, empreinte carbone.
  - Tri des résultats selon « plus rapide » ou « plus écologique ».
  - Dégradation gracieuse : si le temps réel est indisponible, bascule sur les horaires théoriques (GTFS statique) avec signalement.

#### F3 — Intégration des API de transport

- **Story** : En tant que système, je dois consommer les données réelles de transport afin d'alimenter le planificateur.
- **Acceptance Criteria** :
  - Intégration GTFS statique (arrêts, lignes, horaires) du réseau TaM.
  - Intégration GTFS-RT (positions véhicules, mises à jour trajets, alertes) rafraîchie ≤ 30 s.
  - Intégration GBFS Vélomagg (stations + disponibilité vélos/bornes en temps réel).
  - Le décodage du GTFS-RT (protobuf) est effectué côté serveur.

#### Fonctionnalité au choix — Calculateur d'empreinte carbone

- **Story** : En tant qu'usager, je veux connaître l'empreinte carbone de mon trajet afin de privilégier les mobilités douces.
- **Acceptance Criteria** :
  - Calcul par segment selon un référentiel de facteurs d'émission (g CO₂/km par mode).
  - Affichage de l'empreinte totale de l'itinéraire.
  - Comparaison explicite avec le même trajet en voiture individuelle (gain affiché).
  - *(Should have)* Suivi cumulé de l'empreinte personnelle pour les usagers authentifiés.

### Non-Goals (hors périmètre du MVP)

- Réservation et paiement/billettique réels.
- Covoiturage, trottinettes, autopartage (évolutions futures).
- Gamification et signalement collaboratif.
- Calcul d'itinéraires accessibles PMR (conçu dans le modèle, implémenté ultérieurement).
- Version multilingue étendue.
- Recours à des modèles d'IA lourds (choix assumé de sobriété algorithmique).

---

## 3. AI System Requirements

**Non applicable en tant que composant produit.** Par cohérence écologique (éco-conception, contrainte C5), le MVP n'intègre **aucun modèle d'IA** comme brique fonctionnelle : le calcul d'itinéraire et le calcul carbone reposent sur des **algorithmes déterministes**. L'IA est utilisée uniquement comme **outil de productivité du développeur** (génération de code, tests, documentation), sous supervision humaine, sans impact sur le produit livré.

---

## 4. Technical Specifications

### Architecture Overview

- **Style** : monolithe modulaire, organisation **feature-first** (un module par domaine métier : `auth`, `profile`, `routing`, `carbon`, `integration`).
- **Principe directeur** : couche d'abstraction `MobilityProvider` isolant chaque source de données. Le moteur d'itinéraire interroge une interface homogène ; ajouter un mode = ajouter un connecteur, sans modifier le cœur.
- **Flux de données (F2)** : Client PWA → API (contrôleur) → service de routing → couche d'intégration → (PostGIS pour la recherche spatiale des arrêts/stations proches + API externes pour le temps réel) → calcul durée + carbone → réponse triée → affichage carte.

### Stack technique (justifiée par matrice décisionnelle)

| Couche | Technologie |
|--------|-------------|
| Front-end | Next.js (React, TypeScript), PWA |
| Back-end | NestJS (Node, TypeScript), feature-first |
| Base de données | PostgreSQL + PostGIS |
| Cartographie / routing | Leaflet/MapLibre + OpenRouteService |
| Données transport | GTFS / GTFS-RT (TaM) + GBFS (Vélomagg) |

### Integration Points

- **API TaM** : GTFS statique (ZIP), 6 flux GTFS-RT (urbain + suburbain).
- **API Vélomagg (Fifteen)** : GBFS 2.2 (`gbfs.json`, `station_information`, `station_status`).
- **OpenRouteService** : calcul d'itinéraire vélo/marche (clé API en variable d'environnement).
- **Géocodage** : Nominatim (OpenStreetMap).
- **Auth** : JWT, guards NestJS.
- **BDD** : entités MVP (`app_user`, `mobility_profile`, `saved_journey`, `saved_journey_segment`) — `favoriteAddresses`/`preferredModes` sont des colonnes `jsonb` sur `mobility_profile`, pas des tables séparées ; `transport_mode` est un enum applicatif (TypeScript), stocké en `varchar`, pas un type ENUM Postgres ; le cache GTFS-RT/GBFS est en mémoire (`GtfsRtService`/`GbfsService`), pas une table `provider_cache`. Entités anticipées (v1.1/v2.0) : `reservation`, `transaction`, `incident_report`.

### Security & Privacy

- **OWASP** : hachage bcrypt/argon2, requêtes paramétrées (ORM), Helmet, CORS restrictif, rate limiting, audit des dépendances.
- **RGPD** : données de géolocalisation traitées comme sensibles — consentement explicite révocable, minimisation, droit à l'effacement/portabilité, anonymisation des données d'usage.
- **Souveraineté** : standards ouverts, briques open source, hébergement de production européen souverain (OVHcloud managé) à l'abri des législations extraterritoriales (Cloud Act / Schrems II).

---

## 5. Risks & Roadmap

### Phased Rollout

- **MVP** : F1 (auth + profil), F2 (planificateur multimodal), F3 (intégration GTFS/GTFS-RT/GBFS), calculateur carbone. Hébergement dév. provisoire (Vercel + Render).
- **v1.1** : historique et tableau de bord des déplacements, suivi carbone cumulé, alertes perturbations. Migration hébergement production souverain (OVHcloud).
- **v2.0** : accessibilité PMR des itinéraires, nouveaux modes (trottinettes, covoiturage, autopartage), réservation/billettique, ouverture d'API partenaires, extension à d'autres métropoles.

### Technical Risks

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Indisponibilité/latence d'une API externe | Itinéraires incomplets | Dégradation gracieuse (GTFS statique), cache en mémoire des données temps réel (GTFS-RT, GBFS) |
| Erreurs de validation des flux (ex. GBFS Vélomagg) | Données incohérentes | Validation et nettoyage à l'intégration, gestion défensive des champs manquants |
| Complexité du calcul multimodal (chaînage des modes) | Cœur technique difficile | Périmètre MVP limité (marche + TC + vélo), OpenTripPlanner envisagé en évolution |
| Coût/quota OpenRouteService | Blocage du routing | Clé gratuite + fallback (tracé à vol d'oiseau + vitesse moyenne) |
| Volumétrie GTFS (parsing) | Performance dégradée | Pré-traitement et indexation spatiale PostGIS (index GiST) |
| Migration d'hébergement (dév → prod souverain) | Effort d'exploitation | Découplage via variables d'environnement, offre OVH managée (pas d'admin serveur) |

### Evaluation / Testing Strategy

- **Tests unitaires** (Jest) : logique métier (calcul carbone, règles d'itinéraire).
- **Tests d'intégration** (Jest + Supertest) : endpoints API, accès BDD.
- **Tests end-to-end** (Playwright) : parcours complet de recherche d'itinéraire.
- **Non-régression** : exécution automatique en CI (GitHub Actions) ; capitalisation d'un test à chaque bug corrigé.
- **Validation MVP** : les 6 KPIs de l'Executive Summary servent de critères de recette.
