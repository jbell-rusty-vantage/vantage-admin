import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const nextUnits = [
  "Unit 2: server-only Vantage API proxy and TanStack Query infrastructure.",
  "Unit 3: backend admin read APIs and CSV exports.",
  "Unit 5: operational tables, detail views, and audit log viewer.",
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Secure admin foundation is ready. Operational data pages will be wired
          through the protected proxy in later units.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Authentication</CardTitle>
            <CardDescription>Custom Mongo-backed owner login.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Dashboard routes require a valid admin session cookie.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Audit Base</CardTitle>
            <CardDescription>Admin activity collection is available.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Login success, login failure, logout, and refresh failures are logged.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>No Operational Access</CardTitle>
            <CardDescription>Unit 1 stays inside admin auth data.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Business records remain owned by `vantage-main-server`.
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Next Integration Points</CardTitle>
          <CardDescription>Prepared handoff notes for follow-up units.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {nextUnits.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
