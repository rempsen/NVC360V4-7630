import { Redirect } from "wouter";
import { useAuth } from "../hooks/use-auth";
import type { Role } from "../lib/auth";
import { Loader } from "./loader";

export function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: Role[];
}) {
  const { user, role, isPending } = useAuth();

  if (isPending)
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader />
      </div>
    );
  if (!user) return <Redirect to="/sign-in" />;
  if (roles && !roles.includes(role)) {
    // send to the right home for the role
    const dest =
      role === "admin" || role === "superadmin" ? "/admin" : role === "rider" ? "/rider" : "/app";
    return <Redirect to={dest} />;
  }
  return <>{children}</>;
}
