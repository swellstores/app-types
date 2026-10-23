/**
 * Trigger configuration. Regular functions specify exactly one of route, model, cron, or action.
 * Workflows use `kind: "workflow"` with a class entrypoint instead.
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
  /**
   * Run by app actions that name this function: settings `actions`, content view `actions`/`extra_actions`/`bulk_actions`, and `type: "action"` fields.
   * Receives `req.data.$action` (see `SwellActionContext`) plus the action's modal field values; return `{ message }` to show it to the admin user.
   * Only admin users can run actions: `$call` and the storefront function gateway refuse action functions. The admin waits for the result, so keep runs within `timeout`;
   * for longer work, name a workflow that sets `action` instead (see `SwellWorkflowConfig`).
   * Set `action: true`; the object form is for options the trigger may get later.
   */
  action?: true | Record<string, never>;
  /** ms; 1000–10000 (default 10000). Values above 10000 (up to 20000) are platform-enabled and set outside this field. */
  timeout?: number;
}

/**
 * Workflow declaration.
 * The file default-exports a class with `run(req, step)` instead of a handler function.
 * Workflows run only after `swell app push`: they do not execute under `swell app dev`.
 */
export interface SwellWorkflowConfig {
  kind: "workflow";
  description?: string;
  route?: never;
  model?: never;
  cron?: never;
  /**
   * Run by app actions that name this workflow. Each action starts a run and returns right away;
   * the run gets the action's `modal.fields` values and `$action` (see `SwellActionContext`) in `req.data`, and `req.workflow.trigger` is `"action"`.
   * `req.data` has the same 128 KB limit as `workflows.create()` params, so a bulk action on a few thousand selected ids fails with `workflow_params_too_large`.
   * Under `swell app dev`, actions start the pushed version of the workflow.
   * Set `action: true`; the object form is for options the trigger may get later.
   */
  action?: true | Record<string, never>;
  extension?: never;
  timeout?: never;
}

export interface SwellStore {
  id: string;
  url: string;
  admin_url: string;
}

export interface SwellApp {
  /** the app's page in the dashboard, in the environment of the request */
  admin_url: string;
  /** the address of the app's installation in the environment of the request, where its frontend, if it has one, and its components are served */
  frontend_url: string;
}

/**
 * Platform context of a call made by one of this app's components
 * (the `Swell-Context` header). The platform forwards the header only after
 * verifying its signature, app and store.
 */
export interface SwellContext {
  appId: string;
  installationId: string;
  storeId: string;
  /** The signed-in admin user the component runs for, or null */
  storeUser: { storeId: string; userId: string } | null;
  storefrontId?: string;
  /** Where the calling component runs; 'admin' for admin content fields */
  surface?: "admin" | "checkout" | "storefront";
}

/** Event metadata attached to `req.data` for model triggers */
export interface SwellEvent {
  /** Event id. Absent on synchronous hook invocations. */
  id?: string;
  /** e.g. `review.created` */
  type: string;
  /** e.g. `reviews` or `apps/<app_id>/reviews` */
  model: string;
  app_id?: string;
  /** present only on synchronous hook invocations */
  hook?: "before" | "after";
  /**
   * Record data of the event, absent on synchronous hook invocations:
   * * `created`/`deleted`: full record snapshot;
   * * `updated`: changed fields only;
   * * custom: the subset declared in the model event's `fields`
   */
  data?: Record<string, any>;
  /** Event delivery state. Absent on synchronous hook invocations. */
  delivery?: {
    /** The number of attempts to send the event to the function (`0` on first delivery, increments on each retry) */
    attempts: number;
    /** The date of the first failure to send the event to the function */
    date_first_failed?: string;
  };
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
  /** `"test"` in the test environment, null in live */
  environmentId: string | null;
  accessToken?: string | null;
  publicKey?: string | null;
  store: SwellStore;
  app: SwellApp;
  /** the shopper's session on a route called through the storefront address, `{}` when no shopper is signed in; on other calls null, unless the caller sends its own `Swell-Session` header */
  session?: { account_id?: string; [key: string]: any } | null;
  /**
   * Set when one of this app's components made the call, otherwise null.
   * Route functions called with it do not need `route.public`. Use
   * `verifySwellContext` from `@swell/apps-sdk` when the function needs
   * cryptographic proof itself.
   */
  swellContext: SwellContext | null;
  apiHost: string;
  logParams?: object;
  /** `true` when invoked via `swell app dev` local proxy; `false` in production. Useful for dev-only branches (mock external APIs, skip destructive writes) */
  isLocalDev: boolean;
  /** authenticated platform client */
  swell: SwellAPI;
  /** Parsed JSON body as object, or raw text string when body isn't JSON. model events and hooks: the same object as `data`. cron: empty `{}`. */
  body: SwellData | string;
  /**
   * Request body text. On a route called through the storefront gateway with a JSON body, this is the exact text the caller sent,
   * so verify HMAC/webhook signatures against it: re-stringifying `body` won't byte-match. Other bodies (form-encoded, `swell api`, model events) arrive re-serialized as JSON.
   */
  rawBody: string;
  /**
   * Trigger payload. model events: the record as stored + `$event`. hooks: the values the write sets (the record on a delete) + `$event`, and `$record` with the record before an update. cron: empty. route: body and query, query keys overwrite body keys. action: modal field values + `$action`.
   * When body/query precedence matters (e.g. security-sensitive handlers), use `req.body` and `req.query` directly.
   */
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

/**
 * Model triggers also get `$event` (see `SwellEvent`, e.g. `req.data.$event as SwellEvent`), and
 * `before:updated` / `after:updated` hooks get `$record`, the record before the write (absent on
 * create and delete, so check with `if (!$record)`). Both are untyped here.
 */
export interface SwellData {
  /** set when an admin user runs an app action (`action` functions) */
  $action?: SwellActionContext;
  [key: string]: any;
}

export interface SwellSettings {
  [key: string]: any;
}

/**
 * Sent as `req.data.$action` when an admin user runs an app action: to `action` functions, and to the workflow runs that actions start.
 * The platform checks it against the installed app's action declaration: it sets `id`, `source`, `collection`/`settings` and `user_id`
 * from the declaration and the signed-in user, and refuses a `record_id` that is not a record of `collection`. `selection` is what the admin user selected.
 * Values entered in the action's `modal.fields` arrive at the top level of `req.data`.
 */
export interface SwellActionContext {
  /** `id` of the declared action */
  id: string;
  /** `settings`: a settings file's `actions`; `field`: a `type: "action"` field; `list`/`record`: a content view's `actions` or `extra_actions`; `bulk`: a list view's `bulk_actions` */
  source: "settings" | "field" | "list" | "record" | "bulk";
  /** collection of the records the content model that declares the action shows (e.g. `products`, `apps/<app_id>/<name>` for app-owned collections, or `products:variants` for content of a child collection); set unless the action is declared in a settings file */
  collection?: string;
  /** name of the settings file that declares the action; set for settings actions and settings action fields */
  settings?: string;
  /** id of the record of `collection` the action ran on, which the platform checks; set for record actions and for action fields in content files */
  record_id?: string;
  /** records selected in the list; set for bulk actions. From the admin user's request: treat the ids and query as input */
  selection?: {
    /** `true` when the user selected every record matching the list's search and filters */
    all: boolean;
    /** selected record ids, when `all` is `false`; informational, since `query` already selects them */
    ids?: string[];
    /** record ids unchecked after selecting all, when `all` is `true`; informational, since `query` already excludes them */
    except_ids?: string[];
    /** number of selected records shown in the admin when the action ran (informational); `null` when unknown */
    count: number | null;
    /** always set: exactly the filter the admin's own bulk operations use for this selection (the list's search and filters, with the selected or unchecked ids in a top-level `$and`), without paging, sort or other list presentation params. Pass it to `req.swell.get` as is with your own paging, e.g. `req.swell.get("/products", { ...query, limit: 100, page })`. To add conditions, append them to `query.$and`, e.g. `{ ...query, $and: [...(query.$and || []), condition] }`: replacing `query.$and` or `query.where` drops the selected ids or the list's filters */
    query: { [key: string]: any };
  };
  /** id of the admin user who ran the action */
  user_id: string;
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

  /** A read of an id that does not exist resolves empty, so test `if (!record)` */
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

/** Start workflow instances from app functions. */
export interface SwellWorkflowsAPI {
  /**
   * Start a workflow instance by name. `params` are passed through as `req.data` inside the workflow, less a `$action` key;
   * they must be JSON-serializable and at most 128 KB: invalid params reject with `workflow_params_unserializable` or
   * `workflow_params_too_large` before any instance is created.
   */
  create(
    workflowName: string,
    params?: unknown,
  ): Promise<SwellWorkflowCreateResult>;
}

export interface SwellWorkflowCreateResult {
  id: string;
  status: "active";
}

/** Request context passed to a workflow's `run(req, step)` */
export interface SwellWorkflowRequest {
  id: string;
  appId: string;
  /** `"test"` in the test environment, null in live */
  environmentId: string | null;
  store: {
    id: string;
    admin_url?: string;
    url?: string;
  };
  app: SwellApp;
  /**
   * params passed to `workflows.create()`; for runs started by an app action, the action's `modal.fields` values and `$action` (see `SwellActionContext`).
   * Only a run that an action starts has `$action`.
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
  /** workflows never run under `swell app dev` */
  isLocalDev: false;
  swell: SwellWorkflowAPI;

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
}

/**
 * Platform client inside a workflow: a narrower surface than a function's, and a write refused by
 * validation resolves with `{ errors }` instead of throwing
 */
export interface SwellWorkflowAPI {
  get<T = unknown>(path: string, data?: unknown): Promise<T>;
  post<T = unknown>(path: string, data?: unknown): Promise<T>;
  put<T = unknown>(path: string, data?: unknown): Promise<T>;
  delete<T = unknown>(path: string, data?: unknown): Promise<T>;
  settings(): Promise<SwellSettings>;
}

/** Durable step runner. Each `step.do(name, fn)` executes once: its result is recorded and not re-run on retry. */
export interface SwellWorkflowStep {
  do<T>(
    name: string,
    options: SwellWorkflowStepOptions,
    callback: () => Promise<T>,
  ): Promise<T>;

  do<T>(name: string, callback: () => Promise<T>): Promise<T>;

  /** e.g. `"30 seconds"`; pauses without holding compute */
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
  /** Seconds to put off the next call of an event-triggered function, up to 12 hours; it is never called sooner than its retry schedule. Sent as `Retry-After`. */
  retryAfter?: number;
}

export interface SwellRejectOptions {
  status?: number;
}

/**
 * Thrown by `req.swell.*` on non-2xx responses (and on non-GET 2xx responses containing `errors`).
 * User code can also throw this to return error responses.
 * On event-triggered functions, throw with `retry: false` to record the failed delivery
 * (with its real status and message) without scheduling further retries, or with
 * `retryAfter` to put off the next call by that many seconds.
 */
export declare class SwellError extends Error {
  status: number;
  /** structured response payload when the error was constructed from a non-string */
  body?: unknown;
  /** stable error code from `options.code` or the response's `error.code` (e.g. `transaction_conflict`) */
  code?: string;
  retry?: boolean;
  retryAfter?: number;
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
