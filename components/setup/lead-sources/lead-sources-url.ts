/**
 * The Lead sources URL contract (doc 19): `?view=sources|granot|numbers&source=<company id>&feed=<feed id>
 * &edit=feed|granot|number|cost|source&granot=<id>&number=<id>&new=1`. `granot=new` / `number=new` / `feed=new` open the
 * sheet in create mode. Pure: no React, so the node tests cover parsing and building.
 */
import { SETUP_ROUTES } from "@/lib/setup/setup-links";

export type LeadSourcesView = "sources" | "granot" | "numbers";
export type LeadSourcesEdit = "feed" | "granot" | "number" | "cost" | "source";

export type LeadSourcesUrl = {
  view: LeadSourcesView;
  source: string | null;
  feed: string | null;
  edit: LeadSourcesEdit | null;
  granot: string | null;
  number: string | null;
  isNew: boolean;
};

export const EMPTY_LEAD_SOURCES_URL: LeadSourcesUrl = {
  view: "sources",
  source: null,
  feed: null,
  edit: null,
  granot: null,
  number: null,
  isNew: false,
};

const VIEWS: readonly LeadSourcesView[] = ["sources", "granot", "numbers"];
const EDITS: readonly LeadSourcesEdit[] = ["feed", "granot", "number", "cost", "source"];

type ParamReader = { get(key: string): string | null };

/** Reads the contract from search params; an `edit` without the id it needs is dropped (the sheet cannot open). */
export function parseLeadSourcesUrl(params: ParamReader): LeadSourcesUrl {
  const viewRaw = params.get("view");
  const view = VIEWS.find((item) => item === viewRaw) ?? "sources";
  const editRaw = params.get("edit");
  const editCandidate = EDITS.find((item) => item === editRaw) ?? null;
  const source = params.get("source") || null;
  const feed = params.get("feed") || null;
  const granot = params.get("granot") || null;
  const number = params.get("number") || null;
  let edit: LeadSourcesEdit | null = editCandidate;
  if (edit === "feed" && !feed) edit = null;
  if (edit === "cost" && !feed) edit = null;
  if (edit === "granot" && !granot) edit = null;
  if (edit === "number" && !number) edit = null;
  if (edit === "source" && !source) edit = null;
  return { view, source, feed, edit, granot, number, isNew: params.get("new") === "1" };
}

/** The Setup href for a (partial) state. Defaults are omitted so URLs stay short. */
export function leadSourcesHref(state: Partial<LeadSourcesUrl>): string {
  const search = new URLSearchParams();
  if (state.view && state.view !== "sources") search.set("view", state.view);
  if (state.source) search.set("source", state.source);
  if (state.feed) search.set("feed", state.feed);
  if (state.edit) search.set("edit", state.edit);
  if (state.granot) search.set("granot", state.granot);
  if (state.number) search.set("number", state.number);
  if (state.isNew) search.set("new", "1");
  const query = search.toString();
  return query ? `${SETUP_ROUTES.leadSources}?${query}` : SETUP_ROUTES.leadSources;
}

/** The current state with a patch applied; opening a sheet keeps the view and the open source. */
export function patchLeadSourcesUrl(current: LeadSourcesUrl, patch: Partial<LeadSourcesUrl>): string {
  return leadSourcesHref({ ...current, ...patch });
}

/** The state with every sheet key cleared (closing a sheet). The view and the open source stay. */
export function closeSheetUrl(current: LeadSourcesUrl): string {
  return leadSourcesHref({ view: current.view, source: current.source });
}

/** The sheet the URL asks for, or `add` for `?new=1`. */
export type OpenSheet = "add" | LeadSourcesEdit | null;

export function openSheetOf(url: LeadSourcesUrl): OpenSheet {
  if (url.isNew) return "add";
  return url.edit;
}
