/**
 * Trigger configuration. Regular functions specify exactly one of route, model, or cron.
 */
export type SwellConfig = SwellFunctionConfig | SwellWorkflowConfig;

export interface SwellFunctionConfig {
  kind?: "function";
  description?: string;
  /** scope this function to a specific app extension (multi-extension apps only) */
  extension?: string;
  route?: {
    /** default `false` — requires secret key auth; set true to expose without auth */
    public?: boolean;
    methods?: [SwellRequestMethod, ...SwellRequestMethod[]];
    /** allow-list of incoming header names to forward; omit to forward all */
    headers?: string[];
    cache?: {
      /** ms, GET only; defaults to 5000 ms when omitted — set 0 to disable */
      timeout?: number;
    };
  };
  model?: {
    /**
     * * async: `review.created`;
     * * hook: `before:review.created` / `after:review.created`, or `apps/<app_id>/reviews/before:review.created` (fully qualified for app-own models)
     */
    events: [string, ...string[]];
    /** MongoDB-style filter; may reference `$record`, `$data`, `$event`, `$settings`, `$formula` */
    conditions?: object;
    schedule?: {
      /** date field for delayed execution */
      formula: string;
    };
    sequence?: number;
    /** narrows `$event.data` for custom events to the listed fields (has no effect on standard `created`/`updated`/`deleted` events) */
    fields?: [string, ...string[]];
    compatibilities?: [string, ...string[]];
  };
  cron?: {
    /** cron expression, e.g. `0 0 * * *` */
    schedule: string;
  };
  /** ms; 1000–10000 (default 10000). Values above 10000 (up to 20000) are platform-enabled and set outside this field. */
  timeout?: number;
}

export interface SwellWorkflowConfig {
  kind: "workflow";
  description?: string;
  route?: never;
  model?: never;
  cron?: never;
  extension?: never;
  timeout?: never;
}

export interface SwellStore {
  id: string;
  url: string;
  admin_url: string;
}

/** Request context available in all function handlers */
export declare class SwellRequest {
  originalRequest: Request;
  /** Cloudflare Worker execution context. Use `waitUntil()` to run work after the response returns (logs, metrics, non-blocking side effects) */
  context: any;

  /**
   * HTTP request layer (routes).
   *
   * On model/cron triggers method is 'POST', headers carry the platform envelope, url/id are populated but not meaningful to author code.
   */

  /** parsed request URL — use `url.pathname`, `url.searchParams`, etc. */
  url: URL;
  /** uppercase HTTP method (e.g. `GET`, `POST`) */
  method: string;
  /** incoming request headers; on routes filtered by `route.headers` allow-list when set */
  headers: Headers;
  referrer: string | undefined;
  credentials: string | undefined;
  /** `Swell-Request-ID` for log correlation across function invocations */
  id?: string;

  /** Slug-form app id (e.g. `"klaviyo"`); matches keys in `record.$app[...]`. */
  appId?: string | null;
  storeId?: string | null;
  accessToken?: string | null;
  publicKey?: string | null;
  store: SwellStore;
  /** authenticated user (routes) */
  session?: { account_id?: string; [key: string]: any };
  apiHost: string;
  logParams?: object;
  /** `true` when invoked via `swell app dev` local proxy; `false` in production. Useful for dev-only branches (mock external APIs, skip destructive writes) */
  isLocalDev: boolean;
  /** authenticated platform client */
  swell: SwellAPI;
  /** Parsed JSON body as object, or raw text string when body isn't JSON. */
  body: SwellData | string;
  // Raw request body text, untouched by parsing.
  // Use on route triggers for HMAC/webhook signature verification — re-stringifying `body` won't byte-match the original.
  rawBody: string;
  data: SwellData;
  /** URL query parameters (routes) */
  query: { [key: string]: string };

  constructor(originalRequest: Request, context: any);

  initialize(): Promise<void>;

  parseJson(input: string): object;

  /**
   * Wrap values for the $app namespace when writing to standard model extensions.
   * Returns `{ $app: { [appId]: values } }`. Pass `appId` as the first argument to target another app.
   * @throws if values is not a plain object (arrays, class instances, null, and primitives are rejected)
   */
  appValues(values: object): { $app: { [appId: string]: object } };
  appValues(
    appId: string,
    values: object,
  ): { $app: { [appId: string]: object } };

  /**
   * Build a rejection for a `before:` hook. Throw the result to block the write; the API caller gets `code`, `message` and `status`.
   * `status` must be 400–499; anything else coerces to 422. Rejections from `after:` hooks are ignored.
   */
  reject(
    code: string,
    message: string,
    options?: SwellRejectOptions,
  ): SwellRejection;
}

export type SwellRequestMethod = "get" | "put" | "post" | "delete";

export interface SwellData {
  [key: string]: any;
}

export interface SwellSettings {
  [key: string]: any;
}

/** Platform API client */
export declare class SwellAPI {
  request: SwellRequest;
  baseUrl: string;
  basicAuth: string;
  context: any;

  constructor(req: SwellRequest, context: any);

  toBase64(inputString: string): string;

  stringifyQuery(queryObject: Record<string, any>, prefix?: string): string;

  makeRequest(
    method: SwellRequestMethod,
    url: string,
    data?: any,
  ): Promise<any>;

  get(url: string, query?: any): Promise<any>;

  put(url: string, data: any): Promise<any>;

  post(url: string, data: any): Promise<any>;

  delete(url: string, data?: any): Promise<any>;

  /**
   * Read app settings. With no argument, returns the current app's settings.
   * Pass another app's id to read a different installed app's settings (cross-app).
   */
  settings(id?: string): Promise<SwellSettings>;

  /**
   * Atomic multi-operation write (`POST /:transaction`). Max 10 operations; if any fails, the whole
   * transaction rolls back and no partial writes are committed. Errors carry stable codes
   * (`transaction_conflict`, `transaction_throttled`, `transaction_timeout`, `transaction_op_failed`) and
   * `op_index` identifying the failed operation. Child operations fire no per-record webhooks or
   * app functions; a successful transaction emits one `transaction.committed` event for the bundle.
   */
  transaction(
    ops: Array<{ method: SwellRequestMethod; url: string; data?: any }>,
    options?: { retry?: boolean },
  ): Promise<any>;

  workflows: SwellWorkflowsAPI;
}

export interface SwellWorkflowsAPI {
  create(
    workflowName: string,
    params?: unknown,
  ): Promise<SwellWorkflowCreateResult>;
}

export interface SwellWorkflowCreateResult {
  id: string;
  status: "active";
}

export interface SwellWorkflowRequest {
  id: string;
  appId: string;
  store: {
    id: string;
    admin_url?: string;
    url?: string;
  };
  data: unknown;
  workflow: {
    workflow_id: string;
    workflow_name: string;
    workflow_instance_id: string;
    trigger: "function";
    request_id: string;
  };
  isLocalDev: false;
  swell: SwellWorkflowAPI;
}

export interface SwellWorkflowAPI {
  get(path: string, data?: unknown): Promise<unknown>;
  post(path: string, data?: unknown): Promise<unknown>;
  put(path: string, data?: unknown): Promise<unknown>;
  delete(path: string, data?: unknown): Promise<unknown>;
  settings(): Promise<SwellSettings>;
}

export interface SwellWorkflowStep {
  do<T>(
    name: string,
    options: SwellWorkflowStepOptions,
    callback: () => Promise<T>,
  ): Promise<T>;

  do<T>(name: string, callback: () => Promise<T>): Promise<T>;

  sleep(name: string, duration: string | number): Promise<void>;

  sleepUntil(name: string, date: Date | string | number): Promise<void>;
}

export interface SwellWorkflowStepOptions {
  retries?: {
    limit: number;
    delay: string | number;
    backoff?: "constant" | "linear" | "exponential";
  };
  timeout?: string | number;
}

export interface SwellErrorOptions {
  method?: string;
  endpointUrl?: string;
  status?: number;
  code?: string;
  /** Set false on event-triggered functions to record the failure without scheduling further retries. */
  retry?: boolean;
}

export interface SwellRejectOptions {
  status?: number;
}

/**
 * Thrown by `req.swell.*` on non-2xx responses (and on non-GET 2xx responses containing `errors`).
 * User code can also throw this to return error responses.
 * On event-triggered functions, throw with `retry: false` to record the failed delivery
 * (with its real status and message) without scheduling further retries.
 */
export declare class SwellError extends Error {
  status: number;
  /** structured response payload when the error was constructed from a non-string */
  body?: unknown;
  /** stable error code from `options.code` or the response's `error.code` (e.g. `transaction_conflict`) */
  code?: string;
  retry?: boolean;
  /** `true` for `transaction_conflict` and `transaction_throttled` */
  readonly isRetryable: boolean;

  constructor(message: string | object, options?: SwellErrorOptions);
}

export declare class SwellRejection extends Error {
  status: number;
  code: string;
  body: {
    $reject: {
      code: string;
      message: string;
      status: number;
    };
  };

  constructor(code: string, message: string, options?: SwellRejectOptions);
}

export interface SwellResponseOptions extends ResponseInit {
  status?: number;
  headers?: HeadersInit;
}

/** Response helper for custom status/headers; preferred over native Response */
export declare class SwellResponse extends Response {
  constructor(
    data: string | object | undefined,
    options?: SwellResponseOptions,
  );
}

export type SwellHandlerResult = Response | SwellData | string | void;

export type SwellHandler = (
  req: SwellRequest,
  context?: any,
) => SwellHandlerResult | Promise<SwellHandlerResult>;
