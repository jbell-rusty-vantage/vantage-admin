// UI1-OVERVIEW gallery fixtures: the `data` of two S9 contract fixtures, copied verbatim (the page can't read the
// workspace at runtime). Regenerate by copying `.data` from the named file.
import type { Overview } from "@/lib/api/salesIntelligence";

/** S9/overview__custom.json `data` (period custom 2026-09-21 … 2026-09-24): the four blocks. */
export const OVERVIEW_CUSTOM: Overview = {
  "as_of": "2026-09-24T22:58:37.661Z",
  "snapshot_id": "outreach:74e7bd92-1e9b-449b-8ee0-889188beb411",
  "status": "ready",
  "scope": null,
  "filters": {
    "priority": null
  },
  "periods": {
    "activity": {
      "key": "custom",
      "from_day": "2026-09-21",
      "to_day": "2026-09-24",
      "start": "2026-09-21T04:00:00.000Z",
      "end": "2026-09-24T22:59:28.385Z"
    },
    "spend": {
      "key": "custom",
      "from_day": "2026-09-21",
      "to_day": "2026-09-24",
      "start": "2026-09-21T04:00:00.000Z",
      "end": "2026-09-24T22:59:28.385Z"
    }
  },
  "now": {
    "bands": {
      "1": 5,
      "2": 30,
      "3": 0,
      "4": 10,
      "5": 17,
      "6": 10,
      "7": 2
    },
    "needs_review": 20,
    "unassigned": 43,
    "live_calls": 2,
    "active": 75,
    "capture_health": {
      "status": "attention"
    }
  },
  "desk": {
    "speed_to_lead": {
      "leads": 23,
      "worked": 6,
      "median_staffed_minutes": 444.9,
      "p90_staffed_minutes": 1006.4,
      "still_waiting": 16,
      "missed_target": 21,
      "target_staffed_minutes": 30
    },
    "callbacks_kept": {
      "due": 10,
      "kept": 1,
      "kept_share": 0.1,
      "kept_unreached": 0,
      "kept_contact_unknown": 1,
      "not_kept": 1,
      "overdue_now": 8,
      "pending": 0
    },
    "missed_calls_returned": {
      "episodes": 0,
      "returned_on_time": 0,
      "returned_late": 0,
      "still_open": 0,
      "closed_unreturned": 0,
      "on_time_share": null,
      "median_staffed_minutes_to_return": null
    },
    "flow": {
      "new_outreach": 29,
      "moved_to_quoted": 6,
      "booked_in_granot": 1,
      "booked": 1,
      "crm_bad_dead": 0,
      "owner_closed": 1,
      "closed_total": 4,
      "net_active_change": 25,
      "bands": {
        "moves": 2,
        "into_band": {
          "1": 0,
          "2": 0,
          "3": 0,
          "4": 0,
          "5": 1,
          "6": 1,
          "7": 0
        },
        "out_of_band": {
          "1": 0,
          "2": 2,
          "3": 0,
          "4": 0,
          "5": 0,
          "6": 0,
          "7": 0
        },
        "capture_repair": 1,
        "excluded_baseline_or_policy": 72
      },
      "time_in_band": {
        "1": {
          "median_ms": null,
          "known": 0,
          "unknown": 5
        },
        "2": {
          "median_ms": null,
          "known": 0,
          "unknown": 30
        },
        "3": {
          "median_ms": null,
          "known": 0,
          "unknown": 0
        },
        "4": {
          "median_ms": null,
          "known": 0,
          "unknown": 10
        },
        "5": {
          "median_ms": 243,
          "known": 2,
          "unknown": 15
        },
        "6": {
          "median_ms": 243,
          "known": 1,
          "unknown": 9
        },
        "7": {
          "median_ms": null,
          "known": 0,
          "unknown": 2
        }
      }
    }
  },
  "reps": [
    {
      "agent": {
        "id": "6ab5ab0d72ee2eb383d940a7",
        "name": "Dana Reyes"
      },
      "open_assignments": {
        "open": 23,
        "bands": {
          "1": 3,
          "2": 3,
          "3": 0,
          "4": 7,
          "5": 9,
          "6": 1,
          "7": 0
        },
        "overdue": 8
      },
      "interactions": {
        "outbound_attempts": 26,
        "answered_inbound": 11,
        "human_conversations": 20,
        "talk_minutes": 76.8,
        "attempt_conversation_rate": 0.38461538461538464,
        "calls": 37,
        "recovered_calls": 1
      },
      "outcomes": {
        "leads": 2,
        "quoted": 0,
        "booked_in_granot": 0,
        "booked_official": 0,
        "bookings": 0,
        "booking_rate": 0
      },
      "spend": {
        "leads": 2,
        "spend": 40,
        "rate": 40,
        "legacy": 0,
        "unpriced_leads": 0,
        "zero_leads": 1
      },
      "by_source": [
        {
          "leads": 1,
          "spend": 40,
          "rate": 40,
          "legacy": 0,
          "unpriced_leads": 0,
          "zero_leads": 0,
          "source": "TBM Form",
          "unit_cpl": 40
        },
        {
          "leads": 1,
          "spend": 0,
          "rate": 0,
          "legacy": 0,
          "unpriced_leads": 0,
          "zero_leads": 1,
          "source": "Top10",
          "unit_cpl": 0
        }
      ],
      "cost_per_booking": null
    },
    {
      "agent": {
        "id": "6ab5ab0d72ee2eb383d940a8",
        "name": "Marcus Bell"
      },
      "open_assignments": {
        "open": 5,
        "bands": {
          "1": 0,
          "2": 3,
          "3": 0,
          "4": 0,
          "5": 0,
          "6": 1,
          "7": 1
        },
        "overdue": 3
      },
      "interactions": {
        "outbound_attempts": 4,
        "answered_inbound": 1,
        "human_conversations": 4,
        "talk_minutes": 14.2,
        "attempt_conversation_rate": 0.75,
        "calls": 5,
        "recovered_calls": 0
      },
      "outcomes": {
        "leads": 2,
        "quoted": 0,
        "booked_in_granot": 0,
        "booked_official": 0,
        "bookings": 0,
        "booking_rate": 0
      },
      "spend": {
        "leads": 2,
        "spend": 35,
        "rate": 0,
        "legacy": 35,
        "unpriced_leads": 0,
        "zero_leads": 1
      },
      "by_source": [
        {
          "leads": 1,
          "spend": 35,
          "rate": 0,
          "legacy": 35,
          "unpriced_leads": 0,
          "zero_leads": 0,
          "source": "MoveBuddy Form",
          "unit_cpl": 35
        },
        {
          "leads": 1,
          "spend": 0,
          "rate": 0,
          "legacy": 0,
          "unpriced_leads": 0,
          "zero_leads": 1,
          "source": "Top10",
          "unit_cpl": 0
        }
      ],
      "cost_per_booking": null
    },
    {
      "agent": {
        "id": "6ab5ab0d72ee2eb383d940a9",
        "name": "Tina Cho"
      },
      "open_assignments": {
        "open": 3,
        "bands": {
          "1": 0,
          "2": 2,
          "3": 0,
          "4": 0,
          "5": 0,
          "6": 0,
          "7": 1
        },
        "overdue": 2
      },
      "interactions": {
        "outbound_attempts": 0,
        "answered_inbound": 0,
        "human_conversations": 0,
        "talk_minutes": 0,
        "attempt_conversation_rate": null,
        "calls": 0,
        "recovered_calls": 0
      },
      "outcomes": {
        "leads": 0,
        "quoted": 0,
        "booked_in_granot": 0,
        "booked_official": 0,
        "bookings": 0,
        "booking_rate": null
      },
      "spend": {
        "leads": 0,
        "spend": 0,
        "rate": 0,
        "legacy": 0,
        "unpriced_leads": 0,
        "zero_leads": 0
      },
      "by_source": [],
      "cost_per_booking": null
    }
  ],
  "unmapped": {
    "interactions": {
      "outbound_attempts": 6,
      "answered_inbound": 1,
      "human_conversations": 0,
      "talk_minutes": 11.6,
      "attempt_conversation_rate": 0,
      "calls": 7,
      "recovered_calls": 0
    },
    "extensions": [
      "102",
      "103",
      "105",
      "107",
      "199"
    ]
  },
  "unassigned": {
    "records_now": 43,
    "outcomes": {
      "leads": 19,
      "quoted": 0,
      "booked_in_granot": 1,
      "booked_official": 0,
      "bookings": 1,
      "booking_rate": 0.05263157894736842
    },
    "spend": {
      "leads": 19,
      "spend": 0,
      "rate": 0,
      "legacy": 0,
      "unpriced_leads": 0,
      "zero_leads": 19
    },
    "by_source": [
      {
        "leads": 19,
        "spend": 0,
        "rate": 0,
        "legacy": 0,
        "unpriced_leads": 0,
        "zero_leads": 19,
        "source": "Top10",
        "unit_cpl": 0
      }
    ],
    "cost_per_booking": 0
  },
  "spend": {
    "total": {
      "leads": 23,
      "spend": 75,
      "rate": 40,
      "legacy": 35,
      "unpriced_leads": 0,
      "zero_leads": 21,
      "outcomes": {
        "leads": 23,
        "quoted": 0,
        "booked_in_granot": 1,
        "booked_official": 0,
        "bookings": 1,
        "booking_rate": 0.043478260869565216
      }
    },
    "by_rep": [
      {
        "leads": 2,
        "spend": 40,
        "rate": 40,
        "legacy": 0,
        "unpriced_leads": 0,
        "zero_leads": 1,
        "agent_id": "6ab5ab0d72ee2eb383d940a7"
      },
      {
        "leads": 2,
        "spend": 35,
        "rate": 0,
        "legacy": 35,
        "unpriced_leads": 0,
        "zero_leads": 1,
        "agent_id": "6ab5ab0d72ee2eb383d940a8"
      },
      {
        "leads": 0,
        "spend": 0,
        "rate": 0,
        "legacy": 0,
        "unpriced_leads": 0,
        "zero_leads": 0,
        "agent_id": "6ab5ab0d72ee2eb383d940a9"
      },
      {
        "leads": 19,
        "spend": 0,
        "rate": 0,
        "legacy": 0,
        "unpriced_leads": 0,
        "zero_leads": 19,
        "agent_id": null
      }
    ],
    "by_source": [
      {
        "leads": 1,
        "spend": 40,
        "rate": 40,
        "legacy": 0,
        "unpriced_leads": 0,
        "zero_leads": 0,
        "source": "TBM Form",
        "unit_cpl": 40
      },
      {
        "leads": 1,
        "spend": 35,
        "rate": 0,
        "legacy": 35,
        "unpriced_leads": 0,
        "zero_leads": 0,
        "source": "MoveBuddy Form",
        "unit_cpl": 35
      },
      {
        "leads": 21,
        "spend": 0,
        "rate": 0,
        "legacy": 0,
        "unpriced_leads": 0,
        "zero_leads": 21,
        "source": "Top10",
        "unit_cpl": 0
      }
    ]
  }
};

/** S9/overview__default.json `data` (no period: activity today, spend last_7_days): the split-default header, an unpriced Lead, a mixed-rates source. */
export const OVERVIEW_DEFAULT: Overview = {
  "as_of": "2026-09-24T22:58:37.661Z",
  "snapshot_id": "outreach:74e7bd92-1e9b-449b-8ee0-889188beb411",
  "status": "ready",
  "scope": null,
  "filters": {
    "priority": null
  },
  "periods": {
    "activity": {
      "key": "today",
      "from_day": "2026-09-24",
      "to_day": "2026-09-24",
      "start": "2026-09-24T04:00:00.000Z",
      "end": "2026-09-24T22:59:28.197Z"
    },
    "spend": {
      "key": "last_7_days",
      "from_day": "2026-09-18",
      "to_day": "2026-09-24",
      "start": "2026-09-18T04:00:00.000Z",
      "end": "2026-09-24T22:59:28.197Z"
    }
  },
  "now": {
    "bands": {
      "1": 5,
      "2": 30,
      "3": 0,
      "4": 10,
      "5": 17,
      "6": 10,
      "7": 2
    },
    "needs_review": 20,
    "unassigned": 43,
    "live_calls": 2,
    "active": 75,
    "capture_health": {
      "status": "attention"
    }
  },
  "desk": {
    "speed_to_lead": {
      "leads": 2,
      "worked": 0,
      "median_staffed_minutes": null,
      "p90_staffed_minutes": null,
      "still_waiting": 2,
      "missed_target": 1,
      "target_staffed_minutes": 30
    },
    "callbacks_kept": {
      "due": 3,
      "kept": 1,
      "kept_share": 0.3333333333333333,
      "kept_unreached": 0,
      "kept_contact_unknown": 1,
      "not_kept": 0,
      "overdue_now": 2,
      "pending": 0
    },
    "missed_calls_returned": {
      "episodes": 0,
      "returned_on_time": 0,
      "returned_late": 0,
      "still_open": 0,
      "closed_unreturned": 0,
      "on_time_share": null,
      "median_staffed_minutes_to_return": null
    },
    "flow": {
      "new_outreach": 6,
      "moved_to_quoted": 4,
      "booked_in_granot": 0,
      "booked": 0,
      "crm_bad_dead": 0,
      "owner_closed": 1,
      "closed_total": 1,
      "net_active_change": 5,
      "bands": {
        "moves": 2,
        "into_band": {
          "1": 0,
          "2": 0,
          "3": 0,
          "4": 0,
          "5": 1,
          "6": 1,
          "7": 0
        },
        "out_of_band": {
          "1": 0,
          "2": 2,
          "3": 0,
          "4": 0,
          "5": 0,
          "6": 0,
          "7": 0
        },
        "capture_repair": 1,
        "excluded_baseline_or_policy": 32
      },
      "time_in_band": {
        "1": {
          "median_ms": null,
          "known": 0,
          "unknown": 5
        },
        "2": {
          "median_ms": null,
          "known": 0,
          "unknown": 30
        },
        "3": {
          "median_ms": null,
          "known": 0,
          "unknown": 0
        },
        "4": {
          "median_ms": null,
          "known": 0,
          "unknown": 10
        },
        "5": {
          "median_ms": 243,
          "known": 2,
          "unknown": 15
        },
        "6": {
          "median_ms": 243,
          "known": 1,
          "unknown": 9
        },
        "7": {
          "median_ms": null,
          "known": 0,
          "unknown": 2
        }
      }
    }
  },
  "reps": [
    {
      "agent": {
        "id": "6ab5ab0d72ee2eb383d940a7",
        "name": "Dana Reyes"
      },
      "open_assignments": {
        "open": 23,
        "bands": {
          "1": 3,
          "2": 3,
          "3": 0,
          "4": 7,
          "5": 9,
          "6": 1,
          "7": 0
        },
        "overdue": 8
      },
      "interactions": {
        "outbound_attempts": 6,
        "answered_inbound": 3,
        "human_conversations": 4,
        "talk_minutes": 18.5,
        "attempt_conversation_rate": 0.16666666666666666,
        "calls": 9,
        "recovered_calls": 1
      },
      "outcomes": {
        "leads": 5,
        "quoted": 0,
        "booked_in_granot": 0,
        "booked_official": 0,
        "bookings": 0,
        "booking_rate": 0
      },
      "spend": {
        "leads": 5,
        "spend": 40,
        "rate": 40,
        "legacy": 0,
        "unpriced_leads": 0,
        "zero_leads": 4
      },
      "by_source": [
        {
          "leads": 1,
          "spend": 40,
          "rate": 40,
          "legacy": 0,
          "unpriced_leads": 0,
          "zero_leads": 0,
          "source": "TBM Form",
          "unit_cpl": 40
        },
        {
          "leads": 4,
          "spend": 0,
          "rate": 0,
          "legacy": 0,
          "unpriced_leads": 0,
          "zero_leads": 4,
          "source": "Top10",
          "unit_cpl": 0
        }
      ],
      "cost_per_booking": null
    },
    {
      "agent": {
        "id": "6ab5ab0d72ee2eb383d940a8",
        "name": "Marcus Bell"
      },
      "open_assignments": {
        "open": 5,
        "bands": {
          "1": 0,
          "2": 3,
          "3": 0,
          "4": 0,
          "5": 0,
          "6": 1,
          "7": 1
        },
        "overdue": 3
      },
      "interactions": {
        "outbound_attempts": 2,
        "answered_inbound": 0,
        "human_conversations": 1,
        "talk_minutes": 2.5,
        "attempt_conversation_rate": 0.5,
        "calls": 2,
        "recovered_calls": 0
      },
      "outcomes": {
        "leads": 5,
        "quoted": 0,
        "booked_in_granot": 0,
        "booked_official": 0,
        "bookings": 0,
        "booking_rate": 0
      },
      "spend": {
        "leads": 5,
        "spend": 35,
        "rate": 0,
        "legacy": 35,
        "unpriced_leads": 0,
        "zero_leads": 4
      },
      "by_source": [
        {
          "leads": 1,
          "spend": 35,
          "rate": 0,
          "legacy": 35,
          "unpriced_leads": 0,
          "zero_leads": 0,
          "source": "MoveBuddy Form",
          "unit_cpl": 35
        },
        {
          "leads": 4,
          "spend": 0,
          "rate": 0,
          "legacy": 0,
          "unpriced_leads": 0,
          "zero_leads": 4,
          "source": "Top10",
          "unit_cpl": 0
        }
      ],
      "cost_per_booking": null
    },
    {
      "agent": {
        "id": "6ab5ab0d72ee2eb383d940a9",
        "name": "Tina Cho"
      },
      "open_assignments": {
        "open": 3,
        "bands": {
          "1": 0,
          "2": 2,
          "3": 0,
          "4": 0,
          "5": 0,
          "6": 0,
          "7": 1
        },
        "overdue": 2
      },
      "interactions": {
        "outbound_attempts": 0,
        "answered_inbound": 0,
        "human_conversations": 0,
        "talk_minutes": 0,
        "attempt_conversation_rate": null,
        "calls": 0,
        "recovered_calls": 0
      },
      "outcomes": {
        "leads": 2,
        "quoted": 0,
        "booked_in_granot": 0,
        "booked_official": 0,
        "bookings": 0,
        "booking_rate": 0
      },
      "spend": {
        "leads": 2,
        "spend": 0,
        "rate": 0,
        "legacy": 0,
        "unpriced_leads": 1,
        "zero_leads": 1
      },
      "by_source": [
        {
          "leads": 1,
          "spend": 0,
          "rate": 0,
          "legacy": 0,
          "unpriced_leads": 1,
          "zero_leads": 0,
          "source": "Relo Compare Calls",
          "unit_cpl": 0
        },
        {
          "leads": 1,
          "spend": 0,
          "rate": 0,
          "legacy": 0,
          "unpriced_leads": 0,
          "zero_leads": 1,
          "source": "Top10",
          "unit_cpl": 0
        }
      ],
      "cost_per_booking": null
    }
  ],
  "unmapped": {
    "interactions": {
      "outbound_attempts": 1,
      "answered_inbound": 0,
      "human_conversations": 0,
      "talk_minutes": 1.5,
      "attempt_conversation_rate": 0,
      "calls": 1,
      "recovered_calls": 0
    },
    "extensions": [
      "107"
    ]
  },
  "unassigned": {
    "records_now": 43,
    "outcomes": {
      "leads": 37,
      "quoted": 1,
      "booked_in_granot": 2,
      "booked_official": 0,
      "bookings": 2,
      "booking_rate": 0.05405405405405406
    },
    "spend": {
      "leads": 37,
      "spend": 0,
      "rate": 0,
      "legacy": 0,
      "unpriced_leads": 0,
      "zero_leads": 37
    },
    "by_source": [
      {
        "leads": 1,
        "spend": 0,
        "rate": 0,
        "legacy": 0,
        "unpriced_leads": 0,
        "zero_leads": 1,
        "source": "TBM Form",
        "unit_cpl": 0
      },
      {
        "leads": 36,
        "spend": 0,
        "rate": 0,
        "legacy": 0,
        "unpriced_leads": 0,
        "zero_leads": 36,
        "source": "Top10",
        "unit_cpl": 0
      }
    ],
    "cost_per_booking": 0
  },
  "spend": {
    "total": {
      "leads": 49,
      "spend": 75,
      "rate": 40,
      "legacy": 35,
      "unpriced_leads": 1,
      "zero_leads": 46,
      "outcomes": {
        "leads": 49,
        "quoted": 1,
        "booked_in_granot": 2,
        "booked_official": 0,
        "bookings": 2,
        "booking_rate": 0.04081632653061224
      }
    },
    "by_rep": [
      {
        "leads": 5,
        "spend": 40,
        "rate": 40,
        "legacy": 0,
        "unpriced_leads": 0,
        "zero_leads": 4,
        "agent_id": "6ab5ab0d72ee2eb383d940a7"
      },
      {
        "leads": 5,
        "spend": 35,
        "rate": 0,
        "legacy": 35,
        "unpriced_leads": 0,
        "zero_leads": 4,
        "agent_id": "6ab5ab0d72ee2eb383d940a8"
      },
      {
        "leads": 2,
        "spend": 0,
        "rate": 0,
        "legacy": 0,
        "unpriced_leads": 1,
        "zero_leads": 1,
        "agent_id": "6ab5ab0d72ee2eb383d940a9"
      },
      {
        "leads": 37,
        "spend": 0,
        "rate": 0,
        "legacy": 0,
        "unpriced_leads": 0,
        "zero_leads": 37,
        "agent_id": null
      }
    ],
    "by_source": [
      {
        "leads": 2,
        "spend": 40,
        "rate": 40,
        "legacy": 0,
        "unpriced_leads": 0,
        "zero_leads": 1,
        "source": "TBM Form",
        "unit_cpl": null
      },
      {
        "leads": 1,
        "spend": 35,
        "rate": 0,
        "legacy": 35,
        "unpriced_leads": 0,
        "zero_leads": 0,
        "source": "MoveBuddy Form",
        "unit_cpl": 35
      },
      {
        "leads": 1,
        "spend": 0,
        "rate": 0,
        "legacy": 0,
        "unpriced_leads": 1,
        "zero_leads": 0,
        "source": "Relo Compare Calls",
        "unit_cpl": 0
      },
      {
        "leads": 45,
        "spend": 0,
        "rate": 0,
        "legacy": 0,
        "unpriced_leads": 0,
        "zero_leads": 45,
        "source": "Top10",
        "unit_cpl": 0
      }
    ]
  }
};
