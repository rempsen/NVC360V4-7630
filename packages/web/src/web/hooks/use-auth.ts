import { authClient } from "../lib/auth";
import type { Role } from "../lib/auth";

export function useAuth() {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user as
    | { id: string; name: string; email: string; role?: Role; phone?: string }
    | undefined;
  return {
    user,
    role: (user?.role ?? "customer") as Role,
    isPending,
    isAuthed: !!user,
  };
}
