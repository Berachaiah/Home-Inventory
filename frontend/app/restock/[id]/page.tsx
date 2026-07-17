"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, getToken, RestockPlanOut, ItemOut } from "@/lib/api";

export default function RestockPlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const planId = Number(params.id);

  const [plan, setPlan] = useState<RestockPlanOut | null>(null);
  const [items, setItems] = useState<ItemOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [selectedItem, setSelectedItem] = useState("");
  const [packs, setPacks] = useState(1);
  const [unitsPerPack, setUnitsPerPack] = useState(1);
  const [price, setPrice] = useState(0);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.getRestockPlan(planId).then(setPlan).catch((err) => setError(err instanceof Error ? err.message : "Couldn't load plan"));
    api.listItems().then(setItems).catch(() => {});
  }, [planId]);

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    load();
  }, [router, load]);

  function itemName(id: number) {
    return items.find((i) => i.id === id)?.name ?? `Item #${id}`;
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItem) return;
    setSaving(true);
    setError(null);
    try {
      await api.addRestockPlanItem(planId, {
        item_id: Number(selectedItem),
        packs_to_buy: packs,
        units_per_pack: unitsPerPack,
        estimated_price_per_pack: price,
      });
      setSelectedItem("");
      setPacks(1);
      setUnitsPerPack(1);
      setPrice(0);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add item");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveItem(planItemId: number) {
    if (!confirm("Remove this item from the plan?")) return;
    try {
      await api.deleteRestockPlanItem(planItemId);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove item");
    }
  }

  async function handleMarkRestocked(planItemId: number, estimatedPrice: number) {
    const input = prompt("Actual price paid per pack:", String(estimatedPrice));
    if (input === null) return;
    const actual = Number(input);
    if (Number.isNaN(actual)) return;
    try {
      await api.markRestocked(planItemId, actual);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't mark restocked");
    }
  }

  async function handleStatusChange(status: string) {
    try {
      await api.updateRestockPlanStatus(planId, status);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update status");
    }
  }

  if (!plan && !error) return <main className="p-8 text-ink-soft">Loading…</main>;
  if (error && !plan) return <main className="p-8 text-danger">{error}</main>;
  if (!plan) return null;

  return (
    <main className="mx-auto max-w-4xl px-4 pt-safe pb-10 md:px-8 md:py-10">
      <Link href="/restock" className="mb-3 inline-block text-sm font-semibold text-navy hover:underline">
        ← All Restock Plans
      </Link>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-soft">Planning</p>
          <h1 className="font-display text-2xl font-extrabold text-navy-dark md:text-3xl">{plan.name}</h1>
        </div>
        <select
          value={plan.status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="focus-ring rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold uppercase"
        >
          <option value="draft">Draft</option>
          <option value="shopping">Shopping</option>
          <option value="done">Done</option>
        </select>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-white p-4 shadow-card">
          <p className="text-xs text-ink-soft">Estimated total</p>
          <p className="font-mono text-xl font-bold text-navy-dark">₦{Number(plan.total_estimated_cost ?? 0).toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-card">
          <p className="text-xs text-ink-soft">Actual spent so far</p>
          <p className="font-mono text-xl font-bold text-navy-dark">₦{Number(plan.total_restocked_cost ?? 0).toLocaleString()}</p>
        </div>
      </div>

      {error && <p className="mb-3 text-sm font-medium text-danger">{error}</p>}

      <form onSubmit={handleAddItem} className="mb-6 grid grid-cols-2 gap-3 rounded-xl bg-white p-4 shadow-card md:grid-cols-5">
        <select
          className="focus-ring col-span-2 rounded-lg border border-border bg-bg px-3 py-2 text-ink md:col-span-1"
          value={selectedItem}
          onChange={(e) => setSelectedItem(e.target.value)}
        >
          <option value="">— Select item —</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          className="focus-ring rounded-lg border border-border bg-bg px-3 py-2 text-ink"
          placeholder="Packs"
          value={packs}
          onChange={(e) => setPacks(Number(e.target.value))}
        />
        <input
          type="number"
          min={1}
          className="focus-ring rounded-lg border border-border bg-bg px-3 py-2 text-ink"
          placeholder="Units/pack"
          value={unitsPerPack}
          onChange={(e) => setUnitsPerPack(Number(e.target.value))}
        />
        <input
          type="number"
          min={0}
          className="focus-ring rounded-lg border border-border bg-bg px-3 py-2 text-ink"
          placeholder="Est. price/pack (₦)"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
        />
        <button
          type="submit"
          disabled={saving || !selectedItem}
          className="focus-ring rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
        >
          Add
        </button>
      </form>

      {plan.items.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-white p-8 text-center text-ink-soft shadow-card">
          No items in this plan yet — add one above.
        </div>
      )}

      <div className="space-y-2">
        {plan.items.map((it) => (
          <div key={it.id} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-card">
            <div>
              <p className="font-semibold text-ink">{itemName(it.item_id)}</p>
              <p className="text-sm text-ink-soft">
                {it.packs_to_buy} packs × {it.units_per_pack} units @ ₦{it.estimated_price_per_pack.toLocaleString()}/pack
              </p>
            </div>
            <div className="flex items-center gap-2">
              {it.is_restocked ? (
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  ✅ Restocked
                </span>
              ) : (
                <button
                  onClick={() => handleMarkRestocked(it.id, it.estimated_price_per_pack)}
                  className="focus-ring rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Mark Restocked
                </button>
              )}
              <button
                onClick={() => handleRemoveItem(it.id)}
                className="focus-ring rounded-lg px-3 py-1.5 text-sm font-semibold text-danger hover:bg-danger-soft"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
