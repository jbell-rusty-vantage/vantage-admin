/** UI1-SHELL gallery rows, trimmed from the contract fixtures (follow-ups, corrections and nudges emptied). Generated; do not edit by hand. */
export const RECORD_HEADER_FIXTURES = {
 "ownerKept": {
  "source": "S6/outreach__t3-owner-kept.json",
  "read": {
   "as_of": "2026-09-24T22:59:26.670Z",
   "coverage": {
    "known_through": "2026-09-24T22:48:13.875Z",
    "gaps": [],
    "capabilities": {
     "call_log": "ok",
     "recording_content": "ok",
     "webhook": "unknown"
    },
    "ai_paused": false,
    "recordings": {
     "pending_discovery": 289,
     "media_pending": 0,
     "media_stored": 2,
     "no_recording": 0,
     "unavailable": 0,
     "failed": 0,
     "eligibility_undetermined": 0
    }
   },
   "data": {
    "outreach": {
     "id": "6ab5ab1972ee2eb383d948ce",
     "revision": 4,
     "lead_progress": {
      "lead_ref": {
       "model": "FormLead",
       "id": "6ab5ab1972ee2eb383d948ca"
      },
      "granot_priority": null,
      "priority_label": "Not set",
      "quoted": false,
      "disposition": "unknown",
      "disposition_label": "Unknown",
      "work_observed": false,
      "basis": null,
      "basis_label": null,
      "provenance": "none",
      "source_origin": null,
      "source_applied_at": null,
      "last_progress_at": null,
      "first_work_observed_at": null,
      "closure": null,
      "override": null,
      "reopen_review_id": null,
      "disposition_revision": "9768ec767ed1ffd191f3c1a35a894830789116a1b2d9487dac63343f5cec042d",
      "explanation": null,
      "no_call_observed": false,
      "projected_at": "2026-09-19T22:59:13.875Z"
     },
     "primary_number": {
      "id": "6ab5ab1972ee2eb383d948c9",
      "e164": "+13055551073"
     },
     "lead_display": {
      "name": "T3 Owner Kept",
      "job_no": "5590073",
      "source_company": "MoveBuddy"
     },
     "latest_number_call": null,
     "lead_attachment": null,
     "call_progress": null,
     "live_call": null,
     "band_since": {
      "at": "2026-09-19T23:28:13.875Z",
      "estimated": true
     },
     "move_assessment": null,
     "facts": {
      "route": {
       "pickup_city": "Boston",
       "pickup_state": "MA",
       "delivery_city": "Nashville",
       "delivery_state": "TN",
       "move_date": "2026-10-24",
       "source": "lead"
      },
      "move_date_passed": false,
      "last_call_at": null,
      "calls_total": 0,
      "conversations_total": 0,
      "recordings_available": 0,
      "recordings_analyzed": 0,
      "newer_call_since_assessment": false,
      "details_disagree": false,
      "next_action_state": "none",
      "rep_thread": null
     },
     "suggested_next_step": null,
     "subject": {
      "kind": "lead",
      "model": "FormLead",
      "id": "6ab5ab1972ee2eb383d948ca"
     },
     "state": "unworked",
     "reason": null,
     "assignment": {
      "agent": {
       "id": "6ab5ab0d72ee2eb383d940a9",
       "name": "Tina Cho"
      },
      "origin": "owner",
      "assigned_at": "2026-09-24T22:58:33.369Z",
      "evidence_ref": null,
      "owner_instruction_id": "6ab5ab1972ee2eb383d948d9"
     },
     "followups": [],
     "followups_cursor": null,
     "next_action": null,
     "first_human_conversation_at": null,
     "trigger_at": "2026-09-19T22:58:13.875Z",
     "first_action_due_at": "2026-09-19T23:28:13.875Z",
     "first_attributable_outbound_at": null,
     "last_meaningful_contact_at": null,
     "last_inbound_human_at": null,
     "last_attributable_outbound_at": null,
     "prior_contact_at": null,
     "last_activity_at": "2026-09-24T22:58:33.369Z",
     "derived": {
      "overdue": true,
      "no_owner": false,
      "no_next_action": false,
      "cooldown": false,
      "attention_band": 2,
      "reasons": [
       "no_call_yet"
      ],
      "review_item_ids": [],
      "call_blockers": [],
      "age_wall_ms": 432072795,
      "age_staffed_ms": 172872795,
      "policy_version": "csi-policy-v1",
      "missing_record_responsibility": false,
      "missing_action_responsibility": [],
      "review_badges": [],
      "absence_qualified": false,
      "action_facts": [],
      "call_state": "not_started",
      "provenance_state": "needs_a_lead"
     },
     "related_record_links": [
      {
       "model": "FormLead",
       "id": "6ab5ab1972ee2eb383d948ca",
       "href": "/form-leads?record=6ab5ab1972ee2eb383d948ca&database_scope=production",
       "certainty": "exact"
      }
     ],
     "allowed_actions": [
      {
       "action": "mark_worked",
       "enabled": true,
       "blocker_codes": [],
       "target_id": "6ab5ab1972ee2eb383d948ce",
       "expected_revision": 4
      },
      {
       "action": "assign",
       "enabled": true,
       "blocker_codes": [],
       "target_id": "6ab5ab1972ee2eb383d948ce",
       "expected_revision": 4
      },
      {
       "action": "set_waiting",
       "enabled": true,
       "blocker_codes": [],
       "target_id": "6ab5ab1972ee2eb383d948ce",
       "expected_revision": 4
      },
      {
       "action": "add_note",
       "enabled": true,
       "blocker_codes": [],
       "target_id": "6ab5ab1972ee2eb383d948ce",
       "expected_revision": 4
      },
      {
       "action": "close",
       "enabled": true,
       "blocker_codes": [],
       "target_id": "6ab5ab1972ee2eb383d948ce",
       "expected_revision": 4
      },
      {
       "action": "reopen",
       "enabled": false,
       "blocker_codes": [],
       "target_id": "6ab5ab1972ee2eb383d948ce",
       "expected_revision": 4
      },
      {
       "action": "create_followup",
       "enabled": true,
       "blocker_codes": [],
       "target_id": "6ab5ab1972ee2eb383d948ce",
       "expected_revision": 4
      },
      {
       "action": "override_disposition",
       "enabled": false,
       "blocker_codes": [
        "ILLEGAL_TRANSITION"
       ],
       "target_id": "6ab5ab1972ee2eb383d948ce",
       "expected_revision": 4
      },
      {
       "action": "start_call",
       "enabled": true,
       "blocker_codes": [],
       "target_id": "6ab5ab1972ee2eb383d948ce",
       "expected_revision": 4
      },
      {
       "action": "end_call",
       "enabled": false,
       "blocker_codes": [
        "ILLEGAL_TRANSITION"
       ],
       "target_id": "6ab5ab1972ee2eb383d948ce",
       "expected_revision": 4
      }
     ],
     "newest_run_id": null,
     "latest_summary": null,
     "official": {
      "status": "open_lead",
      "booking_id": null,
      "priority": null
     },
     "receiver_agent": {
      "agent": {
       "id": "6ab5ab0d72ee2eb383d940a7",
       "name": "Dana Reyes"
      },
      "source": "granot_username_match",
      "set_at": "2026-09-23T15:00:13.875Z"
     },
     "lead_cost": {
      "amount": 0,
      "basis": "zero"
     }
    },
    "owner_instructions": [],
    "nudges": {
     "items": [],
     "next_cursor": null
    }
   }
  }
 },
 "liveCall": {
  "source": "S5c/outreach__t3-live-call.json",
  "read": {
   "as_of": "2026-09-24T18:39:43.908Z",
   "coverage": {
    "known_through": "2026-09-24T18:28:32.469Z",
    "gaps": [],
    "capabilities": {
     "call_log": "ok",
     "recording_content": "ok",
     "webhook": "unknown"
    },
    "ai_paused": false,
    "recordings": {
     "pending_discovery": 264,
     "media_pending": 0,
     "media_stored": 2,
     "no_recording": 0,
     "unavailable": 0,
     "failed": 0,
     "eligibility_undetermined": 0
    }
   },
   "data": {
    "outreach": {
     "id": "6ab56e423fac6b3b34157971",
     "revision": 4,
     "lead_progress": {
      "lead_ref": {
       "model": "FormLead",
       "id": "6ab56e423fac6b3b3415796c"
      },
      "granot_priority": null,
      "priority_label": "Not set",
      "quoted": false,
      "disposition": "unknown",
      "disposition_label": "Unknown",
      "work_observed": false,
      "basis": null,
      "basis_label": null,
      "provenance": "none",
      "source_origin": null,
      "source_applied_at": null,
      "last_progress_at": null,
      "first_work_observed_at": null,
      "closure": null,
      "override": null,
      "reopen_review_id": null,
      "disposition_revision": "9768ec767ed1ffd191f3c1a35a894830789116a1b2d9487dac63343f5cec042d",
      "explanation": null,
      "no_call_observed": false,
      "projected_at": "2026-09-22T18:39:32.469Z"
     },
     "primary_number": {
      "id": "6ab56e423fac6b3b3415796b",
      "e164": "+16155551057"
     },
     "lead_display": {
      "name": "T3 Live Caller",
      "job_no": "5590057",
      "source_company": "MoveBuddy"
     },
     "latest_number_call": {
      "id": "6ab56e423fac6b3b34157978",
      "happened_at": "2026-09-24T18:35:32.469Z",
      "direction": "Outbound",
      "provider_result": null,
      "contact_type": "unknown"
     },
     "lead_attachment": null,
     "call_progress": {
      "state": "in_progress",
      "started_at": "2026-09-24T18:34:32.469Z",
      "started_by": "5eed00000000000000000001",
      "ended_at": null,
      "ended_by": null,
      "note": "Owner calling from the desk"
     },
     "live_call": {
      "interaction_id": "6ab56e423fac6b3b34157978",
      "direction": "Outbound",
      "started_at": "2026-09-24T18:35:32.469Z",
      "rep": {
       "kind": "reviewed",
       "agent_id": "6ab56e333fac6b3b3415728d",
       "name": "Dana Reyes",
       "extension": "101",
       "text": "Dana Reyes (ext 101, reviewed)"
      }
     },
     "move_assessment": null,
     "facts": {
      "route": {
       "pickup_city": "Denver",
       "pickup_state": "CO",
       "delivery_city": "Denver",
       "delivery_state": "CO",
       "move_date": "2026-10-24",
       "source": "lead"
      },
      "move_date_passed": false,
      "last_call_at": "2026-09-24T18:35:32.469Z",
      "calls_total": 2,
      "conversations_total": 1,
      "recordings_available": 0,
      "recordings_analyzed": 0,
      "newer_call_since_assessment": false,
      "details_disagree": false,
      "next_action_state": "none",
      "rep_thread": null
     },
     "suggested_next_step": null,
     "subject": {
      "kind": "lead",
      "model": "FormLead",
      "id": "6ab56e423fac6b3b3415796c"
     },
     "state": "open",
     "reason": null,
     "assignment": {
      "agent": {
       "id": "6ab56e333fac6b3b3415728d",
       "name": "Dana Reyes"
      },
      "origin": "first_conversation",
      "assigned_at": "2026-09-22T22:38:32.469Z",
      "evidence_ref": "6ab56e423fac6b3b3415796e",
      "owner_instruction_id": null
     },
     "followups": [],
     "followups_cursor": null,
     "next_action": null,
     "first_human_conversation_at": "2026-09-22T22:38:32.469Z",
     "trigger_at": "2026-09-22T18:38:32.469Z",
     "first_action_due_at": "2026-09-22T19:08:32.469Z",
     "first_attributable_outbound_at": "2026-09-22T22:38:32.469Z",
     "last_meaningful_contact_at": "2026-09-22T22:38:32.469Z",
     "last_inbound_human_at": null,
     "last_attributable_outbound_at": "2026-09-22T22:38:32.469Z",
     "prior_contact_at": null,
     "last_activity_at": "2026-09-22T22:38:32.469Z",
     "derived": {
      "overdue": false,
      "no_owner": false,
      "no_next_action": true,
      "cooldown": false,
      "attention_band": 5,
      "reasons": [
       "no_next_step"
      ],
      "review_item_ids": [],
      "call_blockers": [],
      "age_wall_ms": 158471439,
      "age_staffed_ms": 72071439,
      "policy_version": "csi-policy-v1",
      "missing_record_responsibility": false,
      "missing_action_responsibility": [],
      "review_badges": [],
      "absence_qualified": false,
      "action_facts": [],
      "call_state": "in_progress",
      "provenance_state": "needs_a_lead"
     },
     "related_record_links": [
      {
       "model": "FormLead",
       "id": "6ab56e423fac6b3b3415796c",
       "href": "/form-leads?record=6ab56e423fac6b3b3415796c&database_scope=production",
       "certainty": "exact"
      }
     ],
     "allowed_actions": [
      {
       "action": "mark_worked",
       "enabled": true,
       "blocker_codes": [],
       "target_id": "6ab56e423fac6b3b34157971",
       "expected_revision": 4
      },
      {
       "action": "assign",
       "enabled": true,
       "blocker_codes": [],
       "target_id": "6ab56e423fac6b3b34157971",
       "expected_revision": 4
      },
      {
       "action": "set_waiting",
       "enabled": true,
       "blocker_codes": [],
       "target_id": "6ab56e423fac6b3b34157971",
       "expected_revision": 4
      },
      {
       "action": "add_note",
       "enabled": true,
       "blocker_codes": [],
       "target_id": "6ab56e423fac6b3b34157971",
       "expected_revision": 4
      },
      {
       "action": "close",
       "enabled": true,
       "blocker_codes": [],
       "target_id": "6ab56e423fac6b3b34157971",
       "expected_revision": 4
      },
      {
       "action": "reopen",
       "enabled": false,
       "blocker_codes": [],
       "target_id": "6ab56e423fac6b3b34157971",
       "expected_revision": 4
      },
      {
       "action": "create_followup",
       "enabled": true,
       "blocker_codes": [],
       "target_id": "6ab56e423fac6b3b34157971",
       "expected_revision": 4
      },
      {
       "action": "override_disposition",
       "enabled": false,
       "blocker_codes": [
        "ILLEGAL_TRANSITION"
       ],
       "target_id": "6ab56e423fac6b3b34157971",
       "expected_revision": 4
      },
      {
       "action": "start_call",
       "enabled": false,
       "blocker_codes": [
        "ILLEGAL_TRANSITION"
       ],
       "target_id": "6ab56e423fac6b3b34157971",
       "expected_revision": 4
      },
      {
       "action": "end_call",
       "enabled": true,
       "blocker_codes": [],
       "target_id": "6ab56e423fac6b3b34157971",
       "expected_revision": 4
      }
     ],
     "newest_run_id": null,
     "latest_summary": null,
     "official": {
      "status": "open_lead",
      "booking_id": null,
      "priority": null
     }
    },
    "owner_instructions": [],
    "nudges": {
     "items": [],
     "next_cursor": null
    }
   }
  }
 }
};
