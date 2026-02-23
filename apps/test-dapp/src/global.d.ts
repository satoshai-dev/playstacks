declare global {
  interface Window {
    StacksProvider?: {
      request(method: string, params?: Record<string, unknown>): Promise<unknown>;
    };
  }
}

export {};
