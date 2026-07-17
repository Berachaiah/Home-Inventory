"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, getToken, ItemOut, BatchOut, WithdrawalLogOut } from "@/lib/api";
import { useCurrentUser } from "@/lib/useCurrentUser";

type BatchFormState = {
  purchase_date: string;
  expiry_date: string;
  pack_quantity: string;
  units_per_pack: string;
  unit_price: string;
  notes: string;
};

const emptyBatchForm: BatchFormState = {
  purchase_date: new Date().toISOString().slice(0, 10),
  expiry_date: "",
  pack_quantity: "1",
  units_per_pack: "1",
  unit_price: "0",
  notes: "",
};

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = Number(params.id);
  const { isManager } = useCurrentUser();

  const [item, setItem] = useState<ItemOut | null>(null);
  const [batches, setBatches] = useState<BatchOut[] | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalLogOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [showAddBatch, setShowAddBatch] = useState(false);
  const [addForm, setAddForm] = useState<BatchFormState>(emptyBatchForm);
  const [editingBatchId, setEditingBatchId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<BatchFormState>(emptyBatchForm);

  function load() {
    Promise.all([api.getItem(itemId), api.listBatches(itemId), api.listWithdrawals(itemId)])
      .then(([i, b, w]) => {
        setItem(i);
        setBatches(b);
        setWithdrawals(w);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load item"));
  }

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, router]);

  async function handleDelete() {
    if (!confirm(`Delete "${item?.name}"? This can't be undone.`)) return;
    setDeleting(true);
    try {
      await api.deleteItem(itemId);
      router.push("/items");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete item");
      setDeleting(false);
    }
  }

  async function handleAddBatch(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.createBatch({
        item_id: itemId,
        purchase_date: addForm.purchase_date,
        expiry_date: addForm.expiry_date || null,
        pack_quantity: Number(addForm.pack_quantity),
        units_per_pack: Number(addForm.units_per_pack),
        unit_price: Number(addForm.unit_price),
        notes: addForm.notes,
      });
      setShowAddBatch(false);
      setAddForm(emptyBatchForm);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add batch");
    }
  }

  function startEdit(b: BatchOut) {
    setEditingBatchId(b.id);
    setEditForm({
      purchase_date: b.purchase_date,
      expiry_date: b.expiry_date ?? "",
      pack_quantity: String(b.pack_quantity),
      units_per_pack: String(b.units_per_pack),
      unit_price: String(b.unit_price),
      notes: b.notes,
    });
  }

  async function handleUpdateBatch(e: React.FormEvent) {
    e.preventDefault();
    if (editingBatchId == null) return;
    try {
      await api.updateBatch(editingBatchId, {
        item_id: itemId,
        purchase_date: editForm.purchase_date,
        expiry_date: editForm.expiry_date || null,
        pack_quantity: Number(editForm.pack_quantity),
        units_per_pack: Number(editForm.units_per_pack),
        unit_price: Number(editForm.unit_price),
        notes: editForm.notes,
      });
      setEditingBatchId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update batch");
    }
  }

  async function handleDeleteBatch(id: number) {
    if (!confirm("Remove this batch? This can't be undone.")) return;
    try {
      await api.deleteBatch(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete batch");
    }
  }

  if (error) return <main className="mx-auto max-w-3xl px-4 py-10"><p className="text-danger">{error}</p></main>;
  if (!item) return <main className="mx-auto max-w-3xl px-4 py-10"><p className="text-ink-soft">Loading…</p></main>;

  return (
    <main className="mx-auto max-w-3xl px-4 pt-safe pb-10 md:px-8 md:py-10">
      <div className="mb-4 pt-6 md:pt-0">
        <Link href="/items" className="focus-ring text-sm font-semibold text-ink-soft hover:text-navy">← All Items</Link>
      </div>

      <header className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-soft">Item</p>
          <h1 className="font-display text-2xl font-extrabold text-navy-dark md:text-3xl">
            {item.brand ? `${item.brand} — ${item.name}` : item.name}
          </h1>
          {item.description && <p className="mt-1 text-sm text-ink-soft">{item.description}</p>}
        </div>
        {isManager && (
          <div className="flex gap-2">
            <Link href={`/items/${item.id}/edit`} className="focus-ring rounded-lg border border-border px-3 py-2 text-sm font-semibold text-ink-soft hover:border-navy hover:text-navy">
              Edit
            </Link>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="focus-ring rounded-lg border border-danger/30 px-3 py-2 text-sm font-semibold text-danger hover:bg-danger-soft disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        )}
      </header>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-white p-4 shadow-card">
          <p className="font-mono text-xl font-bold text-navy-dark">{item.total_quantity ?? 0} <span className="text-xs font-medium text-ink-soft">{item.unit_type}</span></p>
          <p className="text-xs font-medium text-ink-soft">Current stock</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-card">
          <p className="font-mono text-xl font-bold text-navy-dark">{item.reorder_threshold}</p>
          <p className="text-xs font-medium text-ink-soft">Reorder threshold</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-card">
          <p className="font-mono text-xl font-bold text-navy-dark">{item.earliest_expiry ?? "—"}</p>
          <p className="text-xs font-medium text-ink-soft">Earliest expiry</p>
        </div>
      </div>

      <Link
        href={`/withdraw?item=${item.id}`}
        className="mb-6 inline-block focus-ring rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
      >
        🛒 Take this item
      </Link>

      <section className="mb-6 rounded-xl bg-white p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-navy-dark">Batches</h2>
          {isManager && (
            <button
              onClick={() => setShowAddBatch((s) => !s)}
              className="focus-ring rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-navy hover:text-navy"
            >
              {showAddBatch ? "Cancel" : "➕ Add batch"}
            </button>
          )}
        </div>

        {showAddBatch && (
          <form onSubmit={handleAddBatch} className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-border p-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">Purchase date</label>
              <input type="date" className="focus-ring w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-ink" value={addForm.purchase_date} onChange={(e) => setAddForm({ ...addForm, purchase_date: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">Expiry date (optional)</label>
              <input type="date" className="focus-ring w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-ink" value={addForm.expiry_date} onChange={(e) => setAddForm({ ...addForm, expiry_date: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">Pack quantity</label>
              <input type="number" step="0.01" className="focus-ring w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-ink" value={addForm.pack_quantity} onChange={(e) => setAddForm({ ...addForm, pack_quantity: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">Units per pack</label>
              <input type="number" step="0.01" className="focus-ring w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-ink" value={addForm.units_per_pack} onChange={(e) => setAddForm({ ...addForm, units_per_pack: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">Price per pack (₦)</label>
              <input type="number" step="0.01" className="focus-ring w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-ink" value={addForm.unit_price} onChange={(e) => setAddForm({ ...addForm, unit_price: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-semibold text-ink-soft">Notes</label>
              <input className="focus-ring w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-ink" value={addForm.notes} onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })} />
            </div>
            <button type="submit" className="col-span-2 focus-ring rounded-lg bg-navy py-2 text-sm font-semibold text-white hover:bg-navy-light">
              Save batch
            </button>
          </form>
        )}

        {batches && batches.length === 0 && <p className="text-sm text-ink-soft">No batches recorded yet.</p>}
        {batches && batches.length > 0 && (
          <div className="space-y-2">
            {batches.map((b) => (
              <div key={b.id} className="rounded-lg border border-border p-3">
                {editingBatchId === b.id ? (
                  <form onSubmit={handleUpdateBatch} className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-ink-soft">Purchase date</label>
                      <input type="date" className="focus-ring w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-ink" value={editForm.purchase_date} onChange={(e) => setEditForm({ ...editForm, purchase_date: e.target.value })} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-ink-soft">Expiry date</label>
                      <input type="date" className="focus-ring w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-ink" value={editForm.expiry_date} onChange={(e) => setEditForm({ ...editForm, expiry_date: e.target.value })} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-ink-soft">Pack quantity</label>
                      <input type="number" step="0.01" className="focus-ring w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-ink" value={editForm.pack_quantity} onChange={(e) => setEditForm({ ...editForm, pack_quantity: e.target.value })} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-ink-soft">Units per pack</label>
                      <input type="number" step="0.01" className="focus-ring w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-ink" value={editForm.units_per_pack} onChange={(e) => setEditForm({ ...editForm, units_per_pack: e.target.value })} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-ink-soft">Price per pack (₦)</label>
                      <input type="number" step="0.01" className="focus-ring w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-ink" value={editForm.unit_price} onChange={(e) => setEditForm({ ...editForm, unit_price: e.target.value })} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-ink-soft">Notes</label>
                      <input className="focus-ring w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-ink" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
                    </div>
                    <div className="col-span-2 flex gap-2">
                      <button type="submit" className="focus-ring flex-1 rounded-lg bg-navy py-2 text-sm font-semibold text-white hover:bg-navy-light">Save</button>
                      <button type="button" onClick={() => setEditingBatchId(null)} className="focus-ring flex-1 rounded-lg border border-border py-2 text-sm font-semibold text-ink-soft">Cancel</button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <p><span className="font-semibold text-ink">{b.purchase_date}</span> {b.expiry_date && <span className="text-ink-soft">→ expires {b.expiry_date}</span>}</p>
                      <p className="text-ink-soft">{b.remaining_units} / {b.total_units} remaining · ₦{b.total_cost?.toLocaleString()}</p>
                    </div>
                    {isManager && (
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(b)} className="focus-ring rounded-lg px-2 py-1 text-xs font-semibold text-ink-soft hover:text-navy">Edit</button>
                        <button onClick={() => handleDeleteBatch(b.id)} className="focus-ring rounded-lg px-2 py-1 text-xs font-semibold text-danger hover:bg-danger-soft">Delete</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl bg-white p-4 shadow-card">
        <h2 className="mb-3 font-display text-lg font-bold text-navy-dark">Withdrawal history</h2>
        {withdrawals && withdrawals.length === 0 && <p className="text-sm text-ink-soft">Nothing withdrawn yet.</p>}
        {withdrawals && withdrawals.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-soft">
                  <th className="pb-2 pr-3 font-semibold">Date</th>
                  <th className="pb-2 pr-3 font-semibold">Qty taken</th>
                  <th className="pb-2 pr-3 font-semibold">By</th>
                  <th className="pb-2 font-semibold">Purpose</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 text-ink-soft">{new Date(w.withdrawn_at).toLocaleString()}</td>
                    <td className="py-2 pr-3 font-mono font-semibold">{w.quantity_taken}</td>
                    <td className="py-2 pr-3">{w.username}</td>
                    <td className="py-2 text-ink-soft">{w.purpose || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
