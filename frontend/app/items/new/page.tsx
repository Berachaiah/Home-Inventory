"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken } from "@/lib/api";
import ItemForm from "@/components/ItemForm";

export default function NewItemPage() {
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) router.push("/login");
  }, [router]);

  return (
    <main className="mx-auto max-w-2xl px-4 pt-safe pb-10 md:px-8 md:py-10">
      <div className="mb-4 pt-6 md:pt-0">
        <Link href="/items" className="focus-ring text-sm font-semibold text-ink-soft hover:text-navy">← All Items</Link>
      </div>
      <header className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-soft">Inventory</p>
        <h1 className="font-display text-2xl font-extrabold text-navy-dark md:text-3xl">Add Item</h1>
      </header>
      <ItemForm />
    </main>
  );
}
