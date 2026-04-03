import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-warm-gray-100 p-6">
      <div className="text-center space-y-4 max-w-sm">
        <p className="text-6xl font-semibold text-navy tabular-nums">404</p>
        <h1 className="text-xl font-semibold text-navy">Page non trouvée</h1>
        <p className="text-sm text-warm-gray-500">
          La page que vous recherchez n&apos;existe pas ou a été déplacée.
        </p>
        <Link
          href="/dashboard"
          className="inline-block mt-2 rounded-lg bg-navy px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy-dark focus:outline-none focus:ring-2 focus:ring-navy focus:ring-offset-2"
        >
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  );
}
