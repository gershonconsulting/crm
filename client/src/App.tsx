import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { UserRoleProvider } from "@/hooks/use-user-role";
import SignInGate from "@/components/auth/SignInGate";
import NotFound from "@/pages/not-found";
import Pipeline from "@/pages/pipeline";
import Dashboard from "@/pages/dashboard";
import Contacts from "@/pages/contacts";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import AdminPage from "@/pages/admin";
import ByFit from "@/pages/views/by-fit";
import ByInterest from "@/pages/views/by-interest";
import ByMonth from "@/pages/views/by-month";
import Tasks from "@/pages/tasks";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Pipeline} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/contacts" component={Contacts} />
      <Route path="/tasks" component={Tasks} />
      <Route path="/reports" component={Reports} />
      <Route path="/settings" component={Settings} />
      <Route path="/adminpanel" component={AdminPage} />
      <Route path="/views/by-fit" component={ByFit} />
      <Route path="/views/by-interest" component={ByInterest} />
      <Route path="/views/by-month" component={ByMonth} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserRoleProvider>
        <SignInGate><Router /></SignInGate>
        <Toaster />
      </UserRoleProvider>
    </QueryClientProvider>
  );
}

export default App;
