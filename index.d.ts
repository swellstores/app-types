interface SwellConfig {
  description?: string;
  extension?: string;
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
    fields?: [string, ...string[]];
    compatibilities?: [string, ...string[]];
  };
  cron?: {
    schedule: string;
  };
  /**
   * Max time in ms to wait for the function worker to respond. 1000–20000.
   * Default 10000. Values above 10000 require the `functions.long_timeout`
   * feature.
   */
  timeout?: number;
}

interface SwellStore {
  id: string;
  url: string;
  admin_url: string;
}

declare class SwellRequest {
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

  appValues(idOrValues: object | string, values?: object): object | undefined;
}

type SwellRequestMethod = "get" | "put" | "post" | "delete";

interface SwellData {
  [key: string]: any;
}

interface SwellSettings {
  [key: string]: any;
}

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
    data?: any
  ): Promise<any>;

  get(url: string, query?: any): Promise<any>;

  put(url: string, data: any): Promise<any>;

  post(url: string, data: any): Promise<any>;

  delete(url: string, data: any): Promise<any>;

  settings(id?: string): Promise<SwellSettings>;
}

interface SwellErrorOptions {
  method?: string;
  endpointUrl?: string;
  status?: number;
}

declare class SwellError extends Error {
  status: number;

  constructor(message: string | object, options?: SwellErrorOptions);
}

interface SwellResponseOptions extends ResponseInit {
  status?: number;
  headers?: HeadersInit;
}

declare class SwellResponse extends Response {
  constructor(
    data: string | object | undefined,
    options?: SwellResponseOptions
  );
}
