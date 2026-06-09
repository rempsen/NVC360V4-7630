import { Link, useLocation } from "wouter";
import { Logo } from "./brand";
import { NotifBell } from "./notif-bell";
import { useAuth } from "../hooks/use-auth";
import { authClient, clearToken } from "../lib/auth";
import { cn } from "../lib/utils";
import { LogOut } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: any;
}

export function AppShell({
  children,
  nav,
}: {
  children: React.ReactNode;
  nav: NavItem[];
}) {
  const [loc, navigate] = useLocation();
  const { user } = useAuth();

  async function logout() {
    await authClient.signOut();
    clearToken();
    navigate("/sign-in");
  }

  return (
    <div className="nvc-grid-bg min-h-screen bg-ink pb-20 text-slate-200 md:pb-0">
      {/* top bar */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-ink-2/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Logo light />
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((n) => {
              const active = loc === n.to || (n.to !== "/app" && loc.startsWith(n.to));
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition",
                    active
                      ? "bg-brand text-white nvc-glow-sm"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
                  )}
                >
                  <n.icon className="h-4 w-4" /> {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <NotifBell />
            <div className="hidden items-center gap-2 sm:flex">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-brand/15 text-sm font-bold text-cyan-glow">
                {user?.name?.[0]?.toUpperCase() ?? "U"}
              </div>
            </div>
            <button
              onClick={logout}
              className="grid h-10 w-10 place-items-center rounded-full text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
              title="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>

      {/* mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/5 bg-ink-2/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-around px-2 py-2">
          {nav.map((n) => {
            const active = loc === n.to || (n.to !== "/app" && loc.startsWith(n.to));
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-medium transition",
                  active ? "text-cyan-glow" : "text-slate-500",
                )}
              >
                <n.icon className="h-5 w-5" /> {n.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
