"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getToken, WithdrawalLogOut } from "@/lib/api";

export default function WithdrawalLogPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<WithdrawalLogOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    api.listWithdrawals().then(setLogs).catch((err) => setError(err instanceof Error ? err.message : "Couldn't load log"));
  }, [router]);

  const filtered = logs?.filter(
    (l) =>
      l.item_name.toLowerCase().includes(query.toLowerCase()) ||
      l.username.toLowerCase().includes(query.toLowerCase()) ||
      l.purpose.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <main className="mx-auto max-w-4xl px-4 pt-safe pb-10 md:px-8 md:py-10">
      <header className="mb-6 pt-6 md:pt-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-soft">Stock Movement</p>
        <h1 className="font-display text-2xl font-extrabold text-navy-dark md:text-3xl">📋 Withdrawal Log</h1>
      </header>

      <div className="mb-4 rounded-xl bg-white p-1 shadow-card">
        <input
          className="focus-ring w-full rounded-lg border-0 bg-transparent px-3 py-2.5 text-ink placeholder:text-ink-soft"
          placeholder="Search by item, person, or purpose…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {error && <p className="text-danger">{error}</p>}
      {!logs && !error && <p className="text-ink-soft">Loading…</p>}
      {filtered && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-white p-8 text-center text-ink-soft shadow-card">
          No withdrawals recorded yet.
        </div>
      )}

      {filtered && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-ink-soft">
                <th className="px-4 py-3 font-semibold">Date &amp; Time</th>
                <th className="px-4 py-3 font-semibold">Item</th>
                <th className="px-4 py-3 font-semibold">Qty Taken</th>
                <th className="px-4 py-3 font-semibold">Remaining</th>
                <th className="px-4 py-3 font-semibold">Taken By</th>
                <th className="px-4 py-3 font-semibold">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 text-ink-soft">{new Date(l.withdrawn_at).toLocaleString()}</td>
                  <td className="px-4 py-3 font-semibold text-ink">{l.item_name}</td>
                  <td className="px-4 py-3 font-mono font-semibold">{l.quantity_taken}</td>
                  <td className="px-4 py-3 font-mono text-ink-soft">{l.quantity_remaining_after}</td>
                  <td className="px-4 py-3">{l.username}</td>
                  <td className="px-4 py-3 text-ink-soft">{l.purpose || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
