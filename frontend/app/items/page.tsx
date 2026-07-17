"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, getToken, ItemOut } from "@/lib/api";
import { useCurrentUser } from "@/lib/useCurrentUser";

const STATUS_BADGE: Record<string, string> = {
  out: "bg-danger-soft text-danger",
  low: "bg-warn-soft text-warn",
  moderate: "bg-navy/10 text-navy",
  good: "bg-good-soft text-good",
};

const STATUS_LABEL: Record<string, string> = {
  out: "Out of stock",
  low: "Running low",
  moderate: "Moderate",
  good: "Well stocked",
};

export default function ItemsListPage() {
  const router = useRouter();
  const { isManager } = useCurrentUser();
  const [items, setItems] = useState<ItemOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    api.listItems().then(setItems).catch((err) => setError(err instanceof Error ? err.message : "Couldn't load items"));
  }, [router]);

  const filtered = items?.filter((i) => {
    const matchesQuery = `${i.brand} ${i.name}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "low" && (i.stock_status === "low" || i.stock_status === "out")) ||
      i.stock_status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  return (
    <main className="mx-auto max-w-5xl px-4 pt-safe pb-10 md:px-8 md:py-10">
      <header className="mb-6 flex items-center justify-between pt-6 md:pt-0">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-soft">Inventory</p>
          <h1 className="font-display text-2xl font-extrabold text-navy-dark md:text-3xl">All Items</h1>
        </div>
        {isManager && (
          <Link href="/items/new" className="focus-ring rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light">
            ➕ Add Item
          </Link>
        )}
      </header>

      <div className="mb-4 flex flex-col gap-2 md:flex-row">
        <div className="flex-1 rounded-xl bg-white p-1 shadow-card">
          <input
            className="focus-ring w-full rounded-lg border-0 bg-transparent px-3 py-2.5 text-ink placeholder:text-ink-soft"
            placeholder="Search items…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className="focus-ring rounded-xl border border-border bg-white px-3 py-2.5 text-sm font-medium text-ink shadow-card"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="low">Low / Out of stock</option>
          <option value="moderate">Moderate</option>
          <option value="good">Well stocked</option>
        </select>
      </div>

      {error && <p className="text-danger">{error}</p>}
      {!items && !error && <p className="text-ink-soft">Loading items…</p>}

      {filtered && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-white p-8 text-center text-ink-soft shadow-card">
          No items match.
        </div>
      )}

      <ul className="space-y-2">
        {filtered?.map((item) => (
          <li key={item.id}>
            <Link
              href={`/items/${item.id}`}
              className={`shelf-tick status-${item.stock_status ?? "good"} flex items-center justify-between rounded-xl bg-white px-4 py-3.5 shadow-card hover:shadow-md transition`}
            >
              <div>
                <p className="font-semibold text-ink">{item.brand ? `${item.brand} — ${item.name}` : item.name}</p>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_BADGE[item.stock_status ?? "good"]}`}>
                  {STATUS_LABEL[item.stock_status ?? "good"]}
                </span>
              </div>
              <p className="font-mono text-lg font-bold text-navy-dark">
                {item.total_quantity ?? 0}
                <span className="ml-1 text-xs font-medium text-ink-soft">{item.unit_type}</span>
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
