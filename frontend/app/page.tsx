"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  api,
  getToken,
  ItemOut,
  BatchOut,
  WithdrawalLogOut,
  RestockPlanOut,
} from "@/lib/api";
import { useCurrentUser } from "@/lib/useCurrentUser";

type ExpiringBatch = BatchOut & { item_name: string };

function stockBadge(status: ItemOut["stock_status"]) {
  switch (status) {
    case "out":
      return { label: "Out", cls: "bg-red-100 text-red-700" };
    case "low":
      return { label: "Low", cls: "bg-amber-100 text-amber-700" };
    case "moderate":
      return { label: "Moderate", cls: "bg-sky-100 text-sky-700" };
    case "good":
      return { label: "Good", cls: "bg-emerald-100 text-emerald-700" };
    default:
      return { label: "—", cls: "bg-bg text-ink-soft" };
  }
}

function expiryBadge(status: string | null) {
  switch (status) {
    case "warning":
      return { label: "Warning", cls: "bg-amber-50 text-amber-600" };
    case "critical":
      return { label: "Critical", cls: "bg-amber-100 text-amber-700" };
    case "expired":
      return { label: "Expired", cls: "bg-red-100 text-red-700" };
    default:
      return { label: "—", cls: "bg-bg text-ink-soft" };
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isManager, isAdmin, loading: userLoading } = useCurrentUser();

  const [items, setItems] = useState<ItemOut[] | null>(null);
  const [expiringBatches, setExpiringBatches] = useState<ExpiringBatch[]>([]);
  const [expiredCount, setExpiredCount] = useState(0);
  const [withdrawals, setWithdrawals] = useState<WithdrawalLogOut[] | null>(null);
  const [plans, setPlans] = useState<RestockPlanOut[] | null>(null);
  const [restockCost, setRestockCost] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [itemList, withdrawalList, planList] = await Promise.all([
        api.listItems(),
        api.listWithdrawals(),
        api.listRestockPlans(),
      ]);
      setItems(itemList);
      setWithdrawals(withdrawalList);
      setPlans(planList);

      // Gather batches for items flagged as warning/critical/expired
      const flagged = itemList.filter(
        (i) => i.expiry_status && i.expiry_status !== "none" && i.expiry_status !== "ok"
      );
      const batchLists = await Promise.all(flagged.map((i) => api.listBatches(i.id)));

      const soon: ExpiringBatch[] = [];
      let expired = 0;
      batchLists.forEach((batches, idx) => {
        const itemName = flagged[idx].name;
        batches
          .filter((b) => b.is_active)
          .forEach((b) => {
            if (b.expiry_status === "expired") expired += 1;
            else if (b.expiry_status === "warning" || b.expiry_status === "critical") {
              soon.push({ ...b, item_name: itemName });
            }
          });
      });
      soon.sort((a, b) => (a.expiry_date ?? "").localeCompare(b.expiry_date ?? ""));
      setExpiringBatches(soon);
      setExpiredCount(expired);

      // Approximate restock cost for low/out items using latest active batch price
      const lowOrOut = itemList.filter((i) => i.stock_status === "low" || i.stock_status === "out");
      const lowBatchLists = await Promise.all(lowOrOut.map((i) => api.listBatches(i.id)));
      let cost = 0;
      lowOrOut.forEach((item, idx) => {
        const activeBatches = lowBatchLists[idx].filter((b) => b.is_active && b.remaining_units && b.remaining_units > 0);
        const latest = [...lowBatchLists[idx]].sort((a, b) => b.purchase_date.localeCompare(a.purchase_date))[0];
        const unitPrice =
          latest && latest.units_per_pack > 0 ? latest.unit_price / latest.units_per_pack : 0;
        const needed = Math.max(0, item.reorder_threshold - (item.total_quantity ?? 0));
        cost += needed * unitPrice;
        void activeBatches;
      });
      setRestockCost(cost);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load dashboard");
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    load();
  }, [router, load]);

  const totalItems = items?.length ?? 0;
  const lowStockItems = items?.filter((i) => i.stock_status === "low" || i.stock_status === "out") ?? [];
  const lowStockCount = lowStockItems.length;
  const recentWithdrawals = withdrawals?.slice(0, 5) ?? [];
  const activePlan = plans?.find((p) => p.status !== "done") ?? null;

  const expiryCardTone =
    expiredCount > 0 ? "bg-red-100 text-red-600" : expiringBatches.length > 0 ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600";
  const lowStockCardTone = lowStockCount > 0 ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600";

  return (
    <main className="mx-auto max-w-5xl px-4 pt-safe pb-10 md:px-8 md:py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 pt-6 md:pt-0">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-soft">Dashboard</p>
          <h1 className="font-display text-2xl font-extrabold text-navy-dark md:text-3xl">
            Welcome back, {userLoading ? "…" : user ? (user.first_name || user.username) : "there"}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/withdraw"
            className="focus-ring rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
          >
            🛒 Take Item
          </Link>
          {isManager && (
            <Link
              href="/items/new"
              className="focus-ring rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
            >
              ➕ Add Item
            </Link>
          )}
        </div>
      </header>

      <div className="mb-5 rounded-xl bg-sky-50 border border-sky-100 px-4 py-3 text-sm text-ink">
        📊 <strong>Your store at a glance.</strong> This dashboard shows everything important — items running low,
        products expiring soon, and who has been taking things from the store. Check here daily to stay on top of
        your inventory.
      </div>

      {isManager && activePlan && (
        <div className="mb-5 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-ink">
          🛍️ <strong>Active Restock Plan:</strong> &quot;{activePlan.name}&quot; is currently{" "}
          <strong>{activePlan.status}</strong> with {activePlan.items.length} item
          {activePlan.items.length !== 1 ? "s" : ""}.{" "}
          <Link href={`/restock/${activePlan.id}`} className="font-bold text-amber-700 hover:underline">
            Open Plan →
          </Link>
        </div>
      )}

      {error && <p className="mb-4 text-sm font-medium text-danger">{error}</p>}

      <div className={`mb-6 grid grid-cols-2 gap-4 ${isAdmin ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        <div className="rounded-xl bg-white p-5 shadow-card">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-navy-dark/10 text-lg">📦</div>
          <div className="font-mono text-2xl font-extrabold text-navy-dark">{totalItems}</div>
          <div className="text-sm text-ink-soft">Total Items Tracked</div>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-card">
          <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg text-lg ${lowStockCardTone}`}>⚠️</div>
          <div className="font-mono text-2xl font-extrabold text-navy-dark">{lowStockCount}</div>
          <div className="text-sm text-ink-soft">Low / Out of Stock</div>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-card">
          <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg text-lg ${expiryCardTone}`}>📅</div>
          <div className="font-mono text-2xl font-extrabold text-navy-dark">{expiringBatches.length}</div>
          <div className="text-sm text-ink-soft">Expiring Within 30 Days</div>
        </div>
        {isAdmin && (
          <div className="rounded-xl bg-white p-5 shadow-card">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-lg text-amber-600">💰</div>
            <div className="font-mono text-2xl font-extrabold text-navy-dark">₦{Math.round(restockCost).toLocaleString()}</div>
            <div className="text-sm text-ink-soft">Est. Restock Cost</div>
          </div>
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Expiring Soon */}
        <div className="rounded-xl bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <span className="font-semibold text-navy-dark">⏳ Expiring Soon</span>
            <Link href="/items" className="focus-ring rounded-lg border border-border px-3 py-1 text-xs font-semibold hover:bg-bg">
              View All
            </Link>
          </div>
          {expiringBatches.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-ink-soft">
                    <th className="px-4 py-2.5 font-semibold">Item</th>
                    <th className="px-4 py-2.5 font-semibold">Batch</th>
                    <th className="px-4 py-2.5 font-semibold">Expiry</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {expiringBatches.map((b) => {
                    const badge = expiryBadge(b.expiry_status);
                    return (
                      <tr key={b.id} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-2.5">
                          <Link href={`/items/${b.item_id}`} className="font-semibold text-navy hover:underline">
                            {b.item_name}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-ink-soft">#{b.id}</td>
                        <td className="px-4 py-2.5">{b.expiry_date}</td>
                        <td className="px-4 py-2.5">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-ink-soft">
              <div className="mb-2 text-3xl">✅</div>
              <p>No items expiring soon.</p>
            </div>
          )}
          {expiredCount > 0 && (
            <div className="m-4 mt-0 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
              ❌ <strong>{expiredCount} batch{expiredCount !== 1 ? "es" : ""} already expired</strong> — check your inventory.
            </div>
          )}
        </div>

        {/* Low Stock Items */}
        <div className="rounded-xl bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <span className="font-semibold text-navy-dark">📉 Low Stock Items</span>
            <Link href="/items" className="focus-ring rounded-lg border border-border px-3 py-1 text-xs font-semibold hover:bg-bg">
              View All
            </Link>
          </div>
          {lowStockItems.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-ink-soft">
                    <th className="px-4 py-2.5 font-semibold">Item</th>
                    <th className="px-4 py-2.5 font-semibold">Stock</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockItems.map((i) => {
                    const badge = stockBadge(i.stock_status);
                    return (
                      <tr key={i.id} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-2.5">
                          <Link href={`/items/${i.id}`} className="font-semibold text-navy hover:underline">
                            {i.name}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5">
                          {i.total_quantity ?? 0} {i.unit_type}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-ink-soft">
              <div className="mb-2 text-3xl">✅</div>
              <p>All items well stocked.</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Withdrawals */}
      <div className="rounded-xl bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <span className="font-semibold text-navy-dark">🕐 Recent Withdrawals</span>
          <Link href="/withdrawals" className="focus-ring rounded-lg border border-border px-3 py-1 text-xs font-semibold hover:bg-bg">
            Full Log
          </Link>
        </div>
        {recentWithdrawals.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-soft">
                  <th className="px-4 py-2.5 font-semibold">Date &amp; Time</th>
                  <th className="px-4 py-2.5 font-semibold">Item</th>
                  <th className="px-4 py-2.5 font-semibold">Batch</th>
                  <th className="px-4 py-2.5 font-semibold">Qty Taken</th>
                  <th className="px-4 py-2.5 font-semibold">Remaining</th>
                  <th className="px-4 py-2.5 font-semibold">Taken By</th>
                  <th className="px-4 py-2.5 font-semibold">Purpose</th>
                </tr>
              </thead>
              <tbody>
                {recentWithdrawals.map((w) => (
                  <tr key={w.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2.5 text-sm text-ink-soft">{new Date(w.withdrawn_at).toLocaleString()}</td>
                    <td className="px-4 py-2.5 font-semibold text-ink">{w.item_name}</td>
                    <td className="px-4 py-2.5 text-ink-soft">#{w.batch_id}</td>
                    <td className="px-4 py-2.5 font-semibold">{w.quantity_taken}</td>
                    <td className="px-4 py-2.5 text-ink-soft">{w.quantity_remaining_after}</td>
                    <td className="px-4 py-2.5">{w.username}</td>
                    <td className="px-4 py-2.5 text-ink-soft">{w.purpose || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-ink-soft">
            <div className="mb-2 text-3xl">📋</div>
            <p>No withdrawals recorded yet.</p>
          </div>
        )}
      </div>
    </main>
  );
}