// Empty list: orders are open on every host. Add a domain here to close orders on it.
const PRODUCTION_HOSTS = [];
window.TAPLOCAL_ORDERS_OPEN = true;
try {
  window.TAPLOCAL_ORDERS_OPEN = !PRODUCTION_HOSTS.includes(window.location.hostname);
} catch {
  // Keep orders closed if the hostname cannot be read.
}

// Stock comes from the public view stock_public (only id and stock_count).
// Unknown stock (null) never blocks a sale on the site; the database still checks on payment.
window.TAPLOCAL_STOCK = { google: null, instagram: null };
window.loadTaplocalStock = async () => {
  try {
    const { data, error } = await window.taplocalSupabase.from('stock_public').select('id,stock_count');
    if (!error && data) data.forEach(row => { window.TAPLOCAL_STOCK[row.id] = row.stock_count; });
  } catch {
    // Keep stock unknown.
  }
  return window.TAPLOCAL_STOCK;
};
window.taplocalSoldOut = key => {
  const { google: g, instagram: i } = window.TAPLOCAL_STOCK;
  if (key === 'individual-google') return g !== null && g < 1;
  if (key === 'individual-instagram') return i !== null && i < 1;
  if (key === 'duo') return (g !== null && g < 1) || (i !== null && i < 1);
  if (key === 'kit') return g !== null && i !== null && g + i < 4;
  return false;
};
