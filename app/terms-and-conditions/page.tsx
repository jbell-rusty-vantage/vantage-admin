import { COMPANY } from "@/lib/legal/company";

export default function TermsAndConditionsPage() {
  return (
    <article className="legal-document space-y-8 text-[15px] leading-7 text-foreground">
      <header className="space-y-2 border-b border-border pb-8">
        <p className="text-sm font-medium text-muted-foreground">{COMPANY.name}</p>
        <h1 className="text-3xl font-semibold tracking-tight">Terms and Conditions</h1>
        <p className="text-sm text-muted-foreground">Last Updated: June 2026</p>
      </header>

      <p>
        By using this website and submitting information through our forms, you agree to these Terms and
        Conditions.
      </p>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">SMS Communications</h2>
        <p>
          By providing your phone number and affirmatively consenting through our website forms, you agree to
          receive SMS messages from {COMPANY.name} regarding:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Moving quote requests</li>
          <li>Appointment scheduling</li>
          <li>Appointment reminders</li>
          <li>Service updates</li>
          <li>Customer support communications</li>
        </ul>
        <p>Message frequency may vary.</p>
        <p>Message and data rates may apply.</p>
        <p>You may opt out at any time by replying STOP.</p>
        <p>You may request assistance by replying HELP.</p>
        <p>Consent to receive SMS messages is not a condition of purchase.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Use of Website</h2>
        <p>Users agree to provide accurate information and use the website only for lawful purposes.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Limitation of Liability</h2>
        <p>
          {COMPANY.name} is not liable for indirect, incidental, or consequential damages arising from use of the
          website or services.
        </p>
      </section>

      <section className="space-y-3 border-t border-border pt-8">
        <h2 className="text-xl font-semibold tracking-tight">Contact Information</h2>
        <address className="not-italic space-y-1 text-foreground">
          <p className="font-medium">{COMPANY.name}</p>
          <p>Phone: {COMPANY.phone}</p>
          <p>
            Email:{" "}
            <a href={`mailto:${COMPANY.email}`} className="underline underline-offset-2">
              {COMPANY.email}
            </a>
          </p>
          <p>Address: {COMPANY.address}</p>
        </address>
      </section>
    </article>
  );
}
