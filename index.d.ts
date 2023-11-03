interface SwellConfig {
  description?: string;
  route?: {
    public?: boolean;
    methods?: [string];
    headers?: { [key: string]: string };
    cache?: {
      timeout?: number;
    };
  };
  model?: {
    events: [string];
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

interface SwellStore {
  id: string;
  url: string;
  admin_url: string;
}

declare class SwellRequest {
  originalRequest: Request;
  context: any;
  appId?: string | null;
  storeId?: string | null;
  accessToken?: string | null;
  publicKey?: string | null;
  store: SwellStore;
  apiHost: string;
  logParams?: object;
  swell: SwellAPI;
  body: object;
  data: object;
  query: { [key: string]: string };

  constructor(originalRequest: Request, context: any);

  initialize(): Promise<void>;

  parseJson(input: string): object;

  ingestLogs(response: Response): Promise<void>;
}

type SwellRequestMethod = "get" | "put" | "post" | "delete";

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

  delete(url: string): Promise<any>;

  settings(id?: string): Promise<object>;
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
