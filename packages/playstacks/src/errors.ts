/** Base error class for all Playstacks errors. */
export class PlaystacksError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PlaystacksError';
  }
}

/** Thrown when the Stacks API is unreachable or returns an HTTP error. */
export class NetworkError extends PlaystacksError {
  readonly statusCode: number;
  readonly url: string;
  readonly responseBody?: string;

  constructor(
    message: string,
    statusCode: number,
    url: string,
    responseBody?: string,
  ) {
    super(message);
    this.name = 'NetworkError';
    this.statusCode = statusCode;
    this.url = url;
    this.responseBody = responseBody;
  }
}

/** Thrown when fee estimation fails. */
export class FeeEstimationError extends PlaystacksError {
  readonly statusCode?: number;
  readonly responseBody?: string;

  constructor(
    message: string,
    statusCode?: number,
    responseBody?: string,
  ) {
    super(message);
    this.name = 'FeeEstimationError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

/** Thrown when a signed transaction is rejected during broadcast. */
export class BroadcastError extends PlaystacksError {
  readonly reason?: string;

  constructor(message: string, reason?: string) {
    super(message);
    this.name = 'BroadcastError';
    this.reason = reason;
  }
}

/** Thrown when a transaction does not confirm within the configured timeout. */
export class ConfirmationError extends PlaystacksError {
  readonly txid: string;
  readonly timeoutMs: number;

  constructor(message: string, txid: string, timeoutMs: number) {
    super(message);
    this.name = 'ConfirmationError';
    this.txid = txid;
    this.timeoutMs = timeoutMs;
  }
}

/** Thrown when the mock wallet rejects a request (code 4001). */
export class UserRejectionError extends PlaystacksError {
  readonly code: number;

  constructor(message = 'User rejected the request', code = 4001) {
    super(message);
    this.name = 'UserRejectionError';
    this.code = code;
  }
}

/** Thrown when configuration is invalid (missing key, unknown network, bad key length). */
export class ConfigurationError extends PlaystacksError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}
