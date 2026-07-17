"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { clearToken } from "@/lib/api";
import { useCurrentUser } from "@/lib/useCurrentUser";
import AiWidget from "@/components/AiWidget";
import { PageHeaderProvider, usePageHeaderValue } from "@/components/PageHeaderContext";
import HelpTourButton from "@/components/HelpTourButton";

type NavItem = { href: string; label: string; icon: string; section?: string };

const BASE_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "🏠", section: "Overview" },
  { href: "/items", label: "All Items", icon: "📦", section: "Inventory" },
  { href: "/withdraw", label: "Take Item", icon: "🛒", section: "Stock Movement" },
  { href: "/withdrawals", label: "Withdrawal Log", icon: "📋", section: "Stock Movement" },
  { href: "/assistant", label: "Assistant", icon: "💬", section: "Overview" },
];

const MANAGER_ITEMS: NavItem[] = [
  { href: "/items/new", label: "Add Item", icon: "➕", section: "Inventory" },
  { href: "/restock", label: "Restock Planner", icon: "🛍️", section: "Planning" },
  { href: "/reports", label: "Reports", icon: "📊", section: "Planning" },
  { href: "/settings/categories", label: "Categories", icon: "🏷️", section: "Settings" },
  { href: "/settings/rooms", label: "Rooms", icon: "🚪", section: "Settings" },
];

const ADMIN_ITEMS: NavItem[] = [{ href: "/settings/users", label: "Users", icon: "👥", section: "Settings" }];

function buildSections(items: NavItem[]) {
  const order = ["Overview", "Inventory", "Stock Movement", "Planning", "Settings"];
  return order
    .map((section) => ({ section, items: items.filter((i) => i.section === section) }))
    .filter((s) => s.items.length > 0);
}

function TopBar() {
  const { title, breadcrumb, actions, tourSteps } = usePageHeaderValue();
  if (!title) return null;
  return (
    <div className="app-chrome sticky top-0 z-30 border-b border-border bg-bg/95 px-4 pt-safe backdrop-blur md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2 py-3 md:py-4">
        <div className="min-w-0">
          {breadcrumb && (
            <p className="truncate text-[11px] font-bold uppercase tracking-[0.18em] text-ink-soft">{breadcrumb}</p>
          )}
          <h1 className="truncate font-display text-xl font-extrabold text-navy-dark md:text-2xl">{title}</h1>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {actions}
          <HelpTourButton steps={tourSteps} />
        </div>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isManager, isAdmin } = useCurrentUser();
  const isLogin = pathname === "/login";

  if (isLogin) {
    return <>{children}</>;
  }

  const items = [...BASE_ITEMS, ...(isManager ? MANAGER_ITEMS : []), ...(isAdmin ? ADMIN_ITEMS : [])];
  const sections = buildSections(items);

  // Bottom tab bar keeps just the top-level essentials regardless of role
  const tabItems: NavItem[] = [
    { href: "/", label: "Home", icon: "🏠" },
    { href: "/items", label: "Items", icon: "📦" },
    { href: "/withdraw", label: "Take", icon: "🛒" },
    { href: "/assistant", label: "Assistant", icon: "💬" },
  ];

  return (
    <div className="md:flex md:min-h-screen">
      {/* Desktop sidebar */}
      <aside className="app-chrome hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-navy-dark text-white overflow-y-auto">
        <div className="px-6 py-7 border-b border-white/10">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold">Household</p>
          <p className="mt-1 font-display text-xl font-extrabold leading-tight">Home Inventory</p>
        </div>
        <nav className="flex-1 px-3 py-4">
          {sections.map((s) => (
            <div key={s.section} className="mb-4">
              <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-white/35">{s.section}</p>
              <div className="space-y-1">
                {s.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                        active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white/90"
                      }`}
                    >
                      <span>{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="px-3 pb-6 pt-2 border-t border-white/10">
          <button
            onClick={() => {
              clearToken();
              router.push("/login");
            }}
            className="focus-ring flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-white/60 hover:bg-white/5 hover:text-white/90"
          >
            <span>🚪</span>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 md:ml-64 pb-20 md:pb-0">{children}</div>

{/* Mobile bottom tab bar */}
      <nav className="app-chrome md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-border pb-safe">
        <div className="flex">
          {tabItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className="flex-1 flex flex-col items-center gap-1 py-2.5">
                <span className={active ? "" : "opacity-60"}>{item.icon}</span>
                <span className={`text-[11px] font-semibold ${active ? "text-navy" : "text-ink-soft"}`}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <AiWidget />
    </div>
  );
}
