export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: string;
  issues?: unknown;
  request_id?: string;
  registry_code?: string;
  remediation?: {
    summary?: string;
    action?: string;
    fields?: string[];
    entity_type?: string;
    entity_id?: string;
    [key: string]: unknown;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type SortDirection = "asc" | "desc";

export type PaginationParams = {
  page: number;
  limit: number;
};

export type SortParams = {
  sort?: string;
  direction?: SortDirection;
};

export type DateRangeParams = {
  from?: string;
  to?: string;
  date_field?: string;
};

export type TableQueryParams = PaginationParams &
  SortParams &
  DateRangeParams & {
    q?: string;
    [key: string]: string | number | boolean | undefined;
  };

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  limit: number;
  total?: number;
  has_next_page?: boolean;
  cursor?: string;
  next_cursor?: string | null;
};

export type LegacyBrowseResult<T> = {
  results: T[];
  count: number;
};

export type SelectOption<TValue extends string = string> = {
  value: TValue;
  label: string;
};

export type GlobalSearchRecordType =
  | "form_lead"
  | "call_lead"
  | "booked_lead"
  | "cancelled_lead"
  | "form-leads"
  | "call-leads"
  | "booked-leads"
  | "cancelled-leads";

export type GlobalSearchResultItem = {
  id: string;
  primary_label: string;
  secondary_label?: string;
  badges?: string[];
  href?: string;
};

export type GlobalSearchGroup = {
  record_type: GlobalSearchRecordType;
  items: GlobalSearchResultItem[];
};

export type GlobalSearchResponse = {
  groups: GlobalSearchGroup[];
};
