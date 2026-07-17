"use client";

import { useEffect, useRef, useState } from "react";
import { api, ChatResponse } from "@/lib/api";
import { useCurrentUser } from "@/lib/useCurrentUser";

type Msg = { role: "user" | "bot"; content: string };

const SUGGESTIONS = ["What's low?", "What's expiring?", "Restock summary", "Recent withdrawals"];

export default function AiWidget() {
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [showBadge, setShowBadge] = useState(false);
  const [badgeDismissed, setBadgeDismissed] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [history, setHistory] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [typing, setTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([
      {
        role: "bot",
        content: `👋 Hi ${user?.first_name || user?.username || "there"}! I know everything about your inventory right now. Ask me what's running low, what's expiring, who took something — anything!`,
      },
    ]);
  }, [user]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!badgeDismissed && !open) setShowBadge(true);
    }, 3000);
    return () => clearTimeout(t);
  }, [badgeDismissed, open]);

  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages, typing]);

  function toggle() {
    setOpen((o) => {
      const next = !o;
      if (next) {
        setShowBadge(false);
        setBadgeDismissed(true);
      }
      return next;
    });
  }

  async function send(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text) return;
    setInput("");
    setShowSuggestions(false);
    setSending(true);
    setMessages((m) => [...m, { role: "user", content: text }]);
    const newHistory = [...history, { role: "user", content: text }];
    setTyping(true);

    try {
      const data: ChatResponse = await api.chat(text, newHistory.slice(-6));
      setTyping(false);
      const reply = data.reply || "Sorry, something went wrong. Try again.";
      setMessages((m) => [...m, { role: "bot", content: reply }]);
      setHistory([...newHistory, { role: "assistant", content: reply }].slice(-20));

      if (data.pending_action) {
        try {
          await api.executeAction(data.pending_action.action_type, data.pending_action.params);
        } catch {
          // executing pending action failed silently, same as leaving it unconfirmed
        }
      }
    } catch {
      setTyping(false);
      setMessages((m) => [...m, { role: "bot", content: "Connection error. Please try again." }]);
    } finally {
      setSending(false);
    }
  }

  if (!user) return null;

  return (
    <div className="fixed bottom-7 right-7 z-[9999] font-sans">
      {open && (
        <div className="absolute bottom-20 right-0 flex w-[360px] flex-col overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-2xl">
          <div className="flex items-center gap-2.5 bg-gradient-to-br from-navy-dark to-navy px-4.5 py-3.5" style={{ padding: "14px 18px" }}>
            <div className="flex h-9.5 w-9.5 flex-shrink-0 items-center justify-center rounded-full bg-white/15" style={{ width: 38, height: 38 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="8" r="4" fill="rgba(255,255,255,0.9)" />
                <rect x="6" y="13" width="12" height="8" rx="3" fill="rgba(255,255,255,0.9)" />
                <circle cx="9" cy="7.5" r="1.2" fill="#1a3c5e" />
                <circle cx="15" cy="7.5" r="1.2" fill="#1a3c5e" />
                <path d="M9 10.5 Q12 12 15 10.5" stroke="#1a3c5e" strokeWidth="1.2" strokeLinecap="round" fill="none" />
                <rect x="9" y="15" width="2.5" height="3.5" rx="1" fill="#1a3c5e" opacity="0.6" />
                <rect x="12.5" y="15" width="2.5" height="3.5" rx="1" fill="#1a3c5e" opacity="0.6" />
                <line x1="12" y1="4" x2="12" y2="2.5" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="12" cy="2" r="1" fill="#e8a020" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-white">Inventory Assistant</div>
              <div className="text-[11px] text-white/50">Ask me anything about your store</div>
            </div>
            <div className="h-2 w-2 flex-shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_#4ade80]" />
            <button
              onClick={toggle}
              className="ml-1.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-sm text-white hover:bg-white/25"
            >
              ✕
            </button>
          </div>

          <div ref={messagesRef} className="flex max-h-80 min-h-[160px] flex-1 flex-col gap-2.5 overflow-y-auto bg-bg p-4">
            {messages.map((m, i) => (
              <div key={i} className={`max-w-[85%] text-[13.5px] leading-[1.55] ${m.role === "user" ? "self-end" : "self-start"}`}>
                <div
                  className={`rounded-xl px-3.5 py-2.5 ${
                    m.role === "user"
                      ? "rounded-br-[4px] bg-navy text-white"
                      : "rounded-bl-[4px] border border-border bg-white text-ink"
                  }`}
                >
                  {m.content.split("\n").map((line, j) => (
                    <span key={j}>
                      {line}
                      <br />
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {typing && (
              <div className="max-w-[85%] self-start text-[13.5px] italic text-ink-soft">
                <div className="rounded-xl rounded-bl-[4px] border border-border bg-white px-3.5 py-2.5">
                  Checking your inventory…
                </div>
              </div>
            )}
          </div>

          {showSuggestions && (
            <div className="flex flex-wrap gap-1.5 bg-bg px-3.5 pt-2.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setShowSuggestions(false);
                    send(s);
                  }}
                  className="rounded-full border border-border bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-navy hover:bg-navy hover:text-white"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-border bg-white px-3.5 pb-3.5 pt-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              maxLength={300}
              placeholder="Ask about your inventory…"
              className="flex-1 rounded-full border border-border px-3.5 py-2 text-[13.5px] outline-none focus:border-navy"
            />
            <button
              onClick={() => send()}
              disabled={sending}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-white disabled:opacity-50"
            >
              ➤
            </button>
          </div>
        </div>
      )}

      <button onClick={toggle} title="Inventory Assistant" className="relative block h-[68px] w-[68px] cursor-pointer border-none bg-transparent p-0 transition-transform hover:scale-[1.08]" style={{ filter: "drop-shadow(0 8px 24px rgba(26,60,94,0.45))" }}>
        <svg viewBox="0 0 68 68" width="68" height="68" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="bg-grad" cx="40%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#2a5480" />
              <stop offset="60%" stopColor="#1a3c5e" />
              <stop offset="100%" stopColor="#0a1f35" />
            </radialGradient>
            <radialGradient id="face-grad" cx="45%" cy="35%" r="60%">
              <stop offset="0%" stopColor="#e8f4ff" />
              <stop offset="100%" stopColor="#b8d4ee" />
            </radialGradient>
            <radialGradient id="eye-grad" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#4db8ff" />
              <stop offset="100%" stopColor="#0066cc" />
            </radialGradient>
            <radialGradient id="gold-grad" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#ffe066" />
              <stop offset="100%" stopColor="#e8a020" />
            </radialGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="inner-shadow">
              <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
              <feOffset dx="1" dy="2" />
              <feComposite in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" />
              <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.3 0" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle cx="34" cy="34" r="33" fill="url(#bg-grad)" />
          <circle cx="34" cy="34" r="33" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
          <ellipse cx="30" cy="20" rx="14" ry="8" fill="rgba(255,255,255,0.08)" />
          <rect x="18" y="16" width="32" height="24" rx="6" fill="url(#face-grad)" filter="url(#inner-shadow)" />
          <rect x="20" y="17" width="28" height="8" rx="4" fill="rgba(255,255,255,0.4)" />
          <rect x="18" y="22" width="4" height="16" rx="2" fill="rgba(0,0,0,0.08)" />
          <rect x="46" y="22" width="4" height="16" rx="2" fill="rgba(0,0,0,0.08)" />
          <line x1="34" y1="16" x2="34" y2="10" stroke="#8ab4d4" strokeWidth="2" strokeLinecap="round" />
          <circle cx="34" cy="9" r="3" fill="url(#gold-grad)" filter="url(#glow)" />
          <circle cx="34" cy="9" r="1.5" fill="#fff" opacity="0.6" />
          <circle cx="27" cy="27" r="5" fill="url(#eye-grad)" />
          <circle cx="41" cy="27" r="5" fill="url(#eye-grad)" />
          <circle cx="29" cy="25" r="1.8" fill="rgba(255,255,255,0.7)" />
          <circle cx="43" cy="25" r="1.8" fill="rgba(255,255,255,0.7)" />
          <circle cx="27" cy="27" r="2.5" fill="#003a75" />
          <circle cx="41" cy="27" r="2.5" fill="#003a75" />
          <circle cx="27" cy="27" r="5" fill="none" stroke="rgba(77,184,255,0.5)" strokeWidth="1" filter="url(#glow)" />
          <circle cx="41" cy="27" r="5" fill="none" stroke="rgba(77,184,255,0.5)" strokeWidth="1" filter="url(#glow)" />
          <rect x="26" y="34" width="16" height="4" rx="2" fill="rgba(26,60,94,0.2)" />
          <line x1="28" y1="36" x2="40" y2="36" stroke="#1a3c5e" strokeWidth="1" strokeDasharray="2,2" opacity="0.5" />
          <rect x="22" y="42" width="24" height="14" rx="5" fill="#1a3c5e" />
          <rect x="24" y="43" width="20" height="5" rx="3" fill="rgba(255,255,255,0.12)" />
          <rect x="27" y="47" width="6" height="5" rx="1.5" fill="url(#gold-grad)" opacity="0.9" />
          <rect x="35" y="47" width="6" height="5" rx="1.5" fill="rgba(77,184,255,0.6)" />
          <rect x="13" y="43" width="7" height="10" rx="3.5" fill="#1a3c5e" />
          <rect x="13" y="43" width="7" height="4" rx="3" fill="rgba(255,255,255,0.1)" />
          <rect x="48" y="43" width="7" height="10" rx="3.5" fill="#1a3c5e" />
          <rect x="48" y="43" width="7" height="4" rx="3" fill="rgba(255,255,255,0.1)" />
          <rect x="25" y="57" width="7" height="6" rx="3" fill="#0f2540" />
          <rect x="36" y="57" width="7" height="6" rx="3" fill="#0f2540" />
          <circle cx="18" cy="28" r="3" fill="#8ab4d4" />
          <circle cx="18" cy="28" r="1.5" fill="#b8d4ee" />
          <circle cx="50" cy="28" r="3" fill="#8ab4d4" />
          <circle cx="50" cy="28" r="1.5" fill="#b8d4ee" />
          <ellipse cx="34" cy="64" rx="18" ry="3" fill="rgba(0,0,0,0.2)" />
        </svg>
        {showBadge && (
          <div className="absolute right-0 top-0 flex h-5.5 w-5.5 animate-pulse items-center justify-center rounded-full border-2 border-white bg-amber-500 text-[11px] font-extrabold text-navy-dark" style={{ width: 22, height: 22 }}>
            1
          </div>
        )}
      </button>
    </div>
  );
}