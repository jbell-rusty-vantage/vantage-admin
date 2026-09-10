import { ReportingSubnav } from "@/components/reporting/reporting-subnav";

export default function ReportingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <ReportingSubnav />
      {children}
    </div>
  );
}
