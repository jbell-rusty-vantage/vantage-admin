import { COMPANY } from "@/lib/legal/company";

export default function PrivacyPolicyPage() {
  return (
    <article className="legal-document space-y-8 text-[15px] leading-7 text-foreground">
      <header className="space-y-2 border-b border-border pb-8">
        <p className="text-sm font-medium text-muted-foreground">{COMPANY.name}</p>
        <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Last Updated: June 2026</p>
      </header>

      <p>
        At {COMPANY.name} (&quot;Company&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;), we
        respect your privacy and are committed to protecting your personal information.
      </p>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Information We Collect</h2>
        <p>We may collect the following information when you use our website or request moving services:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Name</li>
          <li>Phone number</li>
          <li>Email address</li>
          <li>Service address information</li>
          <li>Move details</li>
          <li>Any information voluntarily submitted through our forms</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">How We Use Your Information</h2>
        <p>We use your information to:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Provide moving estimates and services</li>
          <li>Respond to inquiries</li>
          <li>Schedule appointments</li>
          <li>Send service-related communications</li>
          <li>Improve our services</li>
          <li>Comply with legal obligations</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">SMS Communications</h2>
        <p>
          By providing your phone number and opting in through our website forms, you consent to receive SMS
          messages related to:
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
        <p>You may opt out at any time by replying STOP to any message.</p>
        <p>You may request assistance by replying HELP.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Information Sharing</h2>
        <p>
          We do not sell, rent, or share your personal information with third parties for marketing purposes.
        </p>
        <p>SMS consent is not shared with third parties or affiliates for marketing purposes.</p>
        <p>
          We may share information with service providers only as necessary to operate our business and provide
          requested services.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Data Security</h2>
        <p>
          We implement reasonable administrative, technical, and physical safeguards designed to protect personal
          information from unauthorized access, disclosure, or misuse.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Your Rights</h2>
        <p>You may contact us to:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Request access to your information</li>
          <li>Request corrections</li>
          <li>Request deletion where applicable</li>
        </ul>
      </section>

      <section className="space-y-3 border-t border-border pt-8">
        <h2 className="text-xl font-semibold tracking-tight">Contact Information</h2>
        <p>If you have questions regarding this Privacy Policy, please contact:</p>
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
