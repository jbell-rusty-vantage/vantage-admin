import { GranotLifecycleSubnav } from "@/components/granot-lifecycle/granot-lifecycle-subnav";

export default function GranotLifecycleLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GranotLifecycleSubnav />
      {children}
    </>
  );
}
