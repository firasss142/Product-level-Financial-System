"use client";

import { useEffect } from "react";
import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AdminError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-sm">
        <div className="mx-auto w-12 h-12 rounded-full bg-terracotta/10 flex items-center justify-center">
          <svg className="w-6 h-6 text-terracotta" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-navy">Une erreur s&apos;est produite</h1>
        <p className="text-sm text-warm-gray-500">
          Impossible de charger cette page. Veuillez réessayer ou retourner au tableau de bord.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={reset}
            className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-dark focus:outline-none focus:ring-2 focus:ring-navy focus:ring-offset-2"
          >
            Réessayer
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg border border-warm-gray-200 px-4 py-2 text-sm font-medium text-navy transition-colors hover:bg-warm-gray-50 focus:outline-none focus:ring-2 focus:ring-navy focus:ring-offset-2"
          >
            Tableau de bord
          </Link>
        </div>
      </div>
    </div>
  );
}
