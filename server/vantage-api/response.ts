import { VantageApiError } from "./errors";

export type VantageApiResponse<T = unknown> =
  | {
      kind: "json";
      status: number;
      headers: Headers;
      data: T;
    }
  | {
      kind: "csv";
      status: number;
      headers: Headers;
      body: ArrayBuffer;
    }
  | {
      kind: "text";
      status: number;
      headers: Headers;
      text: string;
    }
  | {
      kind: "empty";
      status: number;
      headers: Headers;
    };

type BackendEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error?: string; issues?: unknown };

function isJsonContentType(contentType: string | null): boolean {
  return contentType?.toLowerCase().includes("application/json") ?? false;
}

function isCsvContentType(contentType: string | null): boolean {
  const normalized = contentType?.toLowerCase() ?? "";
  return normalized.includes("text/csv") || normalized.includes("application/csv");
}

function getRequestId(headers: Headers): string | undefined {
  return (
    headers.get("x-request-id") ??
    headers.get("x-correlation-id") ??
    headers.get("request-id") ??
    undefined
  );
}

export async function parseVantageApiResponse<T = unknown>(
  response: Response,
  path?: string,
): Promise<VantageApiResponse<T>> {
  const contentType = response.headers.get("content-type");
  const requestId = getRequestId(response.headers);

  if (response.status === 204) {
    if (!response.ok) {
      throw new VantageApiError({
        status: response.status,
        message: response.statusText || "Vantage API request failed.",
        requestId,
        responseType: contentType ?? undefined,
        path,
      });
    }

    return {
      kind: "empty",
      status: response.status,
      headers: response.headers,
    };
  }

  if (isCsvContentType(contentType)) {
    const body = await response.arrayBuffer();
    if (!response.ok) {
      throw new VantageApiError({
        status: response.status,
        message: response.statusText || "CSV request failed.",
        requestId,
        responseType: contentType ?? undefined,
        path,
      });
    }

    return {
      kind: "csv",
      status: response.status,
      headers: response.headers,
      body,
    };
  }

  if (isJsonContentType(contentType)) {
    const json = (await response.json()) as BackendEnvelope<T> | T;

    if (typeof json === "object" && json !== null && "ok" in json) {
      const envelope = json as BackendEnvelope<T>;
      if (!envelope.ok) {
        throw new VantageApiError({
          status: response.status,
          message: envelope.error ?? response.statusText ?? "Vantage API request failed.",
          backendError: envelope.error,
          issues: envelope.issues,
          requestId,
          responseType: contentType ?? undefined,
          path,
        });
      }

      return {
        kind: "json",
        status: response.status,
        headers: response.headers,
        data: envelope.data,
      };
    }

    if (!response.ok) {
      throw new VantageApiError({
        status: response.status,
        message: response.statusText || "Vantage API request failed.",
        requestId,
        responseType: contentType ?? undefined,
        path,
      });
    }

    return {
      kind: "json",
      status: response.status,
      headers: response.headers,
      data: json as T,
    };
  }

  const text = await response.text();
  if (!response.ok) {
    throw new VantageApiError({
      status: response.status,
      message: text || response.statusText || "Vantage API request failed.",
      backendError: text || undefined,
      requestId,
      responseType: contentType ?? undefined,
      path,
    });
  }

  return {
    kind: "text",
    status: response.status,
    headers: response.headers,
    text,
  };
}
