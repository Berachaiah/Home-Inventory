"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { access_token } = await api.login(username, password);
      setToken(access_token);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen min-h-[100dvh] flex-col items-center justify-center bg-navy-dark px-4 pt-safe pb-safe">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold">Household</p>
          <h1 className="font-display text-3xl font-extrabold text-white">Home Inventory</h1>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow-2xl">
          <label className="mb-1 block text-sm font-semibold text-ink-soft">Username</label>
          <input
            className="focus-ring mb-4 w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-ink"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />

          <label className="mb-1 block text-sm font-semibold text-ink-soft">Password</label>
          <input
            type="password"
            className="focus-ring mb-4 w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-ink"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          {error && <p className="mb-4 text-sm font-medium text-danger">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="focus-ring w-full rounded-lg bg-navy py-2.5 font-semibold text-white transition hover:bg-navy-light disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
