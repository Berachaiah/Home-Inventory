"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, getToken, RestockPlanOut, useIsAdmin } from "@/lib/api";

function statusBadge(status: RestockPlanOut["status"]) {
  if (status === "done") return { label: "✅ Completed", cls: "bg-emerald-100 text-emerald-700" };
  if (status === "shopping") return { label: "🛒 Shopping", cls: "bg-amber-100 text-amber-700" };
  return { label: "📝 Draft", cls: "bg-bg text-ink-soft" };
}

export default function RestockPlannerPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<RestockPlanOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = useIsAdmin();

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    api
      .listRestockPlans()
      .then(setPlans)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load plans"));
  }, [router]);

  async function handleDelete(id: number) {
    if (!confirm("Delete this restock plan?")) return;
    try {
      await api.deleteRestockPlan(id);
      setPlans((prev) => prev?.filter((p) => p.id !== id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete plan");
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 pt-safe pb-10 md:px-8 md:py-10">
      <header className="mb-6 flex items-center justify-between pt-6 md:pt-0">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-soft">Budget &amp; Restocking</p>
          <h1 className="font-display text-2xl font-extrabold text-navy-dark md:text-3xl">Restock Planner</h1>
        </div>
        <Link
          href="/restock/new"
          className="focus-ring rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
        >
          ➕ New Restock Plan
        </Link>
      </header>

      <div className="mb-5 rounded-xl bg-sky-50 border border-sky-100 px-4 py-3 text-sm text-ink">
        🛒 <strong>Plan your restocking trips.</strong> Create a plan, add the items you need to buy, set quantities and
        estimated prices, and get a total budget. When you return from shopping, mark each item as restocked and the
        system automatically updates the inventory.
      </div>

      {error && <p className="mb-3 text-sm font-medium text-danger">{error}</p>}
      {!plans && !error && <p className="text-ink-soft">Loading…</p>}

      {plans && plans.length === 0 && (
        <div className="rounded-xl bg-white p-14 text-center shadow-card">
          <div className="mb-3 text-4xl">🛒</div>
          <p className="mb-2 text-[15px] font-semibold">No restock plans yet</p>
          <p className="mb-5 text-ink-soft">
            Create a plan to track what needs buying, set your budget, and mark items off when you return from
            shopping.
          </p>
          <Link
            href="/restock/new"
            className="focus-ring inline-block rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
          >
            ➕ Create Your First Plan
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {plans?.map((p) => {
          const restockedCount = p.items.filter((i) => i.is_restocked).length;
          const pct = p.items.length ? Math.round((restockedCount / p.items.length) * 100) : 0;
          const badge = statusBadge(p.status);
          return (
            <div key={p.id} className="rounded-xl bg-white p-5 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="mb-1 flex items-center gap-2.5">
                    <Link href={`/restock/${p.id}`} className="text-base font-bold text-navy-dark hover:underline">
                      {p.name}
                    </Link>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
                  </div>
                  <div className="text-sm text-ink-soft">
                    Created {new Date(p.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    &nbsp;·&nbsp;{p.items.length} item{p.items.length !== 1 ? "s" : ""}
                    &nbsp;·&nbsp;{restockedCount} restocked
                  </div>
                  {p.notes && <div className="mt-1 text-sm text-ink-soft">{p.notes}</div>}
                </div>
                <div className="flex items-center gap-4">
                  {isAdmin && (
                    <div className="text-right">
                      <div className="font-mono text-xl font-extrabold text-navy-dark">
                        ₦{Math.round(p.total_estimated_cost ?? 0).toLocaleString()}
                      </div>
                      <div className="text-sm text-ink-soft">estimated total</div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Link
                      href={`/restock/${p.id}`}
                      className="focus-ring rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-light"
                    >
                      Open
                    </Link>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="focus-ring rounded-lg bg-danger px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              {p.items.length > 0 && (
                <div className="mt-3.5">
                  <div className="mb-1 flex justify-between">
                    <span className="text-sm text-ink-soft">Restock progress</span>
                    <span className="text-sm text-ink-soft">
                      {restockedCount}/{p.items.length} items restocked
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded bg-border">
                    <div className="h-full rounded bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}