import { Suspense } from "react";
import { LoginForm } from "@/components/layout/login-form";
import { LoginShell } from "@/components/layout/login-shell";

export default function LoginPage() {
  return (
    <LoginShell>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </LoginShell>
  );
}
