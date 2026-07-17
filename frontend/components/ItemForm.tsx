"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ItemOut, CategoryOut, RoomOut } from "@/lib/api";

const UNIT_TYPES = ["pieces", "kg", "g", "l", "ml", "packs", "bottles", "cans", "boxes"];

export default function ItemForm({ existing }: { existing?: ItemOut }) {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryOut[]>([]);
  const [rooms, setRooms] = useState<RoomOut[]>([]);
  const [name, setName] = useState(existing?.name ?? "");
  const [brand, setBrand] = useState(existing?.brand ?? "");
  const [categoryId, setCategoryId] = useState<string>(existing?.category_id?.toString() ?? "");
  const [roomId, setRoomId] = useState<string>(existing?.room_id?.toString() ?? "");
  const [unitType, setUnitType] = useState(existing?.unit_type ?? "pieces");
  const [reorderThreshold, setReorderThreshold] = useState(existing?.reorder_threshold?.toString() ?? "5");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Initial batch fields (only shown when creating a new item)
  const [addInitialBatch, setAddInitialBatch] = useState(!existing);
  const [packQuantity, setPackQuantity] = useState("1");
  const [unitsPerPack, setUnitsPerPack] = useState("1");
  const [unitPrice, setUnitPrice] = useState("0");
  const [expiryDate, setExpiryDate] = useState("");

  useEffect(() => {
    api.listCategories().then(setCategories).catch(() => {});
    api.listRooms().then(setRooms).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        name,
        brand,
        category_id: categoryId ? Number(categoryId) : null,
        room_id: roomId ? Number(roomId) : null,
        unit_type: unitType,
        reorder_threshold: Number(reorderThreshold),
        description,
      };

      if (existing) {
        await api.updateItem(existing.id, payload);
        router.push(`/items/${existing.id}`);
      } else {
        const created = await api.createItem(payload);
        if (addInitialBatch && Number(packQuantity) > 0) {
          await api.createBatch({
            item_id: created.id,
            purchase_date: new Date().toISOString().slice(0, 10),
            expiry_date: expiryDate || null,
            pack_quantity: Number(packQuantity),
            units_per_pack: Number(unitsPerPack),
            unit_price: Number(unitPrice),
          });
        }
        router.push(`/items/${created.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save item");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-xl bg-white p-5 shadow-card">
      <div>
        <label className="mb-1 block text-sm font-semibold text-ink-soft">Item name *</label>
        <input required className="focus-ring w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-ink" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold text-ink-soft">Brand</label>
        <input className="focus-ring w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-ink" value={brand} onChange={(e) => setBrand(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-ink-soft">Category</label>
          <select className="focus-ring w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-ink" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">— None —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-ink-soft">Room</label>
          <select className="focus-ring w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-ink" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="">— None —</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-ink-soft">Unit type</label>
          <select className="focus-ring w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-ink" value={unitType} onChange={(e) => setUnitType(e.target.value)}>
            {UNIT_TYPES.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-ink-soft">Reorder threshold</label>
          <input type="number" step="0.01" className="focus-ring w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-ink" value={reorderThreshold} onChange={(e) => setReorderThreshold(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold text-ink-soft">Description</label>
        <textarea className="focus-ring w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-ink" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      {!existing && (
        <div className="rounded-lg border border-border p-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-ink">
            <input type="checkbox" checked={addInitialBatch} onChange={(e) => setAddInitialBatch(e.target.checked)} />
            Record first stock purchase now
          </label>
          {addInitialBatch && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-soft">Pack quantity</label>
                <input type="number" step="0.01" className="focus-ring w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink" value={packQuantity} onChange={(e) => setPackQuantity(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-soft">Units per pack</label>
                <input type="number" step="0.01" className="focus-ring w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink" value={unitsPerPack} onChange={(e) => setUnitsPerPack(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-soft">Price per pack (₦)</label>
                <input type="number" step="0.01" className="focus-ring w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-soft">Expiry date (optional)</label>
                <input type="date" className="focus-ring w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm font-medium text-danger">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="focus-ring w-full rounded-lg bg-navy py-2.5 font-semibold text-white hover:bg-navy-light disabled:opacity-60"
      >
        {saving ? "Saving…" : existing ? "Save changes" : "Create item"}
      </button>
    </form>
  );
}
