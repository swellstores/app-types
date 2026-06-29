export type SwellConfig = SwellFunctionConfig | SwellWorkflowConfig;

export interface SwellFunctionConfig {
  kind?: "function";
  description?: string;
  extension?: string;
  route?: {
    public?: boolean;
    methods?: [SwellRequestMethod, ...SwellRequestMethod[]];
    headers?: string[];
    cache?: {
      timeout?: number;
    };
  };
  model?: {
    events: [string, ...string[]];
    conditions?: object;
    schedule?: {
      formula: string;
    };
    sequence?: number;
    fields?: [string, ...string[]];
    compatibilities?: [string, ...string[]];
  };
  cron?: {
    schedule: string;
  };
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

export declare class SwellRequest {
  originalRequest: Request;
  context: any;

  url: string;
  method: string;
  headers: Headers;
  referrer: string | undefined;
  credentials: string | undefined;

  appId?: string | null;
  storeId?: string | null;
  accessToken?: string | null;
  publicKey?: string | null;
  store: SwellStore;
  session?: { [key: string]: any };
  apiHost: string;
  logParams?: object;
  swell: SwellAPI;
  body: SwellData | string;
  /** Raw body text; use for HMAC/webhook signature verification. */
  rawBody: string;
  data: SwellData;
  query: { [key: string]: string };

  constructor(originalRequest: Request, context: any);

  initialize(): Promise<void>;

  parseJson(input: string): object;

  appValues(values: object): { $app: { [appId: string]: object } };
  appValues(
    appId: string,
    values: object,
  ): { $app: { [appId: string]: object } };

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

  settings(id?: string): Promise<SwellSettings>;

  /** Atomic multi-operation write (POST /:transaction). Max 10 operations; rolls back entirely if any fails. */
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
  /** Set false on event-triggered functions to record the failure without scheduling further retries. */
  retry?: boolean;
}

export interface SwellRejectOptions {
  status?: number;
}

export declare class SwellError extends Error {
  status: number;
  body?: unknown;

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
