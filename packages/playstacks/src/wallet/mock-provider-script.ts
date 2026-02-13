/**
 * Browser-side injection script.
 *
 * This script is injected via page.addInitScript() and runs BEFORE any dApp code.
 * It installs mock wallet providers on window that forward all .request() calls
 * to the Node-side handler via the __playstacksRequest bridge function.
 *
 * The script must be self-contained — no imports, no external dependencies.
 */
export function getMockProviderScript(walletAddress: string, publicKey: string): string {
  // Using a template literal that produces a self-contained IIFE
  return `
(function() {
  const WALLET_ADDRESS = ${JSON.stringify(walletAddress)};
  const PUBLIC_KEY = ${JSON.stringify(publicKey)};

  /**
   * Core request handler — forwards JSON-RPC calls to Node.js
   * via the bridge function exposed by page.exposeFunction().
   *
   * Returns the full JSON-RPC response envelope { result: ... }
   * as expected by @stacks/connect's requestRaw().
   */
  async function handleRequest(method, params) {
    if (typeof window.__playstacksRequest !== 'function') {
      throw new Error('Playstacks bridge not ready. Ensure test setup completed.');
    }

    var requestJson = JSON.stringify({ method: method, params: params || {} });
    var responseJson = await window.__playstacksRequest(requestJson);
    var response = JSON.parse(responseJson);

    if (response.error) {
      var error = new Error(response.error.message || 'Wallet request failed');
      error.code = response.error.code || 4001;
      throw error;
    }

    // Return full envelope — @stacks/connect does: response.result
    return response;
  }

  /** Noop event listener — returns cleanup function */
  var listeners = {};
  function addListener(event, handler) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(handler);
    return function() {
      listeners[event] = (listeners[event] || []).filter(function(h) { return h !== handler; });
    };
  }

  /**
   * Provider object that implements the Stacks wallet JSON-RPC interface.
   * Used by @stacks/connect, Leather, and Xverse SDKs.
   */
  var mockProvider = {
    request: function(method, params) {
      if (typeof method === 'object' && method !== null) {
        return handleRequest(method.method, method.params);
      }
      return handleRequest(method, params);
    },
    addListener: addListener,
    isConnected: function() { return true; },
    getProductInfo: function() {
      return Promise.resolve({
        name: 'Playstacks Mock',
        icon: '',
        version: '2.0.0',
      });
    },
    // Xverse detection: @stacks/connect checks for these properties
    signMultipleTransactions: undefined,
    createRepeatInscriptions: undefined,
    disconnect: function() {},
  };

  // @stacks/connect default
  Object.defineProperty(window, 'StacksProvider', {
    value: mockProvider,
    writable: false,
    configurable: true,
  });

  // Leather wallet direct API
  Object.defineProperty(window, 'LeatherProvider', {
    value: mockProvider,
    writable: false,
    configurable: true,
  });

  // Legacy Hiro wallet
  Object.defineProperty(window, 'HiroWalletProvider', {
    value: mockProvider,
    writable: false,
    configurable: true,
  });

  // Xverse — needs BOTH StacksProvider and BitcoinProvider
  // @stacks/connect resolves provider via: window.XverseProviders.BitcoinProvider
  // Zest's useXverse checks: window.XverseProviders.StacksProvider.getProductInfo()
  Object.defineProperty(window, 'XverseProviders', {
    value: {
      StacksProvider: mockProvider,
      BitcoinProvider: mockProvider,
    },
    writable: false,
    configurable: true,
  });

  // WBIP provider registry for @stacks/connect v8+ (expects array, not Map)
  if (!window.wbip_providers) {
    window.wbip_providers = [];
  }
  window.wbip_providers.push({
    id: 'LeatherProvider',
    name: 'Playstacks Mock (Leather)',
    icon: '',
    webUrl: '',
  });
  window.wbip_providers.push({
    id: 'XverseProviders.BitcoinProvider',
    name: 'Playstacks Mock (Xverse)',
    icon: '',
    webUrl: '',
  });

  // Dispatch events that dApps listen for to detect wallet availability
  window.dispatchEvent(new CustomEvent('leather:ready'));
  window.dispatchEvent(new CustomEvent('hiro:ready'));
  window.dispatchEvent(new CustomEvent('stacksprovider:ready'));

  console.log('[Playstacks] Mock wallet provider injected — address:', WALLET_ADDRESS);
})();
`;
}
