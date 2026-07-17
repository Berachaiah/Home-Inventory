"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, getToken, ItemOut } from "@/lib/api";
import ItemForm from "@/components/ItemForm";

export default function EditItemPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = Number(params.id);
  const [item, setItem] = useState<ItemOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    api.getItem(itemId).then(setItem).catch((err) => setError(err instanceof Error ? err.message : "Couldn't load item"));
  }, [itemId, router]);

  return (
    <main className="mx-auto max-w-2xl px-4 pt-safe pb-10 md:px-8 md:py-10">
      <div className="mb-4 pt-6 md:pt-0">
        <Link href={`/items/${itemId}`} className="focus-ring text-sm font-semibold text-ink-soft hover:text-navy">← Back to item</Link>
      </div>
      <header className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-soft">Inventory</p>
        <h1 className="font-display text-2xl font-extrabold text-navy-dark md:text-3xl">Edit Item</h1>
      </header>
      {error && <p className="text-danger">{error}</p>}
      {!item && !error && <p className="text-ink-soft">Loading…</p>}
      {item && <ItemForm existing={item} />}
    </main>
  );
}
