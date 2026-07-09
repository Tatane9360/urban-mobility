# Endpoints — données mobilité Montpellier

Mini-doc des endpoints externes utilisés par le projet, vérifiés réellement le 2026-06-29 (voir `resultat.md`).

## GTFS statique (réseau TaM — arrêts, lignes, horaires)

`GET https://data.montpellier3m.fr/sites/default/files/ressources/TAM_MMM_GTFS.zip`

- Réponse : ZIP (~4.4 Mo), contient `agency.txt`, `stops.txt`, `routes.txt`, `trips.txt`, `stop_times.txt`, `calendar.txt`
- ~2123 arrêts, ~45 lignes
- À re-télécharger périodiquement (données théoriques, changent peu souvent)

## GTFS-RT (temps réel — protobuf binaire)

Réseau urbain :

| Flux | URL |
|------|-----|
| Position véhicules | `https://data.montpellier3m.fr/GTFS/Urbain/VehiclePosition.pb` |
| Mises à jour trajets | `https://data.montpellier3m.fr/GTFS/Urbain/TripUpdate.pb` |
| Alertes | `https://data.montpellier3m.fr/GTFS/Urbain/Alert.pb` |

Réseau suburbain (mêmes chemins, `Urbain` → `Suburbain`) :

| Flux | URL |
|------|-----|
| Position véhicules | `https://data.montpellier3m.fr/GTFS/Suburbain/VehiclePosition.pb` |
| Mises à jour trajets | `https://data.montpellier3m.fr/GTFS/Suburbain/TripUpdate.pb` |
| Alertes | `https://data.montpellier3m.fr/GTFS/Suburbain/Alert.pb` |

- Format : Protocol Buffers, décoder avec `gtfs-realtime-bindings` (`google.transit.gtfs_realtime_pb2`)
- `Content-Type: application/octet-stream`
- Rafraîchir souvent (temps réel), réponses < 0.5 s

## GBFS (Vélomagg — vélos en libre-service)

`GET https://gbfs.theta.fifteen.eu/gbfs/montpellier/gbfs.json`

Point d'entrée JSON listant les sous-feeds. Deux utiles :

| Feed | URL | Contenu |
|------|-----|---------|
| Stations (infos statiques) | `https://gbfs.theta.fifteen.eu/gbfs/2.2/montpellier/en/station_information.json` | 52 stations (id, nom, coordonnées) |
| Disponibilité (temps réel) | `https://gbfs.theta.fifteen.eu/gbfs/2.2/montpellier/en/station_status.json` | vélos/docks dispo par station |

Exemple `station_status`:
```json
{"station_id":"001","num_bikes_available":7,"num_docks_available":5,"is_renting":true}
```

- `ttl: 60` (racine du flux) — rafraîchir au moins toutes les 30 s pour respecter le KPI PRD.
- Chaque station détaille aussi `vehicle_types_available` (types `14`, `15`, `7` observés) — plusieurs catégories de vélos par station, non exploité pour le MVP.

## Notes

- Fournisseur GBFS = **Fifteen** (`gbfs.theta.fifteen.eu`), pas `montpellier3m.fr` malgré ce qu'indiquait la doc initiale.
- Aucun flux mort au moment du test ; le plus lent est le GTFS statique (~4.5 s, taille du zip).
- Détail complet des preuves (curl, décodage protobuf) : voir `resultat.md`.
