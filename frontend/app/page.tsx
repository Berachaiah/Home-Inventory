"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, getToken, clearToken, ItemOut } from "@/lib/api";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

const STATUS_LABEL: Record<string, string> = {
  out: "Out of stock",
  low: "Running low",
  moderate: "Moderate",
  good: "Well stocked",
};

const EXPIRY_LABEL: Record<string, string> = {
  expired: "Expired",
  critical: "Expires within 7 days",
  warning: "Expires within 30 days",
};

export default function DashboardPage() {
  const router = useRouter();
  const [items, setItems] = useState<ItemOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [notifStatus, setNotifStatus] = useState<"idle" | "enabling" | "enabled" | "unsupported" | "denied">("idle");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setNotifStatus("unsupported");
    } else if (Notification.permission === "granted") {
      setNotifStatus("enabled");
    } else if (Notification.permission === "denied") {
      setNotifStatus("denied");
    }
  }, []);

  async function enableNotifications() {
    setNotifStatus("enabling");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setNotifStatus(permission === "denied" ? "denied" : "idle");
        return;
      }
      const { public_key } = await api.getVapidPublicKey();
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(public_key),
      });
      await api.subscribePush(subscription.toJSON() as any);
      setNotifStatus("enabled");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't enable notifications");
      setNotifStatus("idle");
    }
  }

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    api
      .listItems()
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load items"));
  }, [router]);

  const filtered = items?.filter((i) =>
    `${i.brand} ${i.name}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-soft">Household</p>
          <h1 className="font-display text-3xl font-semibold text-ink">Home Inventory</h1>
        </div>
        <div className="flex gap-3">
          {notifStatus !== "unsupported" && notifStatus !== "enabled" && notifStatus !== "denied" && (
            <button
              onClick={enableNotifications}
              disabled={notifStatus === "enabling"}
              className="focus-ring rounded border border-line px-4 py-2 text-sm text-ink-soft hover:text-ink disabled:opacity-60"
            >
              {notifStatus === "enabling" ? "Enabling…" : "Enable alerts"}
            </button>
          )}
          <Link
            href="/assistant"
            className="focus-ring rounded border border-accent px-4 py-2 text-sm font-medium text-accent hover:bg-accent-soft"
          >
            Ask the assistant
          </Link>
          <button
            onClick={() => {
              clearToken();
              router.push("/login");
            }}
            className="focus-ring rounded px-3 py-2 text-sm text-ink-soft hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </header>

      <input
        className="focus-ring mb-6 w-full rounded border border-line bg-surface px-3 py-2 text-ink"
        placeholder="Search items…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {error && <p className="text-out">{error}</p>}
      {!items && !error && <p className="text-ink-soft">Loading the shelves…</p>}

      {filtered && filtered.length === 0 && (
        <p className="rounded border border-dashed border-line p-6 text-center text-ink-soft">
          Nothing here yet. Add your first item to start tracking stock.
        </p>
      )}

      <ul className="space-y-2">
        {filtered?.map((item) => (
          <li
            key={item.id}
            className={`shelf-tick status-${item.stock_status ?? "good"} flex items-center justify-between rounded bg-surface px-4 py-3 shadow-sm`}
          >
            <div>
              <p className="font-medium text-ink">
                {item.brand ? `${item.brand} — ${item.name}` : item.name}
              </p>
              <p className="text-sm text-ink-soft">
                {STATUS_LABEL[item.stock_status ?? "good"]}
                {item.expiry_status && EXPIRY_LABEL[item.expiry_status] && (
                  <span className="text-warn"> · {EXPIRY_LABEL[item.expiry_status]}</span>
                )}
              </p>
            </div>
            <p className="font-mono text-lg text-ink">
              {item.total_quantity ?? 0}
              <span className="ml-1 text-xs text-ink-soft">{item.unit_type}</span>
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
