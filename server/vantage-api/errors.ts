export type VantageApiErrorOptions = {
  status: number;
  message: string;
  backendError?: string;
  issues?: unknown;
  requestId?: string;
  responseType?: string;
  path?: string;
};

export class VantageApiError extends Error {
  readonly status: number;
  readonly backendError?: string;
  readonly issues?: unknown;
  readonly requestId?: string;
  readonly responseType?: string;
  readonly path?: string;

  constructor(options: VantageApiErrorOptions) {
    super(options.message);
    this.name = "VantageApiError";
    this.status = options.status;
    this.backendError = options.backendError;
    this.issues = options.issues;
    this.requestId = options.requestId;
    this.responseType = options.responseType;
    this.path = options.path;
  }
}

export class VantageApiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VantageApiConfigurationError";
  }
}
