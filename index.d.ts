/**
 * Trigger configuration. Regular functions specify exactly one of route, model, cron, or action.
 */
type SwellConfig = SwellFunctionConfig | SwellWorkflowConfig;

interface SwellFunctionConfig {
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
  /**
   * Run by app actions in the Swell admin that name this function. Receives `req.data.$action` (see `SwellActionContext`);
   * return `{ message }` to show it to the admin user. Actions wait for the result, so keep them within `timeout`;
   * for longer work, name a workflow that sets `action` instead (see `SwellWorkflowConfig`).
   */
  action?: Record<string, never>;
  /** ms; 1000–10000 (default 10000). Values above 10000 (up to 20000) are platform-enabled and set outside this field. */
  timeout?: number;
}

interface SwellWorkflowConfig {
  kind: "workflow";
  description?: string;
  route?: never;
  model?: never;
  cron?: never;
  /**
   * Run by app actions in the Swell admin that name this workflow. Each action starts a run and returns right away;
   * the run gets the action's `modal.fields` values and `$action` (see `SwellActionContext`) in `req.data`, and `req.workflow.trigger` is `"action"`.
   */
  action?: Record<string, never>;
  extension?: never;
  timeout?: never;
}

interface SwellStore {
  id: string;
  url: string;
  admin_url: string;
}

/** Request context available in all function handlers */
declare class SwellRequest {
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

type SwellRequestMethod = "get" | "put" | "post" | "delete";

interface SwellData {
  /** set when an admin user runs an app action (`action` functions) */
  $action?: SwellActionContext;
  [key: string]: any;
}

interface SwellSettings {
  [key: string]: any;
}

/**
 * Sent as `req.data.$action` when an admin user runs an app action: to `action` functions, and to the workflow runs that actions start.
 * The platform sets `id`, `source`, `collection`/`settings` and `user_id` from the installed app's action declaration and the signed-in user.
 * `record_id` and `selection` come from the admin user's request, so treat them as input: check that ids are record ids (e.g. `/^[0-9a-f]{24}$/i`) before using them in a URL path,
 * and load the record from `collection` before acting on it.
 * Values entered in the action's `modal.fields` arrive at the top level of `req.data`.
 */
interface SwellActionContext {
  /** `id` of the declared action */
  id: string;
  /** `settings`: a settings file's `actions`; `field`: a `type: "action"` field; `list`/`record`: a content view's `actions` or `extra_actions`; `bulk`: a list view's `bulk_actions` */
  source: "settings" | "field" | "list" | "record" | "bulk";
  /** collection of the content model that declares the action (e.g. `products`, or `apps/<app_id>/<name>` for app-owned collections); set unless the action is declared in a settings file */
  collection?: string;
  /** name of the settings file that declares the action; set for settings actions and settings action fields */
  settings?: string;
  /** record the action ran on; set for record actions and for action fields in content files. From the admin user's request: validate it before using it in a URL path, and load the record from `collection` before acting on it */
  record_id?: string;
  /** records selected in the list; set for bulk actions. From the admin user's request: treat the ids and query as input */
  selection?: {
    /** `true` when the user selected every record matching the list's search and filters */
    all: boolean;
    /** selected record ids, when `all` is `false` */
    ids?: string[];
    /** record ids unchecked after selecting all, when `all` is `true` */
    except_ids?: string[];
    /** number of selected records shown in the admin when the action ran (informational); `null` when unknown */
    count: number | null;
    /** list query for the selected records, from the admin user's request; already excludes `except_ids`, so use it as is and add your own `limit` and `page`, e.g. `req.swell.get("/products", { ...query, limit: 100, page })` */
    query: { [key: string]: any };
  };
  /** id of the admin user who ran the action */
  user_id: string;
}

/** Platform API client */
declare class SwellAPI {
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

interface SwellWorkflowsAPI {
  create(
    workflowName: string,
    params?: unknown,
  ): Promise<SwellWorkflowCreateResult>;
}

interface SwellWorkflowCreateResult {
  id: string;
  status: "active";
}

interface SwellWorkflowRequest {
  id: string;
  appId: string;
  store: {
    id: string;
    admin_url?: string;
    url?: string;
  };
  /**
   * params passed to `workflows.create()`; for runs started by an app action, the action's `modal.fields` values and `$action` (see `SwellActionContext`).
   * Functions can pass any params to `workflows.create()`, including `$action`, so only trust `$action` when `workflow.trigger` is `"action"`.
   */
  data: unknown;
  workflow: {
    workflow_id: string;
    workflow_name: string;
    workflow_instance_id: string;
    /** `action` when an app action started the run; `function` when a function called `workflows.create()` */
    trigger: "function" | "action";
    request_id: string;
  };
  isLocalDev: false;
  swell: SwellWorkflowAPI;
}

interface SwellWorkflowAPI {
  get(path: string, data?: unknown): Promise<unknown>;
  post(path: string, data?: unknown): Promise<unknown>;
  put(path: string, data?: unknown): Promise<unknown>;
  delete(path: string, data?: unknown): Promise<unknown>;
  settings(): Promise<SwellSettings>;
}

interface SwellWorkflowStep {
  do<T>(
    name: string,
    options: SwellWorkflowStepOptions,
    callback: () => Promise<T>,
  ): Promise<T>;

  do<T>(name: string, callback: () => Promise<T>): Promise<T>;

  sleep(name: string, duration: string | number): Promise<void>;

  sleepUntil(name: string, date: Date | string | number): Promise<void>;
}

interface SwellWorkflowStepOptions {
  retries?: {
    limit: number;
    delay: string | number;
    backoff?: "constant" | "linear" | "exponential";
  };
  timeout?: string | number;
}

interface SwellErrorOptions {
  method?: string;
  endpointUrl?: string;
  status?: number;
  code?: string;
  /** Set false on event-triggered functions to record the failure without scheduling further retries. */
  retry?: boolean;
}

interface SwellRejectOptions {
  status?: number;
}

/**
 * Thrown by `req.swell.*` on non-2xx responses (and on non-GET 2xx responses containing `errors`).
 * User code can also throw this to return error responses.
 * On event-triggered functions, throw with `retry: false` to record the failed delivery
 * (with its real status and message) without scheduling further retries.
 */
declare class SwellError extends Error {
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

declare class SwellRejection extends Error {
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

interface SwellResponseOptions extends ResponseInit {
  status?: number;
  headers?: HeadersInit;
}

/** Response helper for custom status/headers; preferred over native Response */
declare class SwellResponse extends Response {
  constructor(
    data: string | object | undefined,
    options?: SwellResponseOptions,
  );
}

type SwellHandlerResult = Response | SwellData | string | void;

type SwellHandler = (
  req: SwellRequest,
  context?: any,
) => SwellHandlerResult | Promise<SwellHandlerResult>;
