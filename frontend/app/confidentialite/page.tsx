export const metadata = { title: 'Confidentialité — UrbanFlow' };

export default function ConfidentialitePage() {
  return (
    <div className="mx-auto w-full max-w-2xl flex-1 p-4 text-sm text-zinc-700 dark:text-zinc-300">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Politique de confidentialité
      </h1>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Responsable du traitement
        </h2>
        <p>[Nom / raison sociale à compléter] — [email de contact à compléter].</p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Données collectées
        </h2>
        <p className="mb-2">UrbanFlow fonctionne sans compte pour la planification de trajet simple. Créer un compte collecte :</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Adresse email et mot de passe (stocké sous forme hachée, jamais en clair)</li>
          <li>Adresses favorites que vous enregistrez</li>
          <li>Modes de transport préférés</li>
          <li>
            Statut d&apos;accessibilité PMR, si renseigné — donnée relative au handicap, traitée sur la
            seule base de votre consentement explicite et jamais partagée avec un tiers
          </li>
          <li>Itinéraires que vous sauvegardez dans votre historique</li>
        </ul>
        <p className="mt-2">
          La géolocalisation n&apos;est demandée qu&apos;après un accord explicite, révocable à tout
          moment depuis votre profil. Ce choix est conservé uniquement dans votre navigateur (aucune
          transmission au serveur).
        </p>
        <p className="mt-2">
          Aucun cookie n&apos;est déposé. La connexion (jeton de session) et le consentement de
          géolocalisation sont stockés dans le stockage local de votre navigateur (localStorage), qui
          ne quitte jamais votre appareil.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">Finalités</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Calculer et afficher des itinéraires multimodaux</li>
          <li>Sauvegarder vos favoris et votre historique de trajets, si vous êtes connecté</li>
          <li>Adapter les résultats à vos préférences (mode de transport, accessibilité)</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Destinataires et sous-traitants
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Vercel et Render — hébergement de l&apos;application et de la base de données</li>
          <li>OpenRouteService — reçoit les coordonnées de départ/arrivée pour calculer les itinéraires à pied et à vélo, sans donnée d&apos;identification associée</li>
          <li>Sentry — suivi des erreurs techniques de l&apos;application</li>
        </ul>
        <p className="mt-2">
          Les données de transport (horaires, perturbations, disponibilité vélo) proviennent des flux
          publics GTFS, GTFS-RT et GBFS de Montpellier Méditerranée Métropole / TaM ; aucune donnée
          personnelle ne leur est transmise.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">Durée de conservation</h2>
        <p>
          Vos données de compte sont conservées tant que votre compte existe. Les journaux techniques
          de connexion identifient un compte par un identifiant technique qui disparaît avec le compte,
          et non par votre email.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">Vos droits</h2>
        <p className="mb-2">
          Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification, de
          portabilité et d&apos;effacement de vos données.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Téléchargez une copie de toutes vos données depuis votre profil (export JSON)</li>
          <li>Supprimez définitivement votre compte et toutes les données associées depuis votre profil</li>
        </ul>
        <p className="mt-2">
          Pour toute autre demande, contactez [email de contact à compléter]. Vous pouvez également
          introduire une réclamation auprès de la CNIL (cnil.fr).
        </p>
      </section>
    </div>
  );
}
