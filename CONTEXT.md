# UrbanFlow Mobility

PWA de mobilité multimodale pour Montpellier Méditerranée Métropole : agrège transport en commun (GTFS/GTFS-RT), vélo partagé (GBFS) et marche pour calculer des itinéraires qualifiés par durée et empreinte carbone.

## Language

**Transport mode**:
Catégorie de déplacement manipulée par le domaine : Tram, Bus, Vélo, ou Marche. La marche compte comme un mode à part entière (un itinéraire "marche + bus" est déjà multimodal). Le code GTFS `route_type` 715 (shuttle bus, dessertes suburbaines TaM) est fusionné dans Bus — même véhicule physique, le MVP ne gère pas de logique de réservation qui le distinguerait.
_Avoid_: Vehicle type, route type (ce sont les codes GTFS bruts, pas le concept domaine)

**MobilityProvider**:
Interface côté `routing`, une par mode de transport, qui retourne des segments d'itinéraire normalisés pour ce mode. N'englobe pas l'import/synchronisation des données — c'est un concept de planification, pas d'intégration.
_Avoid_: Data source, connector (utilisés pour parler de l'intégration GTFS/GBFS elle-même)

**Journey**:
Un itinéraire concret calculé pour une recherche (origine, destination, liste ordonnée de Journey Segments, durée totale, empreinte carbone totale). Objet transitoire par défaut — n'existe qu'en mémoire/réponse HTTP. Ne devient une ligne en base que sur action explicite de sauvegarde par l'usager, authentifié ou non.
_Avoid_: Trip, route, itinéraire (garder Journey comme terme unique en anglais dans le code)

**Journey Segment**:
Une portion d'un Journey sur un seul mode : mode, durée, tracé. Tous les segments sont uniformes (y compris la marche) — pas de segment "connecteur implicite".

**Mobility Profile**:
Préférences de mobilité d'un usager (modes préférés, adresses favorites, indicateur PMR prévu mais non filtré au MVP). En relation 1-1 stricte avec User, créé automatiquement (valeurs vides) dans la même transaction que l'inscription — jamais d'état "User sans Mobility Profile".

## Intégration de données

**GTFS statique**:
Référentiel théorique du réseau TaM (arrêts, lignes, horaires), livré en ZIP, re-téléchargé périodiquement. Alimente les données GTFS-RT et GBFS ci-dessous.

**GTFS-RT**:
Flux temps réel (positions véhicules, mises à jour trajets, alertes) en protobuf. Rafraîchi par polling planifié en arrière-plan, cache en mémoire, cible ≤ 30 s (KPI PRD). Le planificateur lit toujours le cache, jamais l'API externe en direct.

**GBFS**:
Flux temps réel des stations Vélomagg (fournisseur Fifteen). Rafraîchi par polling planifié en arrière-plan selon le TTL imposé par le fournisseur (60 s) — le KPI PRD "≤ 30 s" ne s'applique donc qu'à GTFS-RT, GBFS suit son propre TTL et cette limite est assumée.

## Calcul carbone

**Facteur d'émission**:
Constante en dur par Transport Mode (g CO₂/km), sourcée sur la Base Carbone ADEME. Pas de variation par ligne ou véhicule, pas de table dédiée au MVP — cohérent avec la sobriété algorithmique voulue par le PRD.

## Tri des résultats (F2)

Le planificateur génère un ensemble de Journeys candidats (combinaisons plausibles de modes), puis les trie après coup selon le critère demandé (durée totale ou empreinte carbone totale) — pas de solveur de recherche distinct par critère.
