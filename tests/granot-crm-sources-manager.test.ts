import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CREATE_IF_MISSING_COPY,
  GRANOT_ROUTE_TEMPLATES,
  GranotCrmSourceEditor,
} from "../components/operations-registry/granot-crm-sources-manager";
import type { GranotCrmSourceItem } from "../lib/api/registryGranotCrmSources";

const source: GranotCrmSourceItem = {
  id: "aaaaaaaaaaaaaaaaaaaaaaaa",
  granot_label: "Best Relocation Forms",
  normalized_granot_label: "best relocation forms",
  enabled: true,
  lifecycle_enabled: true,
  lifecycle_disposition: "source_scoped_lead",
  lead_created_policy: "link_only",
  lead_source_company: "bbbbbbbbbbbbbbbbbbbbbbbb",
  lead_source_company_label: "Best Relocation Leads",
  lead_source_company_status: "active",
  lifecycle_routes: [
    {
      route_key: "form_local",
      lead_model: "FormLead",
      move_type: "local",
      source_granularity_id: "cccccccccccccccccccccccc",
      source_granularity_key: "best_relocation_leads_form_local",
      source_granularity_status: "active",
    },
  ],
  lifecycle_policy_version: "granot-lifecycle-source-policy-v1",
  default_channel: "form",
  automation_sources: [
    {
      id: "dddddddddddddddddddddddd",
      label: "Best Relocation Forms",
      active: true,
      compatibility: {
        available_for_apply: true,
        status: "ready",
        issues: [],
      },
    },
  ],
};

test("Granot source editor exposes review, policy, and accessibility labels", () => {
  const markup = renderToStaticMarkup(
    createElement(GranotCrmSourceEditor, {
      source,
      companies: [
        {
          id: "bbbbbbbbbbbbbbbbbbbbbbbb",
          _id: "bbbbbbbbbbbbbbbbbbbbbbbb",
          company_slug: "best_relocation_leads",
          name: "Best Relocation Leads",
          owner_label: "Best Relocation Leads",
          aliases: [],
          active: true,
          sheet_config: { has_bad_tabs: false, projection_mode: "derived_import" },
          created_from: "registry",
        },
      ],
      granularities: [
        {
          id: "cccccccccccccccccccccccc",
          _id: "cccccccccccccccccccccccc",
          source_company: "bbbbbbbbbbbbbbbbbbbbbbbb",
          granularity_key: "best_relocation_leads_form_local",
          channel: "form",
          owner_label: "Best Relocation Forms Local",
          crm_label: "Best Relocation Forms Local",
          aliases: [],
          source_sites: [],
          priority: 1,
          local: "local",
          active: true,
          schedule_revision: 1,
          created_from: "registry",
        },
      ],
      readOnly: false,
      isPending: false,
      onSave() {},
      onActivate() {},
    }),
  );

  assert.match(markup, /Review reason/);
  assert.match(markup, /Lead created policy/);
  assert.match(markup, /Operational CSV enabled/);
  assert.match(markup, /Lifecycle activation/);
  assert.match(markup, /create_if_missing \(later rollout\)/);
  assert.match(markup, new RegExp(CREATE_IF_MISSING_COPY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(markup, /best relocation forms/);
  assert.match(markup, /Automation references/);
  assert.equal(
    GRANOT_ROUTE_TEMPLATES.map((item) => item.route_key).join(","),
    "call_any,form_local,form_long_distance",
  );
});

test("Admin read-only Granot source editor keeps values and hides mutations", () => {
  const markup = renderToStaticMarkup(
    createElement(GranotCrmSourceEditor, {
      source,
      companies: [],
      granularities: [],
      readOnly: true,
      isPending: false,
      onSave() {},
      onActivate() {},
    }),
  );
  assert.match(markup, /Admin role is read-only/);
  assert.equal(markup.includes("Save reviewed policy"), false);
  assert.equal(markup.includes("Enable lifecycle"), false);
});
