"use client";

import { useEffect, useState } from "react";

type Entry = { id: number; name: string; description: string };

export default function CatalogSettings({
  title,
  icon,
  list,
  create,
  remove,
}: {
  title: string;
  icon: string;
  list: () => Promise<Entry[]>;
  create: (payload: { name: string; description?: string }) => Promise<Entry>;
  remove: (id: number) => Promise<unknown>;
}) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    list().then(setEntries).catch((err) => setError(err instanceof Error ? err.message : "Couldn't load"));
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await create({ name, description });
      setName("");
      setDescription("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number, entryName: string) {
    if (!confirm(`Delete "${entryName}"?`)) return;
    try {
      await remove(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete");
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pt-safe pb-10 md:px-8 md:py-10">
      <header className="mb-6 pt-6 md:pt-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-soft">Settings</p>
        <h1 className="font-display text-2xl font-extrabold text-navy-dark md:text-3xl">{icon} {title}</h1>
      </header>

      <form onSubmit={handleCreate} className="mb-6 flex flex-col gap-3 rounded-xl bg-white p-4 shadow-card md:flex-row">
        <input
          className="focus-ring flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-ink"
          placeholder={`New ${title.toLowerCase().replace(/s$/, "")} name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="focus-ring flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-ink"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button
          type="submit"
          disabled={saving}
          className="focus-ring rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
        >
          Add
        </button>
      </form>

      {error && <p className="mb-3 text-sm font-medium text-danger">{error}</p>}
      {!entries && <p className="text-ink-soft">Loading…</p>}
      {entries && entries.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-white p-8 text-center text-ink-soft shadow-card">
          None yet — add your first one above.
        </div>
      )}

      <ul className="space-y-2">
        {entries?.map((e) => (
          <li key={e.id} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-card">
            <div>
              <p className="font-semibold text-ink">{e.name}</p>
              {e.description && <p className="text-sm text-ink-soft">{e.description}</p>}
            </div>
            <button
              onClick={() => handleDelete(e.id, e.name)}
              className="focus-ring rounded-lg px-3 py-1.5 text-sm font-semibold text-danger hover:bg-danger-soft"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
