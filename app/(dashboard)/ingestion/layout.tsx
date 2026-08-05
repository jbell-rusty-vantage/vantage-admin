import { IngestionSubnav } from "@/components/ingestion/ingestion-subnav";

export default function IngestionLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <IngestionSubnav />
      {children}
    </>
  );
}
