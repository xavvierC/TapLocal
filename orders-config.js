// TODO: Add the custom domain here when it is connected.
const PRODUCTION_HOSTS = ['taplocal-phi.vercel.app'];
window.TAPLOCAL_ORDERS_OPEN = false;
try {
  window.TAPLOCAL_ORDERS_OPEN = !PRODUCTION_HOSTS.includes(window.location.hostname);
} catch {
  // Keep orders closed if the hostname cannot be read.
}
