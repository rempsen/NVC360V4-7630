import { Route, Switch } from "wouter";
import { AppShell, type NavItem } from "../../components/app-shell";
import { Home, CalendarDays, User } from "lucide-react";
import CustomerHome from "./home";
import BookPage from "./book";
import TrackPage from "./track";
import CustomerBookings from "./bookings";
import ProfilePage from "./profile";

const NAV: NavItem[] = [
  { to: "/app", label: "Home", icon: Home },
  { to: "/app/bookings", label: "Work Orders", icon: CalendarDays },
  { to: "/app/profile", label: "Profile", icon: User },
];

export default function CustomerApp() {
  return (
    <AppShell nav={NAV}>
      <Switch>
        <Route path="/app" component={CustomerHome} />
        <Route path="/app/book/:id" component={BookPage} />
        <Route path="/app/track/:id" component={TrackPage} />
        <Route path="/app/bookings" component={CustomerBookings} />
        <Route path="/app/profile" component={ProfilePage} />
      </Switch>
    </AppShell>
  );
}
