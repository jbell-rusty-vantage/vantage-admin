import { Suspense } from "react";
import { TodayPage } from "@/components/today/today-page";

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <TodayPage />
    </Suspense>
  );
}
