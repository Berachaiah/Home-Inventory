"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/api";
import { useCurrentUser } from "@/lib/useCurrentUser";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ReportsPage() {
  const router = useRouter();
  const { isManager, loading } = useCurrentUser();
  const [period, setPeriod] = useState("month");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [format, setFormat] = useState<"pdf" | "excel">("pdf");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) router.push("/login");
  }, [router]);

  useEffect(() => {
    if (!loading && !isManager) router.push("/");
  }, [loading, isManager, router]);

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ format, period });
      if (period === "custom") {
        if (!dateFrom || !dateTo) throw new Error("Pick both dates for a custom range");
        params.set("date_from", dateFrom);
        params.set("date_to", dateTo);
      }
      const res = await fetch(`${API_BASE}/api/reports/generate?${params.toString()}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(body.detail || "Couldn't generate report");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="(.+)"/);
      const filename = match ? match[1] : `report.${format === "excel" ? "xlsx" : "pdf"}`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate report");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 pt-safe pb-10 md:px-8 md:py-10">
      <header className="mb-6 pt-6 md:pt-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-soft">Household</p>
        <h1 className="font-display text-2xl font-extrabold text-navy-dark md:text-3xl">📊 Reports</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Generates a 4-part report: inventory snapshot, withdrawal history, expiry report, and restock estimate.
        </p>
      </header>

      <div className="space-y-5 rounded-xl bg-white p-5 shadow-card">
        <div>
          <label className="mb-1 block text-sm font-semibold text-ink-soft">Period</label>
          <select className="focus-ring w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-ink" value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="week">Last 7 days</option>
            <option value="month">This month</option>
            <option value="3months">Last 3 months</option>
            <option value="custom">Custom range</option>
          </select>
        </div>

        {period === "custom" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-semibold text-ink-soft">From</label>
              <input type="date" className="focus-ring w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-ink" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-ink-soft">To</label>
              <input type="date" className="focus-ring w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-ink" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-semibold text-ink-soft">Format</label>
          <div className="flex gap-2">
            <button
              onClick={() => setFormat("pdf")}
              className={`focus-ring flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${format === "pdf" ? "bg-navy text-white" : "border border-border text-ink-soft"}`}
            >
              📄 PDF
            </button>
            <button
              onClick={() => setFormat("excel")}
              className={`focus-ring flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${format === "excel" ? "bg-navy text-white" : "border border-border text-ink-soft"}`}
            >
              📊 Excel
            </button>
          </div>
        </div>

        {error && <p className="text-sm font-medium text-danger">{error}</p>}

        <button
          onClick={handleDownload}
          disabled={downloading}
          className="focus-ring w-full rounded-lg bg-navy py-2.5 font-semibold text-white hover:bg-navy-light disabled:opacity-60"
        >
          {downloading ? "Generating…" : "Download Report"}
        </button>
      </div>
    </main>
  );
}
