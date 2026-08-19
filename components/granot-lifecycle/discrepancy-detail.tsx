"use client";
import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/data-table/status-badge";
import { formatDateTime } from "@/components/data-table/formatters";
import {
  correctGranotRecordLink, fetchGranotLifecycleDiscrepancy, GranotLifecycleApiError,
  reEvaluateGranotDiscrepancy, resolveGranotDiscrepancyNoAction,
} from "@/lib/api/granotLifecycle";
import { invalidateGranotLifecycleCommandViews } from "@/lib/query/granotLifecycle";
import { queryKeys } from "@/lib/query/keys";

const commandKey = () => `granot-discrepancy-${crypto.randomUUID()}`;

export function DiscrepancyDetailPage({ discrepancyId }: { discrepancyId: string }) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: queryKeys.granotLifecycle.discrepancyDetail(discrepancyId), queryFn: () => fetchGranotLifecycleDiscrepancy(discrepancyId) });
  const [leadModel, setLeadModel] = useState<"FormLead" | "CallLead">("FormLead");
  const [leadId, setLeadId] = useState("");
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<string>();
  const mutation = useMutation({
    mutationFn: async (action: "re-evaluate" | "correct" | "no-action") => {
      const detail = query.data!;
      if (action === "re-evaluate") return reEvaluateGranotDiscrepancy(discrepancyId, { expected_revision: detail.revision }, commandKey());
      if (action === "no-action") return resolveGranotDiscrepancyNoAction(discrepancyId, { expected_revision: detail.revision, reason_text: reason.trim() || undefined }, commandKey());
      if (!detail.record_link) throw new Error("The disputed Record Link is unavailable.");
      return correctGranotRecordLink(discrepancyId, { expected_revision: detail.revision, expected_link_revision: detail.record_link.domain_revision, selected_lead: { lead_model: leadModel, lead_id: leadId.trim() }, reason_text: reason.trim() }, commandKey());
    },
    onSuccess: async (result) => {
      setNotice(`Command completed: ${result.outcome.replaceAll("_", " ")}.`);
      await invalidateGranotLifecycleCommandViews(client, { discrepancyId, jobNo: query.data?.normalized_job_no, lead: leadId ? { model: leadModel, id: leadId.trim() } : undefined });
    },
    onError: async (error) => {
      if (error instanceof GranotLifecycleApiError && error.status === 409) {
        await query.refetch();
        setNotice("Facts changed while you were reviewing. Current facts were refreshed; your Lead selection and reason were preserved. Review and submit again.");
      }
    },
  });
  if (query.isPending) return <p role="status">Loading discrepancy…</p>;
  if (query.isError || !query.data) return <FeedbackMessage tone="error">{query.error instanceof Error ? query.error.message : "Unable to load discrepancy."}</FeedbackMessage>;
  const detail = query.data;
  return <div className="space-y-5">
    <header><p className="text-sm text-muted-foreground">Granot discrepancy</p><h1 className="text-2xl font-semibold text-navy">{detail.reason_code.replaceAll("_", " ")}</h1><div className="mt-2 flex flex-wrap gap-1"><StatusBadge tone={detail.state === "open" ? "warning" : "muted"}>{detail.state}</StatusBadge><StatusBadge>{detail.kind}</StatusBadge><StatusBadge tone="muted">revision {detail.revision}</StatusBadge><StatusBadge tone="muted">evidence {detail.evidence_revision}</StatusBadge></div></header>
    {notice ? <FeedbackMessage tone="info">{notice}</FeedbackMessage> : null}
    {mutation.isError && !(mutation.error instanceof GranotLifecycleApiError && mutation.error.status === 409) ? <FeedbackMessage tone="error">{mutation.error instanceof Error ? mutation.error.message : "Command failed."}</FeedbackMessage> : null}
    <div className="grid gap-5 xl:grid-cols-2"><Card><CardHeader><CardTitle>Current conflict</CardTitle><CardDescription>Server-classified, non-PII identity and causal evidence.</CardDescription></CardHeader><CardContent className="space-y-3 text-sm"><p><strong>Job:</strong> <Link className="text-trust-blue hover:underline" href={`/ingestion/granot/lifecycle/jobs/${encodeURIComponent(detail.normalized_job_no)}`}>{detail.normalized_job_no}</Link></p><p><strong>Contact:</strong> {detail.masked_contact_label}</p><p><strong>Fingerprint:</strong> <code className="break-all text-xs">{detail.reason_fingerprint}</code></p><p><strong>Opened:</strong> {formatDateTime(detail.opened_at)}</p><p><strong>Last evidence:</strong> {formatDateTime(detail.last_evidence_at)}</p>{detail.record_link ? <p><strong>Record Link:</strong> {detail.record_link.state}, revision {detail.record_link.domain_revision}, {detail.record_link.disputed ? "disputed" : "not disputed"}</p> : null}</CardContent></Card>
      <Card><CardHeader><CardTitle>Evidence timeline</CardTitle><CardDescription>Observation and Decision references only; raw payload is never displayed.</CardDescription></CardHeader><CardContent><ol className="space-y-3">{detail.evidence.map((item) => <li key={`${item.observation_id}:${item.decision_id}`} className="rounded-md border p-3 text-sm"><strong>{item.action.replaceAll("_", " ")}</strong><p>{formatDateTime(item.captured_at)}</p><p className="break-all font-mono text-xs text-muted-foreground">Observation {item.observation_id}<br />Decision {item.decision_id}</p></li>)}</ol></CardContent></Card></div>
    {detail.state === "open" ? <Card><CardHeader><CardTitle>Owner actions</CardTitle><CardDescription>Each action revalidates current server facts and revisions. Nothing submits automatically after a conflict.</CardDescription></CardHeader><CardContent className="space-y-4">
      <div className="flex flex-wrap gap-2"><Button disabled={!detail.capabilities.re_evaluate || mutation.isPending} onClick={() => mutation.mutate("re-evaluate")}>Re-evaluate</Button><Button variant="outline" disabled={!detail.capabilities.no_action || mutation.isPending} onClick={() => mutation.mutate("no-action")}>Resolve — No Action</Button></div>
      {detail.capabilities.correct_record_link ? <fieldset className="grid gap-3 rounded-md border p-4"><legend className="px-1 font-semibold">Correct Record Link</legend>{detail.candidates.length > 0 ? <div className="space-y-2"><p className="text-sm font-medium">Current eligible candidates</p>{detail.candidates.map((candidate) => { const selected = leadModel === candidate.lead_ref.model && leadId === candidate.lead_ref.id; return <button type="button" key={`${candidate.lead_ref.model}:${candidate.lead_ref.id}`} aria-pressed={selected} className={`w-full rounded-md border p-3 text-left text-sm ${selected ? "border-trust-blue bg-blue-50" : "hover:bg-muted/50"}`} onClick={() => { setLeadModel(candidate.lead_ref.model); setLeadId(candidate.lead_ref.id); }}><span className="font-medium">{candidate.lead_ref.model === "FormLead" ? "Form Lead" : "Call Lead"}</span>{candidate.suggested ? <span className="ml-2 text-trust-blue">Suggested</span> : null}<span className="block break-all font-mono text-xs text-muted-foreground">{candidate.lead_ref.id}</span><span className="block text-xs text-muted-foreground">{candidate.confidence} confidence · {candidate.match_method.replaceAll("_", " ")}</span></button>; })}</div> : <p className="text-sm text-muted-foreground">No current canonical candidates were found. An eligible Lead can still be entered for server validation.</p>}<div><Label htmlFor="discrepancy-lead-model">Lead type</Label><select id="discrepancy-lead-model" className="h-10 w-full rounded-md border bg-background px-3" value={leadModel} onChange={(event) => setLeadModel(event.target.value as "FormLead" | "CallLead")}><option value="FormLead">Form Lead</option><option value="CallLead">Call Lead</option></select></div><div><Label htmlFor="discrepancy-lead-id">Eligible Lead ID</Label><Input id="discrepancy-lead-id" value={leadId} onChange={(event) => setLeadId(event.target.value)} /></div><div><Label htmlFor="discrepancy-reason">Owner reason</Label><textarea id="discrepancy-reason" className="min-h-24 w-full rounded-md border bg-background p-3" value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} maxLength={1000} /></div><Button disabled={mutation.isPending || leadId.trim().length !== 24 || reason.trim().length < 10} onClick={() => mutation.mutate("correct")}>Correct Record Link</Button></fieldset> : null}
    </CardContent></Card> : null}
  </div>;
}
