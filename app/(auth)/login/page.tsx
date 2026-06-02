import { Suspense } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/layout/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cool-white px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <BrandLogo size="lg" subtitle="Sign in to continue" />
        </div>
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Sign in to Vantage Admin</CardTitle>
            <CardDescription>
              Use your owner credentials to access the administrative dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
