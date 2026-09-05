'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TransportMode, type Journey, type Coordinates, type BikeStation } from '../types';
import { useBikeStations } from '../hooks/useBikeStations';
import { useNow } from '../hooks/useNow';
import { formatRelativeTime } from '../format-relative-time';

const MOTORIZED_COLOR = '#1E3A5F';
const SOFT_MODE_COLOR = '#71717a'; // zinc-500, neutral for walk/bike
const BIKE_AVAILABLE_COLOR = '#16A34A'; // green-600 — at least one bike to rent
const BIKE_UNAVAILABLE_COLOR = '#DC2626'; // red-600 — same red as the "you are here" marker

// Phosphor "Bicycle" (fill weight) path, inlined so the marker is a plain
// Leaflet divIcon rather than a React component mounted outside the tree.
const BICYCLE_ICON_PATH =
  'M54.46,164.71,82.33,126.5a48,48,0,1,1-12.92-9.44L41.54,155.29a8,8,0,1,0,12.92,9.42ZM208,112a47.81,47.81,0,0,0-16.93,3.09L214.91,156A8,8,0,1,1,201.09,164l-23.83-40.86A48,48,0,1,0,208,112ZM165.93,72H192a8,8,0,0,1,8,8,8,8,0,0,0,16,0,24,24,0,0,0-24-24H152a8,8,0,0,0-6.91,12l11.65,20H99.26L82.91,60A8,8,0,0,0,76,56H48a8,8,0,0,0,0,16H71.41L85.12,95.51,69.41,117.06a47.87,47.87,0,0,1,12.92,9.44l11.59-15.9L125.09,164A8,8,0,1,0,138.91,156l-30.32-52h57.48l11.19,19.17a48.11,48.11,0,0,1,13.81-8.08Z';

function bikeStationIcon(color: string, size: number): L.DivIcon {
  return L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${size}" height="${size}" style="filter:drop-shadow(0 1px 1.5px rgb(0 0 0 / 0.45))"><rect width="256" height="256" fill="${color}" rx="56"/><path d="${BICYCLE_ICON_PATH}" fill="#ffffff"/></svg>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Walkable radius for "stations near this point" — matches the bike leg's
// own station search radius in bike.mobility-provider.ts.
const NEARBY_STATIONS_RADIUS_METERS = 1000;
const EARTH_RADIUS_METERS = 6_371_000;

function colorForMode(mode: TransportMode): string {
  return mode === TransportMode.Tram || mode === TransportMode.Bus ? MOTORIZED_COLOR : SOFT_MODE_COLOR;
}

function haversineDistanceMeters(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

interface JourneyMapProps {
  journey: Journey | null;
  // When set, the map frames this pair instead of the whole journey — the
  // "Démarrer l'itinéraire" walkthrough zooms to the current step's segment
  // rather than showing the full route dezoomed.
  focusBounds?: [Coordinates, Coordinates];
  // "You are here" marker for the walkthrough — lets a presenter show
  // progress along the route without a real GPS fix (see NavStep.currentPosition).
  currentPosition?: Coordinates;
  // Set while a field is waiting for a map click ("choisir sur la carte").
  onPick?: (point: Coordinates) => void;
  // Simulated "my position" for the nearby-stations search — there is no
  // real GPS fix in this demo, so the user clicks a point on the map instead.
  nearbyOrigin?: Coordinates | null;
  // Stations within NEARBY_STATIONS_RADIUS_METERS of nearbyOrigin, nearest
  // first — recomputed whenever nearbyOrigin or the station snapshot changes.
  onNearbyStationsChange?: (stations: (BikeStation & { distanceMeters: number })[]) => void;
  // When the bike-station snapshot was last refreshed, so the list can show
  // "il y a X min" instead of implying the numbers are always live.
  onBikeStationsFetchedAtChange?: (fetchedAt: string | null) => void;
  // Station markers are noise until asked for — hidden by default, shown
  // only when the user opts in (or when a nearby-stations search needs them).
  showBikeStations?: boolean;
}

export function JourneyMap({
  journey,
  focusBounds,
  currentPosition,
  onPick,
  nearbyOrigin,
  onNearbyStationsChange,
  onBikeStationsFetchedAtChange,
  showBikeStations = false,
}: JourneyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const positionMarkerRef = useRef<L.CircleMarker | null>(null);
  const stationLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const { stations, fetchedAt } = useBikeStations();
  const now = useNow();

  useEffect(() => {
    onBikeStationsFetchedAtChange?.(fetchedAt);
  }, [fetchedAt, onBikeStationsFetchedAtChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [43.6119, 3.8772], // Montpellier
      zoom: 13,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    layerGroupRef.current = L.layerGroup().addTo(map);
    stationLayerGroupRef.current = L.layerGroup().addTo(map);

    // The container's real size (flex/sticky layout) isn't settled on mount,
    // so Leaflet's initial tile grid is computed against a stale size.
    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup || !journey) return;

    layerGroup.clearLayers();

    journey.segments.forEach((segment) => {
      // The real road/path shape when ORS provided one (Marche/Vélo) — a
      // straight from/to line otherwise (Bus/Tram, which has no per-segment
      // shape in GTFS, or a Marche/Vélo segment ORS couldn't reach).
      const path: L.LatLngExpression[] =
        segment.geometry && segment.geometry.length > 0
          ? segment.geometry.map((p): L.LatLngExpression => [p.lat, p.lon])
          : [
              [segment.from.lat, segment.from.lon],
              [segment.to.lat, segment.to.lon],
            ];

      L.polyline(path, {
        color: colorForMode(segment.mode),
        weight: 4,
        opacity: 0.85,
        dashArray: segment.mode === TransportMode.Marche ? '6 6' : undefined,
      }).addTo(layerGroup);
    });

    if (journey.segments.length > 0) {
      const first = journey.segments[0];
      const last = journey.segments[journey.segments.length - 1];

      L.circleMarker([first.from.lat, first.from.lon], {
        radius: 6,
        color: '#ffffff',
        fillColor: MOTORIZED_COLOR,
        fillOpacity: 1,
        weight: 2,
      }).addTo(layerGroup);

      L.circleMarker([last.to.lat, last.to.lon], {
        radius: 6,
        color: '#ffffff',
        fillColor: MOTORIZED_COLOR,
        fillOpacity: 1,
        weight: 2,
      }).addTo(layerGroup);
    }
  }, [journey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !journey) return;

    if (focusBounds) {
      const [from, to] = focusBounds;
      map.fitBounds(
        L.latLngBounds([
          [from.lat, from.lon],
          [to.lat, to.lon],
        ]),
        { padding: [48, 48], maxZoom: 18 },
      );
      return;
    }

    const bounds = journey.segments.flatMap((segment): L.LatLngExpression[] => [
      [segment.from.lat, segment.from.lon],
      [segment.to.lat, segment.to.lon],
    ]);
    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [32, 32] });
    }
  }, [journey, focusBounds]);

  useEffect(() => {
    const layerGroup = stationLayerGroupRef.current;
    if (!layerGroup) return;

    layerGroup.clearLayers();

    const nearby = nearbyOrigin
      ? stations
          .map((station) => ({ station, distanceMeters: haversineDistanceMeters(nearbyOrigin, station) }))
          .filter(({ distanceMeters }) => distanceMeters <= NEARBY_STATIONS_RADIUS_METERS)
      : [];
    const nearbyIds = new Set(nearby.map(({ station }) => station.stationId));

    if (showBikeStations || nearbyOrigin) {
      stations.forEach((station) => {
        const available = (station.bikesAvailable ?? 0) > 0;
        const availability =
          station.bikesAvailable !== undefined && station.docksAvailable !== undefined
            ? `${station.bikesAvailable} vélo(s) · ${station.docksAvailable} place(s)`
            : 'Disponibilité inconnue';
        const isNearby = nearbyIds.has(station.stationId);
        const color = available ? BIKE_AVAILABLE_COLOR : BIKE_UNAVAILABLE_COLOR;

        const updatedAt = fetchedAt
          ? `<br><span style="opacity:0.65;font-size:0.85em">Mis à jour ${formatRelativeTime(fetchedAt, now)}</span>`
          : '';

        L.marker([station.lat, station.lon], {
          icon: bikeStationIcon(color, isNearby ? 28 : 22),
          opacity: nearbyOrigin && !isNearby ? 0.45 : 1,
        })
          .bindPopup(`<strong>${station.name}</strong><br>${availability}${updatedAt}`)
          .addTo(layerGroup);
      });
    }

    onNearbyStationsChange?.(
      nearby
        .sort((a, b) => a.distanceMeters - b.distanceMeters)
        .map(({ station, distanceMeters }) => ({ ...station, distanceMeters })),
    );
  }, [stations, fetchedAt, now, nearbyOrigin, onNearbyStationsChange, showBikeStations]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onPick) return;

    // Leaflet fires `click` only for a real click — a pan that ends over the
    // map is swallowed as a drag, so no handler on mobile pan.
    const handleClick = (e: L.LeafletMouseEvent) => onPick({ lat: e.latlng.lat, lon: e.latlng.lng });
    map.on('click', handleClick);
    map.getContainer().style.cursor = 'crosshair';

    return () => {
      map.off('click', handleClick);
      map.getContainer().style.cursor = '';
    };
  }, [onPick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    positionMarkerRef.current?.remove();
    positionMarkerRef.current = null;

    const point = currentPosition ?? nearbyOrigin;
    if (!point) return;

    positionMarkerRef.current = L.circleMarker([point.lat, point.lon], {
      radius: 9,
      color: '#ffffff',
      weight: 3,
      fillColor: '#DC2626',
      fillOpacity: 1,
    }).addTo(map);

    if (nearbyOrigin) {
      map.setView([nearbyOrigin.lat, nearbyOrigin.lon], 15);
    }
  }, [currentPosition, nearbyOrigin]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={
        onPick
          ? 'Carte — cliquez pour choisir un point'
          : journey
            ? "Tracé de l'itinéraire sur la carte"
            : 'Carte de Montpellier'
      }
      className="h-full min-h-[320px] w-full overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800"
    />
  );
}
