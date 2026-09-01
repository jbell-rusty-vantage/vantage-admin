import type { LeadSourceDetail } from "@/lib/api/leadSources";

/** Redacted ORS-3 completeness fixture. IDs are placeholders, not hex ObjectIds. */
export const ORS3_LEAD_SOURCE_DETAIL: LeadSourceDetail = {
  id: "lead-source-best-relocation",
  company_slug: "best_relocation_leads",
  name: "Best Relocation",
  owner_label: "Best Relocation",
  active: true,
  aliases: ["Best Relo"],
  sheet_config: {
    has_bad_tabs: false,
    projection_mode: "derived_import",
  },
  feeds: {
    empty: false,
    items: [
      {
        id: "feed-local",
        granularity_key: "best_relocation_local",
        channel: "form",
        display_name: "Web forms — local moves",
        crm_label: "Best Relocation Locals",
        move_type: "local",
        active: true,
        readiness: {
          lead_source_active: true,
          feed_active: true,
          lead_cost: "invalid",
          live: false,
        },
        accepted_labels: {
          empty: false,
          items: [
            {
              id: "label-local",
              label: "Best Relocation Locals",
              namespace: "sheet_lead_source",
              active: true,
            },
          ],
        },
        granot_names: {
          empty: false,
          items: [
            {
              id: "granot-split",
              name_received_from_granot: "Best Relocation",
              when_lead_arrives: "create_if_missing",
              when_lead_arrives_copy: "Use an existing lead, or create it if missing",
              text_state: "on",
              live: true,
              route: {
                shape: "form_by_move_type",
                lands_in_this_feed: true,
                selection_rule: "Use the local feed or the long-distance feed based on the move type.",
                local_feed_id: "feed-local",
                long_distance_feed_id: "feed-long",
              },
            },
          ],
        },
      },
      {
        id: "feed-long",
        granularity_key: "best_relocation_long",
        channel: "form",
        display_name: "Web forms — long-distance",
        crm_label: "Best Relocation Forms",
        move_type: "long_distance",
        active: true,
        readiness: {
          lead_source_active: true,
          feed_active: true,
          lead_cost: "missing",
          live: false,
        },
        accepted_labels: {
          empty: false,
          items: [
            {
              id: "label-long",
              label: "Best Relocation Forms",
              namespace: "sheet_lead_source",
              active: true,
            },
          ],
        },
        granot_names: {
          empty: false,
          items: [
            {
              id: "granot-split",
              name_received_from_granot: "Best Relocation",
              when_lead_arrives: "create_if_missing",
              when_lead_arrives_copy: "Use an existing lead, or create it if missing",
              text_state: "on",
              live: true,
              route: {
                shape: "form_by_move_type",
                lands_in_this_feed: true,
                selection_rule: "Use the local feed or the long-distance feed based on the move type.",
                local_feed_id: "feed-local",
                long_distance_feed_id: "feed-long",
              },
            },
          ],
        },
      },
      {
        id: "feed-call",
        granularity_key: "best_relocation_calls",
        channel: "call",
        display_name: "Inbound calls",
        crm_label: "Best Relocation Inbounds",
        active: true,
        readiness: {
          lead_source_active: true,
          feed_active: true,
          lead_cost: "missing",
          live: false,
        },
        accepted_labels: { empty: true, items: [] },
        granot_names: {
          empty: false,
          items: [
            {
              id: "granot-call",
              name_received_from_granot: "Best Relocation Calls",
              when_lead_arrives: "existing_only",
              when_lead_arrives_copy: "Use an existing lead only",
              text_state: "not_available",
              live: false,
              route: { shape: "one_feed", lands_in_this_feed: true },
            },
          ],
        },
        inbound_numbers: {
          empty: false,
          items: [
            {
              id: "inbound-route",
              phone_number: "+19545550142",
              nickname: "Best Relocation inbound queue",
              effective_from: "2026-08-01T00:00:00.000Z",
            },
          ],
        },
      },
    ],
  },
  blocking_finding_count: 1,
  findings: [
    {
      code: "registry.source_default_invalid",
      severity: "blocking",
      owner_message:
        "This lead source has live feeds but no default feed for that channel, so new leads have nowhere to land.",
      owner_action: "Activate a feed as the default for this channel.",
      deep_link: "/operations-registry?tab=lead-sources&entity=lead-source-best-relocation",
      scope: { lead_source_id: "lead-source-best-relocation" },
      advanced: { raw_code: "registry.source_default_invalid" },
    },
  ],
  readiness_plan: [
    { gate: "Set the lead cost", action: "open_lead_costs", status: "ready" },
    { gate: "Activate the lead source", action: "activate_lead_source", status: "done" },
    {
      gate: "Activate the feed",
      action: "activate_feed",
      status: "blocked",
      blocked_until: "lead source active and lead cost valid",
    },
    {
      gate: "Switch the Granot name live",
      action: "switch_granot_name_live",
      status: "blocked",
      blocked_until: "feed active",
    },
    {
      gate: "Turn on the customer text",
      action: "turn_on_customer_text",
      status: "blocked",
      blocked_until: "Granot name live and create-if-missing and consent attested",
    },
  ],
  advanced: {
    raw_findings: [
      {
        code: "registry.source_default_invalid",
        summary: "Active form Source Granularities lack an active same-company default.",
        entity_type: "source_company",
        entity_id: "lead-source-best-relocation",
      },
    ],
  },
};

export const EMPTY_LEAD_SOURCE_DETAIL: LeadSourceDetail = {
  id: "lead-source-empty",
  company_slug: "empty_draft",
  name: "Empty Draft",
  owner_label: "Empty Draft",
  active: false,
  aliases: [],
  sheet_config: { has_bad_tabs: false, projection_mode: "derived_import" },
  feeds: { empty: true, items: [] },
  blocking_finding_count: 0,
  findings: [],
  readiness_plan: [
    { gate: "Set the lead cost", action: "open_lead_costs", status: "ready" },
    { gate: "Activate the lead source", action: "activate_lead_source", status: "ready" },
    {
      gate: "Activate the feed",
      action: "activate_feed",
      status: "blocked",
      blocked_until: "lead source active and lead cost valid",
    },
    { gate: "Connect a Granot name", action: "connect_granot_name", status: "suggested" },
  ],
  advanced: { raw_findings: [] },
};
