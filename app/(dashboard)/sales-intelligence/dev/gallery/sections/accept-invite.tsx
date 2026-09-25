"use client";

import { AcceptInviteView, initialAcceptState, type AcceptViewState } from "@/app/accept-invite/accept-invite-view";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { GallerySection, Sample } from "./section";

// UI2-USERS gallery samples for /accept-invite (UI-2 §8). Labels are dev-only gallery text.

const LONG = "correct-horse-battery";

export const ACCEPT_SAMPLES: { id: string; label: string; source: string; state: AcceptViewState }[] = [
  { id: "form", label: "Token read · empty form (Set password disabled)", source: "#token=<43 chars>", state: { ...initialAcceptState, phase: "form" } },
  { id: "filled", label: "Both fields filled", source: "client", state: { ...initialAcceptState, phase: "form", password: LONG, confirm: LONG } },
  { id: "mismatch", label: "Mismatch (client check)", source: "copy.ui2.acceptInvite.states.mismatch", state: { ...initialAcceptState, phase: "form", password: LONG, confirm: `${LONG}!`, error: "mismatch" } },
  { id: "weak", label: "Weak (client check or accept-invite__weak-password.json)", source: "copy.ui2.acceptInvite.states.weak", state: { ...initialAcceptState, phase: "form", password: "short", confirm: "short", error: "weak" } },
  { id: "malformed", label: "No #token= or a bad shape (no request)", source: "copy.ui2.acceptInvite.states.malformed", state: { ...initialAcceptState, phase: "malformed" } },
  { id: "invalid", label: "invite_invalid: used, expired or malformed on the server", source: "accept-invite__{used,expired,malformed-token}.json", state: { ...initialAcceptState, phase: "invalid" } },
  { id: "success", label: "200 password_set → Go to sign in", source: "accept-invite__success.json", state: { ...initialAcceptState, phase: "success" } },
];

export function AcceptInviteSection() {
  return (
    <GallerySection id="accept-invite" title={copy.ui2.gallery.sections["accept-invite"]}>
      <p className="si-gallery__note">The public page at /accept-invite, one card per state, each in a 390 px frame.</p>
      <div className="si-gallery__grid">
        {ACCEPT_SAMPLES.map((sample) => (
          <Sample key={sample.id} label={sample.label} copyKey={sample.source}>
            <div className="si-gallery__frame si-root" data-frame="390" data-accept-sample={sample.id}>
              <AcceptInviteView state={sample.state} />
            </div>
          </Sample>
        ))}
      </div>
    </GallerySection>
  );
}
