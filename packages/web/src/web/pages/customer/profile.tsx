import { useAuth } from "../../hooks/use-auth";
import { authClient, clearToken } from "../../lib/auth";
import { useLocation } from "wouter";
import { Mail, Phone, Shield, LogOut, User as UserIcon } from "lucide-react";

export default function ProfilePage() {
  const { user, role } = useAuth();
  const [, navigate] = useLocation();

  async function logout() {
    await authClient.signOut();
    clearToken();
    navigate("/sign-in");
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <h1 className="text-2xl font-extrabold text-white">Profile</h1>
      <div className="rounded-2xl border border-white/5 bg-ink-2 p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-deep text-2xl font-bold text-white">
            {user?.name?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{user?.name}</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-semibold capitalize text-cyan-glow">
              <Shield className="h-3 w-3" /> {role}
            </span>
          </div>
        </div>
        <div className="mt-6 space-y-3">
          <Item icon={Mail} label="Email" value={user?.email ?? ""} />
          <Item icon={Phone} label="Phone" value={user?.phone || "Not set"} />
          <Item icon={UserIcon} label="Account type" value={role} />
        </div>
      </div>
      <button
        onClick={logout}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-ink-2 py-3.5 font-semibold text-red-400 transition hover:bg-red-500/10"
      >
        <LogOut className="h-5 w-5" /> Sign out
      </button>
    </div>
  );
}

function Item({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-ink px-4 py-3">
      <Icon className="h-5 w-5 text-slate-500" />
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="font-medium capitalize text-slate-100">{value}</div>
      </div>
    </div>
  );
}
