import { Route, Switch } from "wouter";
import { AppShell, type NavItem } from "../../components/app-shell";
import { ClipboardList, Wallet, User } from "lucide-react";
import RiderJobs from "./jobs";
import RiderActive from "./active";
import RiderEarnings from "./earnings";
import ProfilePage from "../customer/profile";

const NAV: NavItem[] = [
  { to: "/rider", label: "My Jobs", icon: ClipboardList },
  { to: "/rider/earnings", label: "Earnings", icon: Wallet },
  { to: "/rider/profile", label: "Profile", icon: User },
];

export default function RiderApp() {
  return (
    <AppShell nav={NAV}>
      <Switch>
        <Route path="/rider" component={RiderJobs} />
        <Route path="/rider/job/:id" component={RiderActive} />
        <Route path="/rider/earnings" component={RiderEarnings} />
        <Route path="/rider/profile" component={ProfilePage} />
      </Switch>
    </AppShell>
  );
}
