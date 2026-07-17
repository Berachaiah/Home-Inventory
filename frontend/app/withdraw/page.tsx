"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, getToken, ItemOut } from "@/lib/api";

export default function WithdrawPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-xl px-4 py-10"><p className="text-ink-soft">Loading…</p></main>}>
      <WithdrawForm />
    </Suspense>
  );
}

function WithdrawForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedItem = searchParams.get("item");

  const [items, setItems] = useState<ItemOut[] | null>(null);
  const [itemId, setItemId] = useState(preselectedItem ?? "");
  const [quantity, setQuantity] = useState("1");
  const [purpose, setPurpose] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    api.listItems().then(setItems).catch((err) => setError(err instanceof Error ? err.message : "Couldn't load items"));
  }, [router]);

  const selectedItem = items?.find((i) => i.id === Number(itemId));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!itemId) return;
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      await api.withdrawStock({ item_id: Number(itemId), quantity: Number(quantity), purpose });
      setSuccess(`Recorded: ${quantity} ${selectedItem?.unit_type ?? ""} of "${selectedItem?.name}" taken.`);
      setQuantity("1");
      setPurpose("");
      api.listItems().then(setItems).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't record withdrawal");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 pt-safe pb-10 md:px-8 md:py-10">
      <div className="mb-4 pt-6 md:pt-0">
        <Link href="/" className="focus-ring text-sm font-semibold text-ink-soft hover:text-navy">← Back to shelves</Link>
      </div>
      <header className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-soft">Stock Movement</p>
        <h1 className="font-display text-2xl font-extrabold text-navy-dark md:text-3xl">🛒 Take Item</h1>
        <p className="mt-1 text-sm text-ink-soft">Record something leaving the store. This keeps the inventory accurate.</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl bg-white p-5 shadow-card">
        <div>
          <label className="mb-1 block text-sm font-semibold text-ink-soft">Item *</label>
          <select
            required
            className="focus-ring w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-ink"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
          >
            <option value="">— Select an item —</option>
            {items?.map((i) => (
              <option key={i.id} value={i.id}>
                {i.brand ? `${i.brand} — ${i.name}` : i.name} ({i.total_quantity ?? 0} {i.unit_type} available)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-ink-soft">Quantity *</label>
          <input
            type="number"
            step="0.01"
            required
            className="focus-ring w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-ink"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          {selectedItem && <p className="mt-1 text-xs text-ink-soft">Unit: {selectedItem.unit_type}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-ink-soft">Purpose (optional)</label>
          <input
            className="focus-ring w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-ink"
            placeholder="e.g. dinner, cleaning, guest use"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
          />
        </div>

        {error && <p className="text-sm font-medium text-danger">{error}</p>}
        {success && <p className="rounded-lg bg-good-soft px-3 py-2 text-sm font-medium text-good">✅ {success}</p>}

        <button
          type="submit"
          disabled={saving || !itemId}
          className="focus-ring w-full rounded-lg bg-navy py-2.5 font-semibold text-white hover:bg-navy-light disabled:opacity-60"
        >
          {saving ? "Recording…" : "Take Item"}
        </button>
      </form>
    </main>
  );
}
