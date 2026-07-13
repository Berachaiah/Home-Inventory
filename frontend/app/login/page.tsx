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
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-soft">Household</p>
          <h1 className="font-display text-3xl font-semibold text-ink">Home Inventory</h1>
        </div>

        <form onSubmit={handleSubmit} className="rounded border border-line bg-surface p-6 shadow-sm">
          <label className="mb-1 block text-sm font-medium text-ink-soft">Username</label>
          <input
            className="focus-ring mb-4 w-full rounded border border-line bg-bg px-3 py-2 text-ink"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />

          <label className="mb-1 block text-sm font-medium text-ink-soft">Password</label>
          <input
            type="password"
            className="focus-ring mb-4 w-full rounded border border-line bg-bg px-3 py-2 text-ink"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          {error && <p className="mb-4 text-sm text-out">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="focus-ring w-full rounded bg-accent py-2 font-medium text-white transition hover:bg-accent/90 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
