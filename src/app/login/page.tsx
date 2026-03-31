"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.message.toLowerCase().includes("invalid")) {
        setError("Identifiants incorrects.");
      } else {
        setError("Erreur de connexion. Veuillez réessayer.");
      }
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm p-8">
        <div className="mb-8 text-center">
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ color: "#1B2A4A" }}
          >
            Connexion
          </h1>
          <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
            Système de rentabilité COD
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium mb-1.5"
              style={{ color: "#1B2A4A" }}
            >
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors"
              style={{ borderColor: "#D1D5DB", color: "#1B2A4A" }}
              onFocus={(e) => (e.target.style.borderColor = "#1B2A4A")}
              onBlur={(e) => (e.target.style.borderColor = "#D1D5DB")}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1.5"
              style={{ color: "#1B2A4A" }}
            >
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors"
              style={{ borderColor: "#D1D5DB", color: "#1B2A4A" }}
              onFocus={(e) => (e.target.style.borderColor = "#1B2A4A")}
              onBlur={(e) => (e.target.style.borderColor = "#D1D5DB")}
            />
          </div>

          {error && (
            <p className="text-sm" style={{ color: "#C75B39" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-60"
            style={{ backgroundColor: "#1B2A4A" }}
          >
            {loading ? "Connexion en cours…" : "Se connecter"}
          </button>
        </form>
      </div>
    </main>
  );
}
