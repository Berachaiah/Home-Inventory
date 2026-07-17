"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, getToken, PendingAction } from "@/lib/api";

type Message = {
  role: "user" | "assistant";
  content: string;
  pendingAction?: PendingAction | null;
  actionResolved?: "confirmed" | "declined";
};

export default function AssistantPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Ask me about stock levels, what's expiring, or tell me to log a withdrawal or start a restock plan.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!getToken()) router.push("/login");
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);
    try {
      const res = await api.chat(text, history);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.reply, pendingAction: res.pending_action },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The assistant didn't respond");
    } finally {
      setLoading(false);
    }
  }

  async function resolveAction(index: number, confirmed: boolean) {
    const message = messages[index];
    if (!message.pendingAction) return;

    if (!confirmed) {
      setMessages((prev) =>
        prev.map((m, i) => (i === index ? { ...m, actionResolved: "declined" } : m))
      );
      return;
    }

    try {
      await api.executeAction(message.pendingAction.action_type, message.pendingAction.params);
      setMessages((prev) => [
        ...prev.map((m, i) => (i === index ? { ...m, actionResolved: "confirmed" as const } : m)),
        { role: "assistant" as const, content: "Done — that's been applied." },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Couldn't complete that: ${err instanceof Error ? err.message : "unknown error"}`,
        },
      ]);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen min-h-[100dvh] max-w-2xl flex-col px-4 pt-safe pb-4 md:py-8">
      <header className="mb-4 flex items-center justify-between pt-6 md:pt-0">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-soft">Household</p>
          <h1 className="font-display text-xl font-extrabold text-navy-dark md:text-2xl">Store Assistant</h1>
        </div>
        <Link href="/" className="focus-ring hidden text-sm font-semibold text-ink-soft hover:text-navy md:block">
          ← Back to shelves
        </Link>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-xl bg-white p-4 shadow-card">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <div
              className={`inline-block max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                m.role === "user"
                  ? "rounded-br-sm bg-navy text-white"
                  : "rounded-bl-sm border border-border bg-bg text-ink"
              }`}
            >
              {m.content}
            </div>

            {m.pendingAction && !m.actionResolved && (
              <div className="mt-2 flex justify-start gap-2">
                <button
                  onClick={() => resolveAction(i, true)}
                  className="focus-ring rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-navy-dark hover:bg-gold-light"
                >
                  Confirm
                </button>
                <button
                  onClick={() => resolveAction(i, false)}
                  className="focus-ring rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-ink-soft hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            )}
            {m.actionResolved === "declined" && (
              <p className="mt-1 text-xs text-ink-soft">Cancelled — nothing changed.</p>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && <p className="mt-2 text-sm font-medium text-danger">{error}</p>}

      <div className="mt-3 flex gap-2 pb-safe">
        <input
          className="focus-ring flex-1 rounded-xl border border-border bg-white px-3 py-2.5 text-ink shadow-card"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="e.g. what's running low?"
          disabled={loading}
        />
        <button
          onClick={send}
          disabled={loading}
          className="focus-ring rounded-xl bg-navy px-4 py-2.5 font-semibold text-white hover:bg-navy-light disabled:opacity-60"
        >
          {loading ? "…" : "Send"}
        </button>
      </div>
    </main>
  );
}
