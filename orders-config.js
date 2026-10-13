// TODO: Add the custom domain here when it is connected.
const PRODUCTION_HOSTS = [];
const OPEN_ORDER_HOSTS = ['taplocal-phi.vercel.app', ...PRODUCTION_HOSTS];
window.TAPLOCAL_ORDERS_OPEN = false;
try {
  window.TAPLOCAL_ORDERS_OPEN = OPEN_ORDER_HOSTS.includes(window.location.hostname);
} catch {
  // Keep orders closed if the hostname cannot be read.
}
