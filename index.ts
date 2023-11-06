export interface SwellConfig {
  description?: string;
  route?: {
    public?: boolean;
    methods?: [string, ...string[]];
    headers?: { [key: string]: string };
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
  };
  cron?: {
    schedule: string;
  };
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
  body: SwellData;
  data: SwellData;
  query: { [key: string]: string };

  constructor(originalRequest: Request, context: any);

  initialize(): Promise<void>;

  parseJson(input: string): object;

  ingestLogs(response: Response): Promise<void>;
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
    data?: any
  ): Promise<any>;

  get(url: string, query?: any): Promise<any>;

  put(url: string, data: any): Promise<any>;

  post(url: string, data: any): Promise<any>;

  delete(url: string, data: any): Promise<any>;

  settings(id?: string): Promise<SwellSettings>;
}

export interface SwellErrorOptions {
  method?: string;
  endpointUrl?: string;
  status?: number;
}

export declare class SwellError extends Error {
  status: number;

  constructor(message: string | object, options?: SwellErrorOptions);
}

export interface SwellResponseOptions extends ResponseInit {
  status?: number;
  headers?: HeadersInit;
}

export declare class SwellResponse extends Response {
  constructor(
    data: string | object | undefined,
    options?: SwellResponseOptions
  );
}
