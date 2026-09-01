"use client";

import { useState } from "react";
import { FeedbackMessage } from "@/components/ui/feedback";
import {
  type RingCentralRoute,
  type RingCentralRouteDependencies,
  type RingCentralRouteUpdateInput,
} from "@/lib/api/registryRingCentral";
import type { SourceCompanyItem, SourceGranularityItem } from "@/lib/api/registrySources";
import { RegistryApiErrorMessage } from "../registry-api-error";
import { InboundNumberEditor } from "../inbound-numbers/inbound-number-editor";
import { ReassignDialog } from "./reassign-dialog";

export function RouteDetail({
  route,
  companies,
  granularities,
  readOnly,
  isPending,
  mutationError,
  onSave,
  onValidate,
  onActivate,
  onDeactivate,
  onReassign,
  onPreviewDependencies,
}: {
  route: RingCentralRoute;
  companies: SourceCompanyItem[];
  granularities: SourceGranularityItem[];
  readOnly: boolean;
  isPending: boolean;
  mutationError: unknown;
  onSave: (body: RingCentralRouteUpdateInput) => void;
  onValidate: (reason?: string) => void;
  onActivate: (input: { source_granularity_id: string; reason?: string }) => void;
  onDeactivate: (reason?: string) => void;
  onReassign: (input: { source_granularity_id: string; reason?: string }) => void;
  onPreviewDependencies: () => Promise<RingCentralRouteDependencies>;
}) {
  const [nickname, setNickname] = useState(route.display_label);
  const [selectedFeedId, setSelectedFeedId] = useState(
    route.current_assignment?.source_granularity_id ?? "",
  );
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  void onPreviewDependencies;

  return (
    <div className="space-y-4">
      {mutationError ? <RegistryApiErrorMessage error={mutationError} /> : null}
      <InboundNumberEditor
        route={route}
        callFeeds={granularities}
        companies={companies}
        readOnly={readOnly}
        isPending={isPending}
        nickname={nickname}
        selectedFeedId={selectedFeedId}
        onNicknameChange={setNickname}
        onFeedChange={setSelectedFeedId}
        onSave={() => {
          if (nickname.trim() !== route.display_label) {
            onSave({ display_label: nickname.trim() });
          }
        }}
        onValidate={() => onValidate()}
        onActivate={() => {
          if (selectedFeedId) {
            onActivate({ source_granularity_id: selectedFeedId });
          }
        }}
        onDeactivate={() => {
          setShowDeactivate(true);
          onDeactivate();
        }}
        showDeactivateConfirm={showDeactivate}
      />
      {route.active && !readOnly ? (
        <button
          type="button"
          className="text-sm font-medium text-primary underline"
          onClick={() => setShowReassign(true)}
        >
          File new calls under a different feed
        </button>
      ) : null}
      {showReassign && !readOnly ? (
        <ReassignDialog
          route={route}
          companies={companies}
          granularities={granularities}
          isPending={isPending}
          onReassign={(input) => {
            onReassign(input);
            setShowReassign(false);
          }}
          onCancel={() => setShowReassign(false)}
        />
      ) : null}
      {readOnly ? <FeedbackMessage tone="info">Read-only view.</FeedbackMessage> : null}
    </div>
  );
}
