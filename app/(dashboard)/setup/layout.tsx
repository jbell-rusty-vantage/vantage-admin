import "@/components/setup/setup.css";
import "@/components/setup/lead-sources/lead-sources.css";
import "@/components/setup/lead-costs/lead-costs.css";
import "@/components/setup/people/people.css";
import "@/components/setup/money/money.css";
import "@/components/setup/carriers/carriers.css";
import "@/components/setup/connections/connections.css";
import "@/components/setup/website/website.css";
import "@/components/setup/changes/changes.css";
import { SetupShell } from "@/components/setup/setup-shell";

/**
 * Setup (doc 19): one route with a left sub-navigation; each section is its own route under `/setup`. The dashboard
 * layout has already checked the session and the role; Owner-only sections show the shell's "Not allowed" card to any
 * other role. Section stylesheets are imported here (a CSS import in a component breaks the node test runner).
 */
export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return <SetupShell>{children}</SetupShell>;
}
