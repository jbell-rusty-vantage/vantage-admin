import { InsightsTabs } from "@/components/insights/insights-tabs";

export default function InsightsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <InsightsTabs />
      {children}
    </div>
  );
}
