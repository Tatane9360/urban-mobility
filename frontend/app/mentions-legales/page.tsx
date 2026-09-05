export const metadata = { title: 'Mentions légales — UrbanFlow' };

export default function MentionsLegalesPage() {
  return (
    <div className="mx-auto w-full max-w-2xl flex-1 p-4 text-sm text-zinc-700 dark:text-zinc-300">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Mentions légales
      </h1>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">Éditeur du site</h2>
        <p>
          [Nom / raison sociale à compléter]
          <br />
          [Forme juridique, capital social si applicable]
          <br />
          [Adresse du siège]
          <br />
          [SIREN / SIRET]
          <br />
          [Email de contact]
        </p>
        <p className="mt-2">Directeur de la publication : [Nom à compléter]</p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">Hébergement</h2>
        <p>
          Frontend : Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis —{' '}
          <a href="https://vercel.com" className="underline hover:text-accent">
            vercel.com
          </a>
        </p>
        <p>
          Backend et base de données : Render Services, Inc., 525 Brannan St Suite 300, San Francisco,
          CA 94107, États-Unis —{' '}
          <a href="https://render.com" className="underline hover:text-accent">
            render.com
          </a>
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">Propriété intellectuelle</h2>
        <p>
          Sauf mention contraire, les éléments du site UrbanFlow (textes, marque, interface) sont
          protégés par le droit d&apos;auteur. Les données de transport affichées (horaires, arrêts,
          lignes, perturbations, disponibilité vélo) proviennent des flux GTFS, GTFS-RT et GBFS publiés
          par Montpellier Méditerranée Métropole / TaM et restent la propriété de leurs producteurs
          respectifs.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">Contact</h2>
        <p>Pour toute question relative au site, écrire à [email de contact à compléter].</p>
      </section>
    </div>
  );
}
