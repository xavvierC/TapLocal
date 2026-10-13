(() => {
  const individualLink = document.querySelector('[data-checkout="individualGoogle"]');
  const productLinks = [...document.querySelectorAll('.product-choice [data-checkout]')];
  const tabs = [...document.querySelectorAll('[data-individual]')];
  const art = [...document.querySelectorAll('[data-product-art]')];
  const productNames = {
    'individual-google': 'Individual · 1 placa Google',
    'individual-instagram': 'Individual · 1 placa Instagram',
    duo: 'Duo TapLocal · 1 Google + 1 Instagram',
    kit: 'Kit Negócio · 4 placas à escolha'
  };

  function productKey(link) {
    if (link.dataset.checkout === 'individualInstagram') return 'individual-instagram';
    if (link.dataset.checkout === 'individualGoogle') return 'individual-google';
    return link.dataset.checkout;
  }

  function syncLink(link) {
    const key = productKey(link);
    const soldOut = typeof window.taplocalSoldOut === 'function' && window.taplocalSoldOut(key) === true;
    const open = window.TAPLOCAL_ORDERS_OPEN === true && !soldOut;
    if (open) {
      link.href = '/pedido/?produto=' + encodeURIComponent(key);
      link.removeAttribute('aria-disabled');
      link.removeAttribute('tabindex');
      link.textContent = 'Quero esta placa →';
      link.setAttribute('aria-label', 'Pedir ' + (productNames[key] || 'esta placa'));
    } else {
      link.removeAttribute('href');
      link.setAttribute('aria-disabled', 'true');
      link.tabIndex = -1;
      link.textContent = soldOut ? 'Esgotado' : 'Em breve';
      link.setAttribute('aria-label', (soldOut ? 'Esgotado — ' : 'Em breve — ') + (productNames[key] || 'esta placa'));
    }
  }

  function selectIndividual(value) {
    const selected = value === 'instagram' ? 'instagram' : 'google';
    tabs.forEach(tab => {
      const active = tab.dataset.individual === selected;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    const destination = document.querySelector('.product-destination');
    if (destination) destination.dataset.second = String(selected === 'instagram');
    art.forEach(image => image.classList.toggle('is-selected', image.dataset.productArt === selected));
    if (individualLink) {
      individualLink.dataset.checkout = selected === 'instagram' ? 'individualInstagram' : 'individualGoogle';
      syncLink(individualLink);
    }
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => selectIndividual(tab.dataset.individual));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      let next = tabs.indexOf(tab);
      if (event.key === 'ArrowLeft') next = (next - 1 + tabs.length) % tabs.length;
      if (event.key === 'ArrowRight') next = (next + 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      tabs[next]?.focus();
      selectIndividual(tabs[next]?.dataset.individual);
    });
  });

  productLinks.forEach(link => {
    link.addEventListener('click', event => {
      syncLink(link);
      if (link.getAttribute('aria-disabled') === 'true') event.preventDefault();
    });
  });

  selectIndividual('google');
  productLinks.forEach(syncLink);
  if (typeof window.loadTaplocalStock === 'function') {
    window.loadTaplocalStock().then(() => productLinks.forEach(syncLink)).catch(() => productLinks.forEach(syncLink));
  }
})();
