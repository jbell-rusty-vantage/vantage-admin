import { BrandLogo } from "@/components/brand/brand-logo";

const deskItems = ["Bookings", "Intakes", "Analytics"] as const;

export function LoginShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cool-white px-4 py-10 sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(20,93,160,0.12),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(6,43,85,0.08),transparent_45%)]"
      />

      <div className="relative w-full max-w-md md:max-w-5xl">
        <div className="grid overflow-hidden rounded-2xl border border-steel-200 bg-white shadow-xl md:grid-cols-2">
          <aside className="relative hidden flex-col justify-between overflow-hidden bg-linear-to-b from-navy via-[#0a3a6e] to-trust-blue p-10 text-white md:flex">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-white/10 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-16 -left-10 size-48 rounded-full bg-gold/20 blur-3xl"
            />
            <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gold" />

            <BrandLogo tone="onDark" subtitle="Owner dashboard" />

            <div className="relative mt-auto max-w-sm space-y-4">
              <p className="font-heading text-[11px] font-bold uppercase tracking-[0.14em] text-gold">
                Today
              </p>
              <h1 className="font-heading text-[28px] font-extrabold leading-[1.15] tracking-tight text-white text-balance">
                Waiting work first. The rest of the desk next.
              </h1>
              <p className="text-sm leading-relaxed text-white/75">
                Sign in to bookings, intakes, and the operations you already run.
              </p>
              <ul className="flex flex-wrap gap-2 pt-2">
                {deskItems.map((item) => (
                  <li
                    key={item}
                    className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <section className="flex flex-col justify-center gap-6 px-6 py-8 sm:px-10 sm:py-12">
            <div className="md:hidden">
              <BrandLogo size="lg" subtitle="Sign in to continue" />
            </div>
            <div className="space-y-1.5">
              <h2 className="font-heading text-2xl font-extrabold tracking-tight text-navy">
                Welcome back
              </h2>
              <p className="text-sm text-steel">
                Use your owner credentials to open the administrative dashboard.
              </p>
            </div>
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}
