export const DEFAULT_GRANOT_SMS_TEMPLATE =
  "Hi {first_name}, this is Vantage Movers. We got your request and we'll call you shortly to go over your move.";

export const GRANOT_SMS_OPT_OUT = "Reply STOP to opt out.";

export const GRANOT_SMS_BRAND = "Vantage Movers";

/**
 * Owner preview of the customer text. Brand is always Vantage Movers.
 * Empty first name renders as `there`. Leftover `{company}` is not offered
 * and does not insert the partner name.
 */
export function renderGranotLeadSmsPreview(input: {
  template: string;
  first_name?: string;
}): string {
  const firstName = input.first_name?.trim() || "there";
  const rendered = input.template
    .replaceAll("{first_name}", firstName)
    .replaceAll("{company}", GRANOT_SMS_BRAND);
  return `${rendered.replace(/\s*Reply STOP to opt out\.?/gi, "").trimEnd()} ${GRANOT_SMS_OPT_OUT}`;
}

export function granotSmsPreviewLength(template: string, firstName?: string): number {
  return renderGranotLeadSmsPreview({ template, first_name: firstName }).length;
}
