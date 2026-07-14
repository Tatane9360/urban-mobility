'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TransportMode, type Journey, type Coordinates } from '../types';

const MOTORIZED_COLOR = '#1E3A5F';
const SOFT_MODE_COLOR = '#71717a'; // zinc-500, neutral for walk/bike

function colorForMode(mode: TransportMode): string {
  return mode === TransportMode.Tram || mode === TransportMode.Bus ? MOTORIZED_COLOR : SOFT_MODE_COLOR;
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
}

export function JourneyMap({ journey, focusBounds, currentPosition }: JourneyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const positionMarkerRef = useRef<L.CircleMarker | null>(null);

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
    const map = mapRef.current;
    if (!map) return;

    positionMarkerRef.current?.remove();
    positionMarkerRef.current = null;

    if (!currentPosition) return;

    positionMarkerRef.current = L.circleMarker([currentPosition.lat, currentPosition.lon], {
      radius: 9,
      color: '#ffffff',
      weight: 3,
      fillColor: '#DC2626',
      fillOpacity: 1,
    }).addTo(map);
  }, [currentPosition]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={journey ? "Tracé de l'itinéraire sur la carte" : 'Carte de Montpellier'}
      className="h-full min-h-[320px] w-full overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800"
    />
  );
}
