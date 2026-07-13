// Production build: the API is served same-origin behind the host/proxy.
// The proxy must forward /hubs with WebSocket upgrade for chat to work.
export const environment = {
  apiBaseUrl: '/api',
  hubBaseUrl: '/hubs',
};
