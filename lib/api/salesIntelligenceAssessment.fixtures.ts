/**
 * Owner presentation payloads captured from the server read adapters (vantage-main-server
 * `assessment/presentation.ts` over `assessment/presentation.fixtures.ts`, 2026-09-22): legacy run, structured run,
 * run outputs, assessment output and evidence, and Outreach assessment reads for ready, assessment-only (no Contact
 * Number), not assessed, pending, closed and purged subjects. Synthetic identifiers only. Test data; not imported by runtime code.
 */
export const ASSESSMENT_DTO_FIXTURES = {
 "legacyRun": {
  "run_id": "00000000000000000000000a",
  "summary_findings": {
   "availability": "ready",
   "scope": "conversation",
   "source": {
    "kind": "legacy_run",
    "id": "00000000000000000000000a",
    "version": "csi-envelope-v1",
    "generated_at": "2026-09-10T12:00:00.000Z",
    "model_version": "openai/gpt-5-mini",
    "prompt_version": "csi-agent-v3"
   },
   "summary": {
    "sections": [
     {
      "key": "overview",
      "label": "Overview",
      "text": "Customer is moving a two-bedroom apartment."
     },
     {
      "key": "customer_wanted",
      "label": "What the customer wanted",
      "text": "A quote for next month."
     },
     {
      "key": "money_and_dates",
      "label": "Money and dates",
      "text": "Budget around $2,000; moving October 15."
     },
     {
      "key": "outcome",
      "label": "Outcome",
      "text": "Rep promised a callback."
     },
     {
      "key": "commitments",
      "label": "Commitments",
      "text": "Call back Friday."
     },
     {
      "key": "discrepancies",
      "label": "Discrepancies",
      "text": ""
     }
    ],
    "narrative": null
   },
   "said_on_call": [],
   "findings": [
    {
     "id": "00000000000000000000001e",
     "kind": "move_fact",
     "claim": "Moving October 15",
     "basis": "said_on_call",
     "actor": "customer",
     "action_status": null,
     "clarity": "clear",
     "review_state": "confirmed",
     "evidence": [
      {
       "id": "transcript:000000000000000000000014:3.4",
       "kind": "transcript_quote",
       "locator": {
        "source": "analysis_transcript",
        "run_id": "00000000000000000000000a",
        "snapshot_id": "000000000000000000000014",
        "conversation_id": "000000000000000000000004",
        "transcript_version": "v1",
        "segment_ids": [
         3,
         4
        ]
       },
       "speaker": null,
       "call_at": null,
       "lineage": []
      }
     ],
     "effects": []
    },
    {
     "id": "00000000000000000000001f",
     "kind": "promised_callback",
     "claim": "Rep will call back Friday",
     "basis": "said_on_call",
     "actor": "rep",
     "action_status": "promised",
     "clarity": "clear",
     "review_state": "unreviewed",
     "evidence": [
      {
       "id": "record:000000000000000000000015:lead:000000000000000000000003",
       "kind": "analysis_record",
       "locator": {
        "source": "analysis_record",
        "run_id": "00000000000000000000000a",
        "snapshot_id": "000000000000000000000015",
        "record_type": "lead",
        "record_id": "000000000000000000000003",
        "field_paths": [
         "move_date"
        ]
       },
       "speaker": null,
       "call_at": null,
       "lineage": []
      }
     ],
     "effects": [
      {
       "kind": "create_followup",
       "status": "applied",
       "reason": null,
       "target_id": "000000000000000000000032"
      }
     ]
    }
   ],
   "suggested_next_step": {
    "action_kind": "send_estimate",
    "description": "Send the estimate",
    "date_text": null,
    "timezone_text": null,
    "rationale": "Customer asked for a quote",
    "target_followup_id": null
   },
   "applied_actions": [
    {
     "id": "000000000000000000000032",
     "kind": "call",
     "description": "Call back Friday",
     "status": "open",
     "due_at": "2026-09-12T12:00:00.000Z"
    }
   ]
  },
  "evidence": {
   "availability": "ready",
   "items": [
    {
     "id": "transcript:000000000000000000000014:3.4",
     "kind": "transcript_quote",
     "source": {
      "source": "analysis_transcript",
      "run_id": "00000000000000000000000a",
      "snapshot_id": "000000000000000000000014",
      "conversation_id": "000000000000000000000004",
      "transcript_version": "v1",
      "segment_ids": [
       3,
       4
      ]
     },
     "availability": "retained",
     "text": "We move on the fifteenth",
     "open": {
      "kind": "analysis_evidence",
      "run_id": "00000000000000000000000a",
      "snapshot_id": "000000000000000000000014"
     }
    },
    {
     "id": "record:000000000000000000000015:lead:000000000000000000000003",
     "kind": "analysis_record",
     "source": {
      "source": "analysis_record",
      "run_id": "00000000000000000000000a",
      "snapshot_id": "000000000000000000000015",
      "record_type": "lead",
      "record_id": "000000000000000000000003",
      "field_paths": [
       "move_date"
      ]
     },
     "availability": "retained",
     "text": null,
     "open": {
      "kind": "analysis_evidence",
      "run_id": "00000000000000000000000a",
      "snapshot_id": "000000000000000000000015"
     }
    }
   ]
  },
  "full_output": [
   {
    "kind": "legacy_analysis",
    "id": "00000000000000000000000a",
    "label": "Analysis output",
    "generated_at": "2026-09-10T12:00:00.000Z",
    "version": "csi-envelope-v1",
    "available": true
   }
  ]
 },
 "structuredRun": {
  "run_id": "00000000000000000000000b",
  "summary_findings": {
   "availability": "ready",
   "scope": "conversation",
   "source": {
    "kind": "structured_run",
    "id": "00000000000000000000000b",
    "version": "csi-envelope-v1",
    "generated_at": "2026-09-10T12:00:00.000Z",
    "model_version": "openai/gpt-5-mini",
    "prompt_version": "csi-findings-v1"
   },
   "summary": {
    "sections": [
     {
      "key": "overview",
      "label": "Overview",
      "text": "Structured: customer moving a two-bedroom apartment."
     },
     {
      "key": "customer_wanted",
      "label": "What the customer wanted",
      "text": "A quote for next month."
     },
     {
      "key": "money_and_dates",
      "label": "Money and dates",
      "text": "Budget around $2,000; moving October 15."
     },
     {
      "key": "outcome",
      "label": "Outcome",
      "text": "Rep promised a callback."
     },
     {
      "key": "commitments",
      "label": "Commitments",
      "text": "Call back Friday."
     },
     {
      "key": "discrepancies",
      "label": "Discrepancies",
      "text": ""
     }
    ],
    "narrative": null
   },
   "said_on_call": [
    {
     "index": 0,
     "call_index": 0,
     "kind": "move_fact",
     "speaker": "customer",
     "text": "Customer said they move October 15",
     "segment_ids": [
      3
     ]
    }
   ],
   "findings": [
    {
     "id": "00000000000000000000001e",
     "kind": "move_fact",
     "claim": "Moving October 15",
     "basis": "said_on_call",
     "actor": "customer",
     "action_status": null,
     "clarity": "clear",
     "review_state": "confirmed",
     "evidence": [
      {
       "id": "transcript:000000000000000000000014:3.4",
       "kind": "transcript_quote",
       "locator": {
        "source": "analysis_transcript",
        "run_id": "00000000000000000000000b",
        "snapshot_id": "000000000000000000000014",
        "conversation_id": "000000000000000000000004",
        "transcript_version": "v1",
        "segment_ids": [
         3,
         4
        ]
       },
       "speaker": null,
       "call_at": null,
       "lineage": []
      }
     ],
     "effects": []
    },
    {
     "id": "00000000000000000000001f",
     "kind": "promised_callback",
     "claim": "Rep will call back Friday",
     "basis": "said_on_call",
     "actor": "rep",
     "action_status": "promised",
     "clarity": "clear",
     "review_state": "unreviewed",
     "evidence": [
      {
       "id": "record:000000000000000000000015:lead:000000000000000000000003",
       "kind": "analysis_record",
       "locator": {
        "source": "analysis_record",
        "run_id": "00000000000000000000000b",
        "snapshot_id": "000000000000000000000015",
        "record_type": "lead",
        "record_id": "000000000000000000000003",
        "field_paths": [
         "move_date"
        ]
       },
       "speaker": null,
       "call_at": null,
       "lineage": []
      }
     ],
     "effects": []
    }
   ],
   "suggested_next_step": {
    "action_kind": "send_estimate",
    "description": "Send the estimate",
    "date_text": null,
    "timezone_text": null,
    "rationale": "Customer asked for a quote",
    "target_followup_id": null
   },
   "applied_actions": []
  },
  "evidence": {
   "availability": "ready",
   "items": [
    {
     "id": "summary:000000000000000000000016",
     "kind": "summary_section",
     "source": {
      "source": "summary_artifact",
      "snapshot_id": "000000000000000000000016",
      "content_digest": "9b1dbb46eec7e50d88821cc014cf0e127b85bfb5a5346a7c83d7c333aa23f708",
      "conversation_id": "000000000000000000000004",
      "transcript_version": "v1",
      "section": "summary"
     },
     "availability": "retained",
     "text": null,
     "open": {
      "kind": "summary_artifact",
      "snapshot_id": "000000000000000000000016"
     }
    },
    {
     "id": "transcript:000000000000000000000014:3.4",
     "kind": "transcript_quote",
     "source": {
      "source": "analysis_transcript",
      "run_id": "00000000000000000000000b",
      "snapshot_id": "000000000000000000000014",
      "conversation_id": "000000000000000000000004",
      "transcript_version": "v1",
      "segment_ids": [
       3,
       4
      ]
     },
     "availability": "retained",
     "text": "We move on the fifteenth",
     "open": null
    },
    {
     "id": "record:000000000000000000000015:lead:000000000000000000000003",
     "kind": "analysis_record",
     "source": {
      "source": "analysis_record",
      "run_id": "00000000000000000000000b",
      "snapshot_id": "000000000000000000000015",
      "record_type": "lead",
      "record_id": "000000000000000000000003",
      "field_paths": [
       "move_date"
      ]
     },
     "availability": "retained",
     "text": null,
     "open": null
    }
   ]
  },
  "full_output": [
   {
    "kind": "conversation_summary",
    "id": "000000000000000000000016",
    "label": "Conversation summary",
    "generated_at": "2026-09-09T12:00:00.000Z",
    "version": "9b1dbb46eec7e50d88821cc014cf0e127b85bfb5a5346a7c83d7c333aa23f708",
    "available": true
   },
   {
    "kind": "findings",
    "id": "00000000000000000000000b",
    "label": "Findings output",
    "generated_at": "2026-09-10T12:00:00.000Z",
    "version": "csi-envelope-v1",
    "available": true
   }
  ]
 },
 "legacyOutput": {
  "kind": "legacy_analysis",
  "id": "00000000000000000000000a",
  "version": "csi-envelope-v1",
  "generated_at": "2026-09-10T12:00:00.000Z",
  "availability": "ready",
  "complete": true,
  "model_output": {
   "schema_version": "csi-envelope-v1",
   "summary": {
    "overview": "Customer is moving a two-bedroom apartment.",
    "customer_wanted": "A quote for next month.",
    "money_and_dates": "Budget around $2,000; moving October 15.",
    "outcome": "Rep promised a callback.",
    "commitments": "Call back Friday.",
    "discrepancies": "",
    "finding_keys": [
     "f1",
     "f2"
    ]
   },
   "findings": [
    {
     "key": "f1",
     "kind": "move_fact",
     "claim": "Moving October 15",
     "basis": "said_on_call",
     "actor": "customer",
     "speaker_ref": null,
     "action_status": null,
     "clarity": "clear",
     "confidence": null,
     "value": {
      "field": "move_date",
      "stated_value": "October 15"
     },
     "evidence": [
      {
       "source": "transcript",
       "snapshot_id": "000000000000000000000014",
       "conversation_id": "000000000000000000000004",
       "transcript_version": "v1",
       "segment_ids": [
        3,
        4
       ],
       "quote": "We move on the fifteenth"
      }
     ]
    },
    {
     "key": "f2",
     "kind": "promised_callback",
     "claim": "Rep will call back Friday",
     "basis": "said_on_call",
     "actor": "rep",
     "speaker_ref": null,
     "action_status": "promised",
     "clarity": "clear",
     "confidence": null,
     "value": {
      "action_kind": "call",
      "description": "Call back Friday",
      "date_text": "Friday",
      "timezone_text": null,
      "target_followup_id": null
     },
     "evidence": [
      {
       "source": "vantage_record",
       "snapshot_id": "000000000000000000000015",
       "record_type": "lead",
       "record_id": "000000000000000000000003",
       "field_paths": [
        "move_date"
       ]
      }
     ]
    }
   ],
   "next_step_suggestion": {
    "action_kind": "send_estimate",
    "description": "Send the estimate",
    "date_text": null,
    "timezone_text": null,
    "target_followup_id": null,
    "rationale": "Customer asked for a quote",
    "finding_keys": [
     "f1"
    ]
   },
   "owner_instruction_assessments": []
  },
  "accepted": null,
  "details": {
   "schema_version": "csi-envelope-v1",
   "prompt_version": "csi-agent-v3",
   "model_version": "openai/gpt-5-mini",
   "digests": {
    "output_digest": "3ffc9e1d395adcbad31efe2440a82eb7f09263a7e060347128e5b7fc18b7868d"
   }
  }
 },
 "structuredFindingsOutput": {
  "kind": "findings",
  "id": "00000000000000000000000b",
  "version": "csi-envelope-v1",
  "generated_at": "2026-09-10T12:00:00.000Z",
  "availability": "ready",
  "complete": true,
  "model_output": null,
  "accepted": {
   "schema_version": "csi-envelope-v1",
   "summary": {
    "overview": "Customer is moving a two-bedroom apartment.",
    "customer_wanted": "A quote for next month.",
    "money_and_dates": "Budget around $2,000; moving October 15.",
    "outcome": "Rep promised a callback.",
    "commitments": "Call back Friday.",
    "discrepancies": "",
    "finding_keys": [
     "f1",
     "f2"
    ]
   },
   "findings": [
    {
     "key": "f1",
     "kind": "move_fact",
     "claim": "Moving October 15",
     "basis": "said_on_call",
     "actor": "customer",
     "speaker_ref": null,
     "action_status": null,
     "clarity": "clear",
     "confidence": null,
     "value": {
      "field": "move_date",
      "stated_value": "October 15"
     },
     "evidence": [
      {
       "source": "transcript",
       "snapshot_id": "000000000000000000000016",
       "conversation_id": "000000000000000000000004",
       "transcript_version": "v1",
       "segment_ids": [
        3,
        4
       ],
       "quote": "We move on the fifteenth"
      }
     ]
    },
    {
     "key": "f2",
     "kind": "promised_callback",
     "claim": "Rep will call back Friday",
     "basis": "said_on_call",
     "actor": "rep",
     "speaker_ref": null,
     "action_status": "promised",
     "clarity": "clear",
     "confidence": null,
     "value": {
      "action_kind": "call",
      "description": "Call back Friday",
      "date_text": "Friday",
      "timezone_text": null,
      "target_followup_id": null
     },
     "evidence": [
      {
       "source": "vantage_record",
       "snapshot_id": "000000000000000000000017",
       "record_type": "lead",
       "record_id": "000000000000000000000003",
       "field_paths": [
        "move_date"
       ]
      }
     ]
    }
   ],
   "next_step_suggestion": {
    "action_kind": "send_estimate",
    "description": "Send the estimate",
    "date_text": null,
    "timezone_text": null,
    "target_followup_id": null,
    "rationale": "Customer asked for a quote",
    "finding_keys": [
     "f1"
    ]
   },
   "owner_instruction_assessments": []
  },
  "details": {
   "schema_version": "csi-envelope-v1",
   "prompt_version": "csi-findings-v1",
   "model_version": "openai/gpt-5-mini",
   "digests": {
    "output_digest": "9bc8f9953328d58dd664919612dedbe682fd186e815d0c91c0ae571962125bdc"
   }
  }
 },
 "structuredSummaryOutput": {
  "kind": "conversation_summary",
  "id": "000000000000000000000016",
  "version": "9b1dbb46eec7e50d88821cc014cf0e127b85bfb5a5346a7c83d7c333aa23f708",
  "generated_at": "2026-09-09T12:00:00.000Z",
  "availability": "ready",
  "complete": true,
  "model_output": {
   "summary": {
    "overview": "Structured: customer moving a two-bedroom apartment.",
    "customer_wanted": "A quote for next month.",
    "money_and_dates": "Budget around $2,000; moving October 15.",
    "outcome": "Rep promised a callback.",
    "commitments": "Call back Friday.",
    "discrepancies": ""
   },
   "said_on_call": [
    {
     "claim": "Customer said they move October 15",
     "actor": "customer",
     "action_status": null,
     "clarity": "clear",
     "kind": "move_fact",
     "value": {
      "field": "move_date",
      "stated_value": "October 15"
     },
     "speaker": "customer",
     "segment_ids": [
      3
     ],
     "quote": "We move on the fifteenth"
    }
   ]
  },
  "accepted": null,
  "details": {
   "schema_version": "csi-envelope-v1",
   "prompt_version": "csi-findings-v1",
   "model_version": "openai/gpt-5-mini",
   "digests": {
    "content_digest": "9b1dbb46eec7e50d88821cc014cf0e127b85bfb5a5346a7c83d7c333aa23f708"
   }
  }
 },
 "assessmentOutput": {
  "kind": "move_assessment",
  "id": "000000000000000000000046",
  "version": "move-assessment-v1",
  "generated_at": "2026-09-20T12:00:00.000Z",
  "availability": "ready",
  "complete": true,
  "model_output": {
   "move_likelihood": {
    "level": "strong",
    "confidence": "medium",
    "rationale": "Rationale for strong",
    "evidence_ids": [
     "e1",
     "e2"
    ],
    "conditions": []
   },
   "transaction_intent": {
    "level": "active",
    "confidence": "medium",
    "rationale": "Rationale for active",
    "evidence_ids": [
     "e1",
     "e3"
    ],
    "conditions": []
   },
   "move_details": [
    {
     "field": "move_date",
     "value": {
      "raw_text": "the fifteenth",
      "date": "2026-10-15",
      "end_date": null,
      "applies_to": "pickup",
      "flexibility": "fixed",
      "precision": "exact"
     },
     "status": "stated",
     "evidence_ids": [
      "e1"
     ]
    }
   ],
   "inventory": {
    "items": [
     {
      "label": "Sofa",
      "quantity": {
       "min": 1,
       "max": 1
      },
      "room": "Living room",
      "dimensions": null,
      "handling": null,
      "status": "included",
      "evidence_ids": [
       "e1"
      ]
     }
    ],
    "coverage": "partial",
    "limitations": [
     "Garage not discussed"
    ]
   },
   "conflicts": [
    {
     "affects": "move_date",
     "explanation": "Lead says Oct 1, call says Oct 15",
     "evidence_ids": [
      "e1",
      "e2"
     ]
    }
   ]
  },
  "accepted": {
   "scores": {
    "move_likelihood": {
     "level": "strong",
     "confidence": "medium",
     "rationale": "Rationale for strong",
     "evidence_ids": [
      "e1",
      "e2"
     ],
     "conditions": [],
     "score": 75,
     "evidence": [
      {
       "id": "e1",
       "kind": "said_on_call",
       "locator": {
        "source": "summary_artifact",
        "snapshot_id": "000000000000000000000016",
        "content_digest": "9b1dbb46eec7e50d88821cc014cf0e127b85bfb5a5346a7c83d7c333aa23f708",
        "conversation_id": "000000000000000000000004",
        "transcript_version": "v1",
        "section": "said_on_call.0"
       },
       "speaker": "customer",
       "call_at": "2026-09-09T12:00:00.000Z",
       "lineage": []
      },
      {
       "id": "e2",
       "kind": "lead_current",
       "locator": {
        "source": "lead",
        "model": "FormLead",
        "id": "000000000000000000000003",
        "view": "current",
        "field_path": "move_date"
       },
       "speaker": null,
       "call_at": null,
       "lineage": []
      }
     ]
    },
    "transaction_intent": {
     "level": "active",
     "confidence": "medium",
     "rationale": "Rationale for active",
     "evidence_ids": [
      "e1",
      "e3"
     ],
     "conditions": [],
     "score": 50,
     "evidence": [
      {
       "id": "e1",
       "kind": "said_on_call",
       "locator": {
        "source": "summary_artifact",
        "snapshot_id": "000000000000000000000016",
        "content_digest": "9b1dbb46eec7e50d88821cc014cf0e127b85bfb5a5346a7c83d7c333aa23f708",
        "conversation_id": "000000000000000000000004",
        "transcript_version": "v1",
        "section": "said_on_call.0"
       },
       "speaker": "customer",
       "call_at": "2026-09-09T12:00:00.000Z",
       "lineage": []
      },
      {
       "id": "e3",
       "kind": "finding",
       "locator": {
        "source": "finding",
        "finding_id": "00000000000000000000001e",
        "run_id": "00000000000000000000000a",
        "revision": 1,
        "conversation_id": "000000000000000000000004"
       },
       "speaker": null,
       "call_at": null,
       "lineage": [
        "e1"
       ]
      }
     ]
    }
   },
   "views": {
    "original_ingestion": {
     "pickup": {
      "city": "Austin",
      "state": "TX",
      "zip": "78701"
     },
     "delivery": {
      "city": "Denver",
      "state": "CO",
      "zip": "80202"
     },
     "move_date": "2026-10-01",
     "move_size": "2 bedroom",
     "granot_move_size": null,
     "cubic_feet": null,
     "provenance": {
      "source_system": "granot",
      "changed_at": "2026-09-05T00:00:00.000Z",
      "observation_id": null
     },
     "captured_at": "2026-09-01T00:00:00.000Z",
     "evidence_status": "captured_at_ingestion",
     "ingestion_origin": "wordpress",
     "label": "original_form_submission"
    },
    "canonical_current": {
     "pickup": {
      "city": "Austin",
      "state": "TX",
      "zip": "78701"
     },
     "delivery": {
      "city": "Denver",
      "state": "CO",
      "zip": "80202"
     },
     "move_date": "2026-10-15",
     "move_size": "2 bedroom",
     "granot_move_size": null,
     "cubic_feet": null,
     "provenance": {
      "source_system": "granot",
      "changed_at": "2026-09-05T00:00:00.000Z",
      "observation_id": null
     }
    },
    "customer_stated": [
     {
      "field": "move_date",
      "value": {
       "raw_text": "the fifteenth",
       "date": "2026-10-15",
       "end_date": null,
       "applies_to": "pickup",
       "flexibility": "fixed",
       "precision": "exact"
      },
      "status": "stated",
      "evidence_ids": [
       "e1"
      ],
      "evidence": [
       {
        "id": "e1",
        "kind": "said_on_call",
        "locator": {
         "source": "summary_artifact",
         "snapshot_id": "000000000000000000000016",
         "content_digest": "9b1dbb46eec7e50d88821cc014cf0e127b85bfb5a5346a7c83d7c333aa23f708",
         "conversation_id": "000000000000000000000004",
         "transcript_version": "v1",
         "section": "said_on_call.0"
        },
        "speaker": "customer",
        "call_at": "2026-09-09T12:00:00.000Z",
        "lineage": []
       }
      ]
     }
    ]
   },
   "inventory": {
    "items": [
     {
      "label": "Sofa",
      "quantity": {
       "min": 1,
       "max": 1
      },
      "room": "Living room",
      "dimensions": null,
      "handling": null,
      "status": "included",
      "evidence_ids": [
       "e1"
      ],
      "evidence": [
       {
        "id": "e1",
        "kind": "said_on_call",
        "locator": {
         "source": "summary_artifact",
         "snapshot_id": "000000000000000000000016",
         "content_digest": "9b1dbb46eec7e50d88821cc014cf0e127b85bfb5a5346a7c83d7c333aa23f708",
         "conversation_id": "000000000000000000000004",
         "transcript_version": "v1",
         "section": "said_on_call.0"
        },
        "speaker": "customer",
        "call_at": "2026-09-09T12:00:00.000Z",
        "lineage": []
       }
      ]
     }
    ],
    "coverage": "partial",
    "limitations": [
     "Garage not discussed"
    ]
   },
   "conflicts": [
    {
     "affects": "move_date",
     "explanation": "Lead says Oct 1, call says Oct 15",
     "evidence_ids": [
      "e1",
      "e2"
     ],
     "evidence": [
      {
       "id": "e1",
       "kind": "said_on_call",
       "locator": {
        "source": "summary_artifact",
        "snapshot_id": "000000000000000000000016",
        "content_digest": "9b1dbb46eec7e50d88821cc014cf0e127b85bfb5a5346a7c83d7c333aa23f708",
        "conversation_id": "000000000000000000000004",
        "transcript_version": "v1",
        "section": "said_on_call.0"
       },
       "speaker": "customer",
       "call_at": "2026-09-09T12:00:00.000Z",
       "lineage": []
      },
      {
       "id": "e2",
       "kind": "lead_current",
       "locator": {
        "source": "lead",
        "model": "FormLead",
        "id": "000000000000000000000003",
        "view": "current",
        "field_path": "move_date"
       },
       "speaker": null,
       "call_at": null,
       "lineage": []
      },
      {
       "id": "e4",
       "kind": "official_state",
       "locator": {
        "source": "official",
        "model": "BookedLead",
        "id": "00000000000000000000003c",
        "field_path": "booked"
       },
       "speaker": null,
       "call_at": null,
       "lineage": []
      },
      {
       "id": "e5",
       "kind": "legacy_summary_section",
       "locator": {
        "source": "legacy_run",
        "run_id": "00000000000000000000000a",
        "output_digest": "3ffc9e1d395adcbad31efe2440a82eb7f09263a7e060347128e5b7fc18b7868d",
        "conversation_id": "000000000000000000000004",
        "section": "money_and_dates"
       },
       "speaker": null,
       "call_at": null,
       "lineage": []
      },
      {
       "id": "e6",
       "kind": "legacy_summary_section",
       "locator": {
        "source": "conversation_summary",
        "conversation_id": "000000000000000000000004",
        "text_digest": "a93fdd6727c2cd3785bc16b33c4e8433ad0b7d81c6de01136dffd0396d5d8b7f",
        "section": "money_dates"
       },
       "speaker": null,
       "call_at": null,
       "lineage": []
      },
      {
       "id": "e7",
       "kind": "owner_correction",
       "locator": {
        "source": "owner_correction",
        "instruction_id": "000000000000000000000050",
        "revision": 2
       },
       "speaker": null,
       "call_at": null,
       "lineage": []
      }
     ]
    }
   ],
   "coverage": {
    "conversations_available": 2,
    "conversations_selected": 1,
    "findings_selected": 1,
    "source_coverage": "partial"
   }
  },
  "details": {
   "schema_version": "move-assessment-v1",
   "prompt_version": "csi-move-assessment-v1",
   "model_version": "openai/gpt-5-mini",
   "digests": {
    "prompt_digest": "pd",
    "schema_digest": "sd",
    "input_fingerprint": "fp-new"
   }
  }
 },
 "purgedAssessmentOutput": {
  "kind": "move_assessment",
  "id": "000000000000000000000048",
  "version": "move-assessment-v1",
  "generated_at": "2026-09-20T12:00:00.000Z",
  "availability": "purged",
  "complete": false,
  "model_output": null,
  "accepted": null,
  "details": {
   "schema_version": "move-assessment-v1",
   "prompt_version": "csi-move-assessment-v1",
   "model_version": "openai/gpt-5-mini",
   "digests": {
    "prompt_digest": "pd",
    "schema_digest": "sd",
    "input_fingerprint": "fp-new"
   }
  }
 },
 "assessmentEvidence": {
  "availability": "ready",
  "items": [
   {
    "id": "e1",
    "kind": "said_on_call",
    "source": {
     "source": "summary_artifact",
     "snapshot_id": "000000000000000000000016",
     "content_digest": "9b1dbb46eec7e50d88821cc014cf0e127b85bfb5a5346a7c83d7c333aa23f708",
     "conversation_id": "000000000000000000000004",
     "transcript_version": "v1",
     "section": "said_on_call.0"
    },
    "availability": "retained",
    "text": "Customer said they move October 15",
    "open": {
     "kind": "summary_artifact",
     "snapshot_id": "000000000000000000000016"
    }
   },
   {
    "id": "e3",
    "kind": "finding",
    "source": {
     "source": "finding",
     "finding_id": "00000000000000000000001e",
     "run_id": "00000000000000000000000a",
     "revision": 1,
     "conversation_id": "000000000000000000000004"
    },
    "availability": "retained",
    "text": "Moving October 15",
    "open": {
     "kind": "analysis_run",
     "run_id": "00000000000000000000000a"
    }
   },
   {
    "id": "e2",
    "kind": "lead_current",
    "source": {
     "source": "lead",
     "model": "FormLead",
     "id": "000000000000000000000003",
     "view": "current",
     "field_path": "move_date"
    },
    "availability": "retained",
    "text": null,
    "open": {
     "kind": "record",
     "model": "FormLead",
     "id": "000000000000000000000003",
     "href": "/form-leads?record=000000000000000000000003&database_scope=production"
    }
   },
   {
    "id": "e4",
    "kind": "official_state",
    "source": {
     "source": "official",
     "model": "BookedLead",
     "id": "00000000000000000000003c",
     "field_path": "booked"
    },
    "availability": "retained",
    "text": null,
    "open": {
     "kind": "record",
     "model": "BookedLead",
     "id": "00000000000000000000003c",
     "href": "/bookings?record=00000000000000000000003c&database_scope=production"
    }
   },
   {
    "id": "e5",
    "kind": "legacy_summary_section",
    "source": {
     "source": "legacy_run",
     "run_id": "00000000000000000000000a",
     "output_digest": "3ffc9e1d395adcbad31efe2440a82eb7f09263a7e060347128e5b7fc18b7868d",
     "conversation_id": "000000000000000000000004",
     "section": "money_and_dates"
    },
    "availability": "retained",
    "text": "Budget around $2,000; moving October 15.",
    "open": {
     "kind": "analysis_run",
     "run_id": "00000000000000000000000a"
    }
   },
   {
    "id": "e6",
    "kind": "legacy_summary_section",
    "source": {
     "source": "conversation_summary",
     "conversation_id": "000000000000000000000004",
     "text_digest": "a93fdd6727c2cd3785bc16b33c4e8433ad0b7d81c6de01136dffd0396d5d8b7f",
     "section": "money_dates"
    },
    "availability": "retained",
    "text": "Old money",
    "open": null
   },
   {
    "id": "e7",
    "kind": "owner_correction",
    "source": {
     "source": "owner_correction",
     "instruction_id": "000000000000000000000050",
     "revision": 2
    },
    "availability": "retained",
    "text": null,
    "open": null
   }
  ]
 },
 "outreachReady": {
  "subject": {
   "outreach_record_id": "000000000000000000000001",
   "subject_key": "lead:FormLead:000000000000000000000003",
   "subject": {
    "kind": "lead",
    "model": "FormLead",
    "id": "000000000000000000000003"
   },
   "state": "open",
   "contact_number_id": "000000000000000000000002",
   "applicability": "active"
  },
  "availability": "ready",
  "current": {
   "availability": "ready",
   "artifact_id": "000000000000000000000046",
   "schema_version": "move-assessment-v1",
   "rubric_version": "move-rubric-v1",
   "model_version": "openai/gpt-5-mini",
   "generated_at": "2026-09-20T12:00:00.000Z",
   "context_as_of": "2026-09-20T12:00:00.000Z",
   "latest_conversation_at": "2026-09-09T12:00:00.000Z",
   "input_mode": "summaries_with_findings",
   "shadow": false,
   "current": true,
   "transaction_intent": {
    "score": 50,
    "level": "active",
    "label": "50 / 100",
    "confidence": "medium",
    "rationale": "Rationale for active",
    "conditions": [],
    "evidence": [
     {
      "id": "e1",
      "kind": "said_on_call",
      "locator": {
       "source": "summary_artifact",
       "snapshot_id": "000000000000000000000016",
       "content_digest": "9b1dbb46eec7e50d88821cc014cf0e127b85bfb5a5346a7c83d7c333aa23f708",
       "conversation_id": "000000000000000000000004",
       "transcript_version": "v1",
       "section": "said_on_call.0"
      },
      "speaker": "customer",
      "call_at": "2026-09-09T12:00:00.000Z",
      "lineage": []
     },
     {
      "id": "e3",
      "kind": "finding",
      "locator": {
       "source": "finding",
       "finding_id": "00000000000000000000001e",
       "run_id": "00000000000000000000000a",
       "revision": 1,
       "conversation_id": "000000000000000000000004"
      },
      "speaker": null,
      "call_at": null,
      "lineage": [
       "e1"
      ]
     }
    ],
    "stale": true,
    "stale_reason": "move_date_passed",
    "applicability": "active"
   },
   "move_likelihood": {
    "score": 75,
    "level": "strong",
    "label": "75 / 100",
    "confidence": "medium",
    "rationale": "Rationale for strong",
    "conditions": [],
    "evidence": [
     {
      "id": "e1",
      "kind": "said_on_call",
      "locator": {
       "source": "summary_artifact",
       "snapshot_id": "000000000000000000000016",
       "content_digest": "9b1dbb46eec7e50d88821cc014cf0e127b85bfb5a5346a7c83d7c333aa23f708",
       "conversation_id": "000000000000000000000004",
       "transcript_version": "v1",
       "section": "said_on_call.0"
      },
      "speaker": "customer",
      "call_at": "2026-09-09T12:00:00.000Z",
      "lineage": []
     },
     {
      "id": "e2",
      "kind": "lead_current",
      "locator": {
       "source": "lead",
       "model": "FormLead",
       "id": "000000000000000000000003",
       "view": "current",
       "field_path": "move_date"
      },
      "speaker": null,
      "call_at": null,
      "lineage": []
     }
    ],
    "stale": true,
    "stale_reason": "move_date_passed",
    "applicability": "active"
   },
   "views": {
    "original_ingestion": {
     "pickup": {
      "city": "Austin",
      "state": "TX",
      "zip": "78701"
     },
     "delivery": {
      "city": "Denver",
      "state": "CO",
      "zip": "80202"
     },
     "move_date": "2026-10-01",
     "move_size": "2 bedroom",
     "granot_move_size": null,
     "cubic_feet": null,
     "provenance": {
      "source_system": "granot",
      "changed_at": "2026-09-05T00:00:00.000Z",
      "observation_id": null
     },
     "captured_at": "2026-09-01T00:00:00.000Z",
     "evidence_status": "captured_at_ingestion",
     "ingestion_origin": "wordpress",
     "label": "original_form_submission"
    },
    "canonical_current": {
     "pickup": {
      "city": "Austin",
      "state": "TX",
      "zip": "78701"
     },
     "delivery": {
      "city": "Denver",
      "state": "CO",
      "zip": "80202"
     },
     "move_date": "2026-10-15",
     "move_size": "2 bedroom",
     "granot_move_size": null,
     "cubic_feet": null,
     "provenance": {
      "source_system": "granot",
      "changed_at": "2026-09-05T00:00:00.000Z",
      "observation_id": null
     }
    },
    "customer_stated": [
     {
      "field": "move_date",
      "value": {
       "raw_text": "the fifteenth",
       "date": "2026-10-15",
       "end_date": null,
       "applies_to": "pickup",
       "flexibility": "fixed",
       "precision": "exact"
      },
      "status": "stated",
      "evidence": [
       {
        "id": "e1",
        "kind": "said_on_call",
        "locator": {
         "source": "summary_artifact",
         "snapshot_id": "000000000000000000000016",
         "content_digest": "9b1dbb46eec7e50d88821cc014cf0e127b85bfb5a5346a7c83d7c333aa23f708",
         "conversation_id": "000000000000000000000004",
         "transcript_version": "v1",
         "section": "said_on_call.0"
        },
        "speaker": "customer",
        "call_at": "2026-09-09T12:00:00.000Z",
        "lineage": []
       }
      ]
     }
    ]
   },
   "inventory": {
    "items": [
     {
      "label": "Sofa",
      "quantity": {
       "min": 1,
       "max": 1
      },
      "room": "Living room",
      "dimensions": null,
      "handling": null,
      "status": "included",
      "evidence": [
       {
        "id": "e1",
        "kind": "said_on_call",
        "locator": {
         "source": "summary_artifact",
         "snapshot_id": "000000000000000000000016",
         "content_digest": "9b1dbb46eec7e50d88821cc014cf0e127b85bfb5a5346a7c83d7c333aa23f708",
         "conversation_id": "000000000000000000000004",
         "transcript_version": "v1",
         "section": "said_on_call.0"
        },
        "speaker": "customer",
        "call_at": "2026-09-09T12:00:00.000Z",
        "lineage": []
       }
      ]
     }
    ],
    "coverage": "partial",
    "limitations": [
     "Garage not discussed"
    ],
    "source_coverage": "partial"
   },
   "conflicts": [
    {
     "affects": "move_date",
     "explanation": "Lead says Oct 1, call says Oct 15",
     "evidence": [
      {
       "id": "e1",
       "kind": "said_on_call",
       "locator": {
        "source": "summary_artifact",
        "snapshot_id": "000000000000000000000016",
        "content_digest": "9b1dbb46eec7e50d88821cc014cf0e127b85bfb5a5346a7c83d7c333aa23f708",
        "conversation_id": "000000000000000000000004",
        "transcript_version": "v1",
        "section": "said_on_call.0"
       },
       "speaker": "customer",
       "call_at": "2026-09-09T12:00:00.000Z",
       "lineage": []
      },
      {
       "id": "e2",
       "kind": "lead_current",
       "locator": {
        "source": "lead",
        "model": "FormLead",
        "id": "000000000000000000000003",
        "view": "current",
        "field_path": "move_date"
       },
       "speaker": null,
       "call_at": null,
       "lineage": []
      },
      {
       "id": "e4",
       "kind": "official_state",
       "locator": {
        "source": "official",
        "model": "BookedLead",
        "id": "00000000000000000000003c",
        "field_path": "booked"
       },
       "speaker": null,
       "call_at": null,
       "lineage": []
      },
      {
       "id": "e5",
       "kind": "legacy_summary_section",
       "locator": {
        "source": "legacy_run",
        "run_id": "00000000000000000000000a",
        "output_digest": "3ffc9e1d395adcbad31efe2440a82eb7f09263a7e060347128e5b7fc18b7868d",
        "conversation_id": "000000000000000000000004",
        "section": "money_and_dates"
       },
       "speaker": null,
       "call_at": null,
       "lineage": []
      },
      {
       "id": "e6",
       "kind": "legacy_summary_section",
       "locator": {
        "source": "conversation_summary",
        "conversation_id": "000000000000000000000004",
        "text_digest": "a93fdd6727c2cd3785bc16b33c4e8433ad0b7d81c6de01136dffd0396d5d8b7f",
        "section": "money_dates"
       },
       "speaker": null,
       "call_at": null,
       "lineage": []
      },
      {
       "id": "e7",
       "kind": "owner_correction",
       "locator": {
        "source": "owner_correction",
        "instruction_id": "000000000000000000000050",
        "revision": 2
       },
       "speaker": null,
       "call_at": null,
       "lineage": []
      }
     ]
    }
   ],
   "coverage": {
    "conversations_available": 2,
    "conversations_selected": 1,
    "findings_selected": 1
   },
   "source_manifest": [
    {
     "kind": "summary_artifact",
     "id": "000000000000000000000016",
     "version": "digest",
     "conversation_id": "000000000000000000000004",
     "call_at": "2026-09-09T12:00:00.000Z",
     "lineage": []
    }
   ]
  },
  "versions": [
   {
    "artifact_id": "000000000000000000000046",
    "status": "ready",
    "label": "Assessed",
    "current": true,
    "generated_at": "2026-09-20T12:00:00.000Z",
    "context_as_of": "2026-09-20T12:00:00.000Z",
    "schema_version": "move-assessment-v1",
    "model_version": "openai/gpt-5-mini",
    "input_mode": "summaries_with_findings",
    "transaction_intent": 50,
    "move_likelihood": 75
   },
   {
    "artifact_id": "000000000000000000000047",
    "status": "ready",
    "label": "Assessed",
    "current": false,
    "generated_at": "2026-09-15T12:00:00.000Z",
    "context_as_of": "2026-09-15T12:00:00.000Z",
    "schema_version": "move-assessment-v1",
    "model_version": "openai/gpt-5-mini",
    "input_mode": "lead_only",
    "transaction_intent": null,
    "move_likelihood": 50
   },
   {
    "artifact_id": "000000000000000000000048",
    "status": "purged",
    "label": "Purged",
    "current": false,
    "generated_at": "2026-09-20T12:00:00.000Z",
    "context_as_of": "2026-09-20T12:00:00.000Z",
    "schema_version": "move-assessment-v1",
    "model_version": "openai/gpt-5-mini",
    "input_mode": "summaries_with_findings",
    "transaction_intent": null,
    "move_likelihood": null
   }
  ]
 },
 "outreachAssessmentOnly": {
  "subject": {
   "outreach_record_id": "000000000000000000000001",
   "subject_key": "lead:FormLead:000000000000000000000003",
   "subject": {
    "kind": "lead",
    "model": "FormLead",
    "id": "000000000000000000000003"
   },
   "state": "open",
   "contact_number_id": null,
   "applicability": "active"
  },
  "availability": "ready",
  "current": {
   "availability": "ready",
   "artifact_id": "000000000000000000000047",
   "schema_version": "move-assessment-v1",
   "rubric_version": "move-rubric-v1",
   "model_version": "openai/gpt-5-mini",
   "generated_at": "2026-09-15T12:00:00.000Z",
   "context_as_of": "2026-09-15T12:00:00.000Z",
   "latest_conversation_at": "2026-09-09T12:00:00.000Z",
   "input_mode": "lead_only",
   "shadow": false,
   "current": false,
   "transaction_intent": {
    "score": null,
    "level": "unknown",
    "label": "Unknown",
    "confidence": "medium",
    "rationale": "Rationale for unknown",
    "conditions": [],
    "evidence": [],
    "stale": false,
    "stale_reason": null,
    "applicability": "active"
   },
   "move_likelihood": {
    "score": 50,
    "level": "active",
    "label": "50 / 100",
    "confidence": "medium",
    "rationale": "Rationale for active",
    "conditions": [],
    "evidence": [
     {
      "id": "e2",
      "kind": "lead_current",
      "locator": {
       "source": "lead",
       "model": "FormLead",
       "id": "000000000000000000000003",
       "view": "current",
       "field_path": "move_date"
      },
      "speaker": null,
      "call_at": null,
      "lineage": []
     }
    ],
    "stale": false,
    "stale_reason": null,
    "applicability": "active"
   },
   "views": {
    "original_ingestion": {
     "pickup": {
      "city": "Austin",
      "state": "TX",
      "zip": "78701"
     },
     "delivery": {
      "city": "Denver",
      "state": "CO",
      "zip": "80202"
     },
     "move_date": "2026-10-01",
     "move_size": "2 bedroom",
     "granot_move_size": null,
     "cubic_feet": null,
     "provenance": {
      "source_system": "granot",
      "changed_at": "2026-09-05T00:00:00.000Z",
      "observation_id": null
     },
     "captured_at": "2026-09-01T00:00:00.000Z",
     "evidence_status": "captured_at_ingestion",
     "ingestion_origin": "wordpress",
     "label": "original_form_submission"
    },
    "canonical_current": {
     "pickup": {
      "city": "Austin",
      "state": "TX",
      "zip": "78701"
     },
     "delivery": {
      "city": "Denver",
      "state": "CO",
      "zip": "80202"
     },
     "move_date": "2026-10-15",
     "move_size": "2 bedroom",
     "granot_move_size": null,
     "cubic_feet": null,
     "provenance": {
      "source_system": "granot",
      "changed_at": "2026-09-05T00:00:00.000Z",
      "observation_id": null
     }
    },
    "customer_stated": [
     {
      "field": "move_date",
      "value": {
       "raw_text": "the fifteenth",
       "date": "2026-10-15",
       "end_date": null,
       "applies_to": "pickup",
       "flexibility": "fixed",
       "precision": "exact"
      },
      "status": "stated",
      "evidence": [
       {
        "id": "e1",
        "kind": "said_on_call",
        "locator": {
         "source": "summary_artifact",
         "snapshot_id": "000000000000000000000016",
         "content_digest": "9b1dbb46eec7e50d88821cc014cf0e127b85bfb5a5346a7c83d7c333aa23f708",
         "conversation_id": "000000000000000000000004",
         "transcript_version": "v1",
         "section": "said_on_call.0"
        },
        "speaker": "customer",
        "call_at": "2026-09-09T12:00:00.000Z",
        "lineage": []
       }
      ]
     }
    ]
   },
   "inventory": {
    "items": [
     {
      "label": "Sofa",
      "quantity": {
       "min": 1,
       "max": 1
      },
      "room": "Living room",
      "dimensions": null,
      "handling": null,
      "status": "included",
      "evidence": [
       {
        "id": "e1",
        "kind": "said_on_call",
        "locator": {
         "source": "summary_artifact",
         "snapshot_id": "000000000000000000000016",
         "content_digest": "9b1dbb46eec7e50d88821cc014cf0e127b85bfb5a5346a7c83d7c333aa23f708",
         "conversation_id": "000000000000000000000004",
         "transcript_version": "v1",
         "section": "said_on_call.0"
        },
        "speaker": "customer",
        "call_at": "2026-09-09T12:00:00.000Z",
        "lineage": []
       }
      ]
     }
    ],
    "coverage": "partial",
    "limitations": [
     "Garage not discussed"
    ],
    "source_coverage": "partial"
   },
   "conflicts": [
    {
     "affects": "move_date",
     "explanation": "Lead says Oct 1, call says Oct 15",
     "evidence": [
      {
       "id": "e1",
       "kind": "said_on_call",
       "locator": {
        "source": "summary_artifact",
        "snapshot_id": "000000000000000000000016",
        "content_digest": "9b1dbb46eec7e50d88821cc014cf0e127b85bfb5a5346a7c83d7c333aa23f708",
        "conversation_id": "000000000000000000000004",
        "transcript_version": "v1",
        "section": "said_on_call.0"
       },
       "speaker": "customer",
       "call_at": "2026-09-09T12:00:00.000Z",
       "lineage": []
      },
      {
       "id": "e2",
       "kind": "lead_current",
       "locator": {
        "source": "lead",
        "model": "FormLead",
        "id": "000000000000000000000003",
        "view": "current",
        "field_path": "move_date"
       },
       "speaker": null,
       "call_at": null,
       "lineage": []
      },
      {
       "id": "e4",
       "kind": "official_state",
       "locator": {
        "source": "official",
        "model": "BookedLead",
        "id": "00000000000000000000003c",
        "field_path": "booked"
       },
       "speaker": null,
       "call_at": null,
       "lineage": []
      },
      {
       "id": "e5",
       "kind": "legacy_summary_section",
       "locator": {
        "source": "legacy_run",
        "run_id": "00000000000000000000000a",
        "output_digest": "3ffc9e1d395adcbad31efe2440a82eb7f09263a7e060347128e5b7fc18b7868d",
        "conversation_id": "000000000000000000000004",
        "section": "money_and_dates"
       },
       "speaker": null,
       "call_at": null,
       "lineage": []
      },
      {
       "id": "e6",
       "kind": "legacy_summary_section",
       "locator": {
        "source": "conversation_summary",
        "conversation_id": "000000000000000000000004",
        "text_digest": "a93fdd6727c2cd3785bc16b33c4e8433ad0b7d81c6de01136dffd0396d5d8b7f",
        "section": "money_dates"
       },
       "speaker": null,
       "call_at": null,
       "lineage": []
      },
      {
       "id": "e7",
       "kind": "owner_correction",
       "locator": {
        "source": "owner_correction",
        "instruction_id": "000000000000000000000050",
        "revision": 2
       },
       "speaker": null,
       "call_at": null,
       "lineage": []
      }
     ]
    }
   ],
   "coverage": {
    "conversations_available": 2,
    "conversations_selected": 1,
    "findings_selected": 1
   },
   "source_manifest": [
    {
     "kind": "summary_artifact",
     "id": "000000000000000000000016",
     "version": "digest",
     "conversation_id": "000000000000000000000004",
     "call_at": "2026-09-09T12:00:00.000Z",
     "lineage": []
    }
   ]
  },
  "versions": [
   {
    "artifact_id": "000000000000000000000047",
    "status": "ready",
    "label": "Assessed",
    "current": false,
    "generated_at": "2026-09-15T12:00:00.000Z",
    "context_as_of": "2026-09-15T12:00:00.000Z",
    "schema_version": "move-assessment-v1",
    "model_version": "openai/gpt-5-mini",
    "input_mode": "lead_only",
    "transaction_intent": null,
    "move_likelihood": 50
   }
  ]
 },
 "outreachNotAssessed": {
  "subject": {
   "outreach_record_id": "000000000000000000000001",
   "subject_key": "lead:FormLead:000000000000000000000003",
   "subject": {
    "kind": "lead",
    "model": "FormLead",
    "id": "000000000000000000000003"
   },
   "state": "open",
   "contact_number_id": "000000000000000000000002",
   "applicability": "active"
  },
  "availability": "not_assessed",
  "current": null,
  "versions": []
 },
 "outreachPending": {
  "subject": {
   "outreach_record_id": "000000000000000000000001",
   "subject_key": "lead:FormLead:000000000000000000000003",
   "subject": {
    "kind": "lead",
    "model": "FormLead",
    "id": "000000000000000000000003"
   },
   "state": "open",
   "contact_number_id": "000000000000000000000002",
   "applicability": "active"
  },
  "availability": "pending",
  "current": null,
  "versions": []
 },
 "outreachClosed": {
  "subject": {
   "outreach_record_id": "000000000000000000000001",
   "subject_key": "lead:FormLead:000000000000000000000003",
   "subject": {
    "kind": "lead",
    "model": "FormLead",
    "id": "000000000000000000000003"
   },
   "state": "closed",
   "contact_number_id": "000000000000000000000002",
   "applicability": "closed"
  },
  "availability": "not_applicable",
  "current": {
   "availability": "ready",
   "artifact_id": "000000000000000000000046",
   "schema_version": "move-assessment-v1",
   "rubric_version": "move-rubric-v1",
   "model_version": "openai/gpt-5-mini",
   "generated_at": "2026-09-20T12:00:00.000Z",
   "context_as_of": "2026-09-20T12:00:00.000Z",
   "latest_conversation_at": "2026-09-09T12:00:00.000Z",
   "input_mode": "summaries_with_findings",
   "shadow": false,
   "current": true,
   "transaction_intent": {
    "score": 50,
    "level": "active",
    "label": "Not applicable",
    "confidence": "medium",
    "rationale": "Rationale for active",
    "conditions": [],
    "evidence": [
     {
      "id": "e1",
      "kind": "said_on_call",
      "locator": {
       "source": "summary_artifact",
       "snapshot_id": "000000000000000000000016",
       "content_digest": "9b1dbb46eec7e50d88821cc014cf0e127b85bfb5a5346a7c83d7c333aa23f708",
       "conversation_id": "000000000000000000000004",
       "transcript_version": "v1",
       "section": "said_on_call.0"
      },
      "speaker": "customer",
      "call_at": "2026-09-09T12:00:00.000Z",
      "lineage": []
     },
     {
      "id": "e3",
      "kind": "finding",
      "locator": {
       "source": "finding",
       "finding_id": "00000000000000000000001e",
       "run_id": "00000000000000000000000a",
       "revision": 1,
       "conversation_id": "000000000000000000000004"
      },
      "speaker": null,
      "call_at": null,
      "lineage": [
       "e1"
      ]
     }
    ],
    "stale": false,
    "stale_reason": null,
    "applicability": "closed"
   },
   "move_likelihood": {
    "score": 75,
    "level": "strong",
    "label": "Not applicable",
    "confidence": "medium",
    "rationale": "Rationale for strong",
    "conditions": [],
    "evidence": [
     {
      "id": "e1",
      "kind": "said_on_call",
      "locator": {
       "source": "summary_artifact",
       "snapshot_id": "000000000000000000000016",
       "content_digest": "9b1dbb46eec7e50d88821cc014cf0e127b85bfb5a5346a7c83d7c333aa23f708",
       "conversation_id": "000000000000000000000004",
       "transcript_version": "v1",
       "section": "said_on_call.0"
      },
      "speaker": "customer",
      "call_at": "2026-09-09T12:00:00.000Z",
      "lineage": []
     },
     {
      "id": "e2",
      "kind": "lead_current",
      "locator": {
       "source": "lead",
       "model": "FormLead",
       "id": "000000000000000000000003",
       "view": "current",
       "field_path": "move_date"
      },
      "speaker": null,
      "call_at": null,
      "lineage": []
     }
    ],
    "stale": false,
    "stale_reason": null,
    "applicability": "closed"
   },
   "views": {
    "original_ingestion": {
     "pickup": {
      "city": "Austin",
      "state": "TX",
      "zip": "78701"
     },
     "delivery": {
      "city": "Denver",
      "state": "CO",
      "zip": "80202"
     },
     "move_date": "2026-10-01",
     "move_size": "2 bedroom",
     "granot_move_size": null,
     "cubic_feet": null,
     "provenance": {
      "source_system": "granot",
      "changed_at": "2026-09-05T00:00:00.000Z",
      "observation_id": null
     },
     "captured_at": "2026-09-01T00:00:00.000Z",
     "evidence_status": "captured_at_ingestion",
     "ingestion_origin": "wordpress",
     "label": "original_form_submission"
    },
    "canonical_current": {
     "pickup": {
      "city": "Austin",
      "state": "TX",
      "zip": "78701"
     },
     "delivery": {
      "city": "Denver",
      "state": "CO",
      "zip": "80202"
     },
     "move_date": "2026-10-15",
     "move_size": "2 bedroom",
     "granot_move_size": null,
     "cubic_feet": null,
     "provenance": {
      "source_system": "granot",
      "changed_at": "2026-09-05T00:00:00.000Z",
      "observation_id": null
     }
    },
    "customer_stated": [
     {
      "field": "move_date",
      "value": {
       "raw_text": "the fifteenth",
       "date": "2026-10-15",
       "end_date": null,
       "applies_to": "pickup",
       "flexibility": "fixed",
       "precision": "exact"
      },
      "status": "stated",
      "evidence": [
       {
        "id": "e1",
        "kind": "said_on_call",
        "locator": {
         "source": "summary_artifact",
         "snapshot_id": "000000000000000000000016",
         "content_digest": "9b1dbb46eec7e50d88821cc014cf0e127b85bfb5a5346a7c83d7c333aa23f708",
         "conversation_id": "000000000000000000000004",
         "transcript_version": "v1",
         "section": "said_on_call.0"
        },
        "speaker": "customer",
        "call_at": "2026-09-09T12:00:00.000Z",
        "lineage": []
       }
      ]
     }
    ]
   },
   "inventory": {
    "items": [
     {
      "label": "Sofa",
      "quantity": {
       "min": 1,
       "max": 1
      },
      "room": "Living room",
      "dimensions": null,
      "handling": null,
      "status": "included",
      "evidence": [
       {
        "id": "e1",
        "kind": "said_on_call",
        "locator": {
         "source": "summary_artifact",
         "snapshot_id": "000000000000000000000016",
         "content_digest": "9b1dbb46eec7e50d88821cc014cf0e127b85bfb5a5346a7c83d7c333aa23f708",
         "conversation_id": "000000000000000000000004",
         "transcript_version": "v1",
         "section": "said_on_call.0"
        },
        "speaker": "customer",
        "call_at": "2026-09-09T12:00:00.000Z",
        "lineage": []
       }
      ]
     }
    ],
    "coverage": "partial",
    "limitations": [
     "Garage not discussed"
    ],
    "source_coverage": "partial"
   },
   "conflicts": [
    {
     "affects": "move_date",
     "explanation": "Lead says Oct 1, call says Oct 15",
     "evidence": [
      {
       "id": "e1",
       "kind": "said_on_call",
       "locator": {
        "source": "summary_artifact",
        "snapshot_id": "000000000000000000000016",
        "content_digest": "9b1dbb46eec7e50d88821cc014cf0e127b85bfb5a5346a7c83d7c333aa23f708",
        "conversation_id": "000000000000000000000004",
        "transcript_version": "v1",
        "section": "said_on_call.0"
       },
       "speaker": "customer",
       "call_at": "2026-09-09T12:00:00.000Z",
       "lineage": []
      },
      {
       "id": "e2",
       "kind": "lead_current",
       "locator": {
        "source": "lead",
        "model": "FormLead",
        "id": "000000000000000000000003",
        "view": "current",
        "field_path": "move_date"
       },
       "speaker": null,
       "call_at": null,
       "lineage": []
      },
      {
       "id": "e4",
       "kind": "official_state",
       "locator": {
        "source": "official",
        "model": "BookedLead",
        "id": "00000000000000000000003c",
        "field_path": "booked"
       },
       "speaker": null,
       "call_at": null,
       "lineage": []
      },
      {
       "id": "e5",
       "kind": "legacy_summary_section",
       "locator": {
        "source": "legacy_run",
        "run_id": "00000000000000000000000a",
        "output_digest": "3ffc9e1d395adcbad31efe2440a82eb7f09263a7e060347128e5b7fc18b7868d",
        "conversation_id": "000000000000000000000004",
        "section": "money_and_dates"
       },
       "speaker": null,
       "call_at": null,
       "lineage": []
      },
      {
       "id": "e6",
       "kind": "legacy_summary_section",
       "locator": {
        "source": "conversation_summary",
        "conversation_id": "000000000000000000000004",
        "text_digest": "a93fdd6727c2cd3785bc16b33c4e8433ad0b7d81c6de01136dffd0396d5d8b7f",
        "section": "money_dates"
       },
       "speaker": null,
       "call_at": null,
       "lineage": []
      },
      {
       "id": "e7",
       "kind": "owner_correction",
       "locator": {
        "source": "owner_correction",
        "instruction_id": "000000000000000000000050",
        "revision": 2
       },
       "speaker": null,
       "call_at": null,
       "lineage": []
      }
     ]
    }
   ],
   "coverage": {
    "conversations_available": 2,
    "conversations_selected": 1,
    "findings_selected": 1
   },
   "source_manifest": [
    {
     "kind": "summary_artifact",
     "id": "000000000000000000000016",
     "version": "digest",
     "conversation_id": "000000000000000000000004",
     "call_at": "2026-09-09T12:00:00.000Z",
     "lineage": []
    }
   ]
  },
  "versions": [
   {
    "artifact_id": "000000000000000000000046",
    "status": "ready",
    "label": "Assessed",
    "current": true,
    "generated_at": "2026-09-20T12:00:00.000Z",
    "context_as_of": "2026-09-20T12:00:00.000Z",
    "schema_version": "move-assessment-v1",
    "model_version": "openai/gpt-5-mini",
    "input_mode": "summaries_with_findings",
    "transaction_intent": 50,
    "move_likelihood": 75
   },
   {
    "artifact_id": "000000000000000000000047",
    "status": "ready",
    "label": "Assessed",
    "current": false,
    "generated_at": "2026-09-15T12:00:00.000Z",
    "context_as_of": "2026-09-15T12:00:00.000Z",
    "schema_version": "move-assessment-v1",
    "model_version": "openai/gpt-5-mini",
    "input_mode": "lead_only",
    "transaction_intent": null,
    "move_likelihood": 50
   },
   {
    "artifact_id": "000000000000000000000048",
    "status": "purged",
    "label": "Purged",
    "current": false,
    "generated_at": "2026-09-20T12:00:00.000Z",
    "context_as_of": "2026-09-20T12:00:00.000Z",
    "schema_version": "move-assessment-v1",
    "model_version": "openai/gpt-5-mini",
    "input_mode": "summaries_with_findings",
    "transaction_intent": null,
    "move_likelihood": null
   }
  ]
 },
 "outreachPurged": {
  "subject": {
   "outreach_record_id": "000000000000000000000001",
   "subject_key": "lead:FormLead:000000000000000000000003",
   "subject": {
    "kind": "lead",
    "model": "FormLead",
    "id": "000000000000000000000003"
   },
   "state": "open",
   "contact_number_id": "000000000000000000000002",
   "applicability": "active"
  },
  "availability": "purged",
  "current": {
   "availability": "purged",
   "artifact_id": "000000000000000000000048",
   "schema_version": "move-assessment-v1",
   "rubric_version": "move-rubric-v1",
   "model_version": "openai/gpt-5-mini",
   "generated_at": "2026-09-20T12:00:00.000Z",
   "context_as_of": "2026-09-20T12:00:00.000Z",
   "latest_conversation_at": "2026-09-09T12:00:00.000Z",
   "input_mode": "summaries_with_findings",
   "shadow": false,
   "current": true,
   "transaction_intent": {
    "score": null,
    "level": null,
    "label": "Unavailable",
    "confidence": null,
    "rationale": null,
    "conditions": [],
    "evidence": [],
    "stale": false,
    "stale_reason": null,
    "applicability": "active"
   },
   "move_likelihood": {
    "score": null,
    "level": null,
    "label": "Unavailable",
    "confidence": null,
    "rationale": null,
    "conditions": [],
    "evidence": [],
    "stale": false,
    "stale_reason": null,
    "applicability": "active"
   },
   "views": {
    "original_ingestion": null,
    "canonical_current": null,
    "customer_stated": []
   },
   "inventory": {
    "items": [],
    "coverage": null,
    "limitations": [],
    "source_coverage": null
   },
   "conflicts": [],
   "coverage": null,
   "source_manifest": []
  },
  "versions": [
   {
    "artifact_id": "000000000000000000000048",
    "status": "purged",
    "label": "Purged",
    "current": false,
    "generated_at": "2026-09-20T12:00:00.000Z",
    "context_as_of": "2026-09-20T12:00:00.000Z",
    "schema_version": "move-assessment-v1",
    "model_version": "openai/gpt-5-mini",
    "input_mode": "summaries_with_findings",
    "transaction_intent": null,
    "move_likelihood": null
   }
  ]
 }
};
