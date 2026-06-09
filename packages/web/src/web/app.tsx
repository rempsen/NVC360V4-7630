import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import Index from "./pages/index";
import AuthPage from "./pages/auth";
import { Provider } from "./components/provider";
import { ProtectedRoute } from "./components/protected-route";
import { AgentFeedback } from "@runablehq/website-runtime";

// Route-level code-splitting. The public landing + auth pages stay in the main
// bundle (needed on first paint), while the heavy authenticated apps
// (customer / rider / admin) and rarely-hit public pages load on demand. This
// is the core cold-start win: a first-time visitor no longer downloads the
// entire admin console + maps + charts before the landing page renders.
const ForgotPasswordPage = lazy(() => import("./pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("./pages/reset-password"));
const TrackPublic = lazy(() => import("./pages/track-public"));
const IntakeForm = lazy(() => import("./pages/intake-form"));
const JoinTech = lazy(() => import("./pages/join-tech"));
const CustomerApp = lazy(() => import("./pages/customer"));
const RiderApp = lazy(() => import("./pages/rider"));
const AdminApp = lazy(() => import("./pages/admin"));

function RouteFallback() {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        aria-label="Loading"
        style={{
          width: 28,
          height: 28,
          border: "3px solid rgba(0,0,0,0.12)",
          borderTopColor: "rgba(0,0,0,0.55)",
          borderRadius: "50%",
          animation: "rb-spin 0.7s linear infinite",
        }}
      />
      <style>{"@keyframes rb-spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}

function App() {
  return (
    <Provider>
      <Suspense fallback={<RouteFallback />}>
        <Switch>
          <Route path="/" component={Index} />
          <Route path="/sign-in">{() => <AuthPage mode="sign-in" />}</Route>
          <Route path="/sign-up">{() => <AuthPage mode="sign-up" />}</Route>
          <Route path="/forgot-password" component={ForgotPasswordPage} />
          <Route path="/reset-password" component={ResetPasswordPage} />
          <Route path="/t/:token" component={TrackPublic} />
          <Route path="/f/:companyId/:slug" component={IntakeForm} />
          <Route path="/join/:token" component={JoinTech} />

          <Route path="/app/*?">
            <ProtectedRoute roles={["customer"]}>
              <CustomerApp />
            </ProtectedRoute>
          </Route>
          <Route path="/rider/*?">
            <ProtectedRoute roles={["rider"]}>
              <RiderApp />
            </ProtectedRoute>
          </Route>
          <Route path="/admin/*?">
            <ProtectedRoute roles={["admin", "superadmin"]}>
              <AdminApp />
            </ProtectedRoute>
          </Route>
        </Switch>
      </Suspense>
      {/* Do not remove — off by default, activated by parent iframe via postMessage */}
      {import.meta.env.DEV && <AgentFeedback />}
    </Provider>
  );
}

export default App;
