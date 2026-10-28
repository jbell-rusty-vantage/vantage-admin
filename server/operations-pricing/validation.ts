import { z } from "zod";
import { MILEAGE, VOLUME } from "@/lib/transportation-pricing";
const objectId = z.string().regex(/^[a-f0-9]{24}$/);
const version = z.number().int().nonnegative();
const command = { operation_id: z.uuid(), change_note: z.string().trim().min(1).max(500), expected_activation_version: version };
const decimal = z.string().trim().regex(/^(0|[1-9][0-9]*)(\.[0-9]{1,4})?$/).max(16);
const rate = decimal.refine(v => Number(v) <= 1000).nullable();
const rates = z.record(z.enum(VOLUME), rate);
const sample = z.strictObject({ volume_cf: decimal, mileage: decimal, pickup_state: z.string().max(20), delivery_state: z.string().max(20), pickup_zip: z.string().max(20), delivery_zip: z.string().max(20) });
const configuration = z.strictObject({ currency: z.literal("USD"), base_rates: z.record(z.enum(MILEAGE), rates), surcharge_groups: z.array(z.strictObject({ group_id: z.uuid().nullable(), name: z.string().trim().min(1).max(80), active: z.boolean(), states: z.array(z.string().regex(/^[A-Z]{2}$/)).max(51), rates })).max(100) });
export function validatePricingBody(target: string, method: string, value: unknown): unknown {
  const path = target.split("?")[0];
  const schema = path.endsWith("/calculate") ? sample
    : path.endsWith("/enabled") ? z.strictObject({ ...command, calculation_enabled: z.boolean() })
    : path.endsWith("/activate") ? z.strictObject({ ...command, revision_id: objectId })
    : path.endsWith("/publish") ? z.strictObject({ ...command, expected_draft_version: version.positive(), acknowledged_warning_hash: z.string().regex(/^[a-f0-9]{64}$/).optional(), preview_inputs: z.array(sample).max(100).optional() })
    : path.endsWith("/preview") ? z.strictObject({ expected_draft_version: version.positive(), inputs: z.array(sample).max(100) })
    : method === "PUT" ? z.strictObject({ expected_draft_version: version.positive(), configuration })
    : z.strictObject({ base_revision_id: objectId.nullable(), operation_id: z.uuid() });
  return schema.parse(value);
}
