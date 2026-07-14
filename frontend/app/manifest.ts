import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'UrbanFlow Mobility',
    short_name: 'UrbanFlow',
    description:
      "Planificateur d'itinéraires multimodal pour Montpellier Méditerranée Métropole",
    start_url: '/',
    display: 'standalone',
    background_color: '#fafafa',
    theme_color: '#1e3a5f',
    lang: 'fr',
    icons: [
      { src: '/icon', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512', sizes: '512x512', type: 'image/png' },
      {
        src: '/icon-maskable',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
