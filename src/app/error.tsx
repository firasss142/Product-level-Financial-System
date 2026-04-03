"use client";

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-warm-gray-100 p-6">
      <div className="text-center space-y-4 max-w-sm">
        <p className="text-5xl font-semibold text-terracotta tabular-nums">500</p>
        <h1 className="text-xl font-semibold text-navy">Erreur serveur</h1>
        <p className="text-sm text-warm-gray-500">
          Une erreur inattendue s&apos;est produite. Veuillez rafraîchir la page ou réessayer.
        </p>
        <button
          onClick={reset}
          className="mt-2 rounded-lg bg-navy px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy-dark focus:outline-none focus:ring-2 focus:ring-navy focus:ring-offset-2"
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}
