const ORDER_PRODUCTS = {
  'individual-google': { name: 'Individual · 1 placa Google', price: 'R$ 99,90', google: 1, instagram: 0 },
  'individual-instagram': { name: 'Individual · 1 placa Instagram', price: 'R$ 99,90', google: 0, instagram: 1 },
  duo: { name: 'Duo TapLocal · 1 Google + 1 Instagram', price: 'R$ 179,90', google: 1, instagram: 1 },
  kit: { name: 'Kit Negócio · 4 placas à escolha', price: 'R$ 299,90', google: 0, instagram: 0 }
};

(async () => {
  try { if (!await requireCustomerSession()) return; }
  catch { window.location.replace('/entrar/?next=/pedido/'); return; }
  document.body.style.visibility = 'visible';
  if (window.TAPLOCAL_ORDERS_OPEN !== true) return;
  await window.loadTaplocalStock?.();
  document.querySelector('#orders-closed').hidden = true;
  document.querySelector('#orders-content').hidden = false;
  const form = document.querySelector('#order-form');
  const submit = document.querySelector('#order-submit');
  const status = document.querySelector('#order-errors');
  const requested = new URLSearchParams(window.location.search).get('produto');
  let productKey = Object.hasOwn(ORDER_PRODUCTS, requested) ? requested : '';
  const kit = { google: 0, instagram: 0 };
  const cap = type => Math.min(4, window.TAPLOCAL_STOCK[type] ?? 4);
  const orderId = crypto.randomUUID();
  let submitted = false;
  const quantities = () => productKey === 'kit' ? kit : ORDER_PRODUCTS[productKey] || { google: 0, instagram: 0 };
  const quantityText = () => `${quantities().google} Google, ${quantities().instagram} Instagram`;
  const value = id => document.getElementById(id).value.trim();
  const digits = text => text.replace(/\D/g, '');
  const required = (id, message) => value(id) ? '' : message;
  const rules = {
    company: () => quantities().google ? required('company', 'Informe o nome da empresa como aparece no Google.') : '',
    locality: () => required('locality', 'Informe a cidade e o bairro da empresa.'),
    instagram: () => !quantities().instagram || /^[A-Za-z0-9._]{1,30}$/.test(value('instagram').replace(/^@/, '')) ? '' : 'Use só letras, números, pontos e underscores (até 30 caracteres).',
    name: () => value('name').split(/\s+/).filter(Boolean).length >= 2 ? '' : 'Informe seu nome completo.',
    phone: () => /^\d{10,11}$/.test(digits(value('phone'))) ? '' : 'Informe um WhatsApp válido com DDD.',
    cep: () => /^\d{8}$/.test(digits(value('cep'))) ? '' : 'Informe um CEP com 8 números.',
    street: () => required('street', 'Informe a rua.'),
    number: () => required('number', 'Informe o número.'),
    district: () => required('district', 'Informe o bairro.'),
    city: () => required('city', 'Informe a cidade.'),
    state: () => required('state', 'Escolha o estado.'),
    consent: () => document.querySelector('#consent').checked ? '' : 'Você precisa concordar para enviar o pedido.'
  };
  function validate(id) {
    const message = rules[id]();
    const field = document.getElementById(id);
    const error = document.getElementById(`${id}-error`);
    field.setAttribute('aria-invalid', String(Boolean(message)));
    error.textContent = message;
    error.hidden = !message;
    return !message;
  }
  function updateProduct() {
    const product = ORDER_PRODUCTS[productKey];
    const counts = quantities();
    document.querySelector('#summary-product').textContent = product?.name || 'Escolha o produto';
    document.querySelector('#summary-price').textContent = product?.price || '—';
    document.querySelector('#summary-quantities').textContent = product ? quantityText() : 'Selecione uma das opções ao lado.';
    document.querySelector('#kit-quantities').hidden = productKey !== 'kit';
    document.querySelector('#fixed-quantities').hidden = !product || productKey === 'kit';
    document.querySelector('#fixed-quantities').textContent = quantityText();
    ['google', 'instagram'].forEach(type => {
      const id = type === 'google' ? 'company' : 'instagram';
      const field = document.getElementById(id);
      field.closest('.login-field').hidden = !counts[type];
      field.disabled = !counts[type];
      field.required = Boolean(counts[type]);
      if (!counts[type] || field.getAttribute('aria-invalid') === 'true') validate(id);
      document.querySelector(`#${type}-count`).textContent = kit[type];
      document.querySelector(`[data-step="${type}"][data-delta="-1"]`).disabled = kit[type] === 0;
      document.querySelector(`[data-step="${type}"][data-delta="1"]`).disabled = kit[type] >= cap(type);
    });
    const total = kit.google + kit.instagram;
    document.querySelector('#kit-total').textContent = `${total}/4 placas`;
    document.querySelector('#kit-total').classList.toggle('order-total-invalid', total !== 4);
    submit.disabled = productKey === 'kit' && total !== 4;
    document.querySelector('#product-error').hidden = true;
    document.querySelectorAll('[name="product"]').forEach(radio => {
      radio.checked = radio.value === productKey;
      radio.setAttribute('aria-invalid', 'false');
    });
  }
  document.querySelectorAll('[name="product"]').forEach(radio => {
    const soldOut = window.taplocalSoldOut(radio.value);
    radio.disabled = soldOut;
    const label = radio.closest('label');
    label.style.opacity = soldOut ? '.5' : '';
    if (soldOut) label.querySelector('span').textContent = 'Esgotado';
  });
  if (productKey && window.taplocalSoldOut(productKey)) productKey = '';
  document.querySelector('#product-choices').hidden = Boolean(productKey);
  document.querySelectorAll('[name="product"]').forEach(radio => radio.addEventListener('change', () => {
    productKey = radio.value;
    updateProduct();
  }));
  document.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => {
    const type = button.dataset.step;
    kit[type] = Math.max(0, Math.min(cap(type), kit[type] + Number(button.dataset.delta)));
    updateProduct();
  }));
  Object.keys(rules).forEach(id => {
    const field = document.getElementById(id);
    field.addEventListener(field.type === 'checkbox' || field.tagName === 'SELECT' ? 'change' : 'input', () => {
      if (field.getAttribute('aria-invalid') === 'true') validate(id);
    });
    if (field.type !== 'checkbox') field.addEventListener('blur', () => validate(id));
  });
  function maskInput(id, maxDigits, format) {
    const input = document.getElementById(id);
    input.addEventListener('input', () => {
      const cursor = input.selectionStart ?? input.value.length;
      const before = digits(input.value.slice(0, cursor)).length;
      const raw = digits(input.value).slice(0, maxDigits);
      input.value = format(raw);
      let next = input.value.length;
      if (cursor < input.value.length) {
        let count = 0;
        next = 0;
        while (next < input.value.length && count < before) {
          if (/\d/.test(input.value[next])) count++;
          next++;
        }
      }
      input.setSelectionRange(next, next);
      if (input.getAttribute('aria-invalid') === 'true') validate(id);
    });
  }
  maskInput('cep', 8, raw => raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw);
  maskInput('phone', 11, raw => {
    if (!raw) return '';
    if (raw.length <= 2) return `(${raw}`;
    const local = raw.slice(2);
    const split = local.length > 8 ? 5 : 4;
    return `(${raw.slice(0, 2)}) ${local.slice(0, split)}${local.length > split ? '-' + local.slice(split) : ''}`;
  });
  document.querySelector('#observation').addEventListener('input', event => {
    document.querySelector('#observation-counter').textContent = `${event.target.value.length}/120`;
  });
  function buildMessage() {
    const counts = quantities();
    const clean = text => text.replace(/[*_~`]/g, '').replace(/\s*\r?\n\s*/g, ' ').trim();
    const field = id => clean(value(id));
    const complement = field('complement');
    const observation = field('observation');
    const blocks = ['*NOVO PEDIDO TAPLOCAL*', `*PRODUTO*\n${clean(ORDER_PRODUCTS[productKey].name)}`];
    const plates = [];
    if (counts.google > 0) plates.push(`Google: ${counts.google}`);
    if (counts.instagram > 0) plates.push(`Instagram: ${counts.instagram}`);
    if (plates.length) blocks.push('*PLACAS*\n' + plates.join('\n'));
    const company = [];
    if (counts.google > 0) company.push(`Nome no Google: ${field('company')}`);
    company.push(`Cidade e bairro: ${field('locality')}`);
    if (counts.instagram > 0) company.push(`Instagram: @${field('instagram').replace(/^@+/, '')}`);
    if (company.length) blocks.push('*EMPRESA*\n' + company.join('\n'));
    blocks.push(`*CLIENTE*\nNome: ${field('name')}\nWhatsApp: ${field('phone')}`);
    blocks.push(`*ENTREGA*\n${field('street')}, ${field('number')}${complement ? ', ' + complement : ''} - ${field('district')}\n${field('city')}/${field('state')} · CEP ${field('cep')}`);
    if (observation) blocks.push('*OBSERVAÇÃO*\n' + observation);
    blocks.push('*FRETE*\nA combinar');
    return blocks.join('\n\n');
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled || submitted) return;
    const invalid = Object.keys(rules).filter(id => !validate(id));
    if (!productKey) {
      const radios = [...document.querySelectorAll('[name="product"]')];
      radios.forEach(radio => radio.setAttribute('aria-invalid', 'true'));
      document.querySelector('#product-error').hidden = false;
      invalid.unshift('product-google');
    }
    if (invalid.length) {
      status.textContent = 'Confira os campos indicados para enviar o pedido.';
      status.hidden = false;
      document.getElementById(invalid[0]).focus();
      return;
    }
    status.hidden = true;
    submit.disabled = true;
    form.querySelectorAll('input,select,textarea,button').forEach(control => control.disabled = true);
    submit.setAttribute('aria-busy', 'true');
    submit.querySelector('.login-arrow').hidden = true;
    submit.querySelector('.login-spinner').hidden = false;
    // Save all rows atomically before opening the unchanged WhatsApp message.
    try {
      const counts = quantities();
      await journeyRequest(client => client.rpc('create_customer_order', {payload: {
        id: orderId, product: productKey, quantity: {google: counts.google, instagram: counts.instagram},
        full_name: value('name'), whatsapp: value('phone'), company_name: counts.google ? value('company') : '',
        locality: value('locality'), instagram_handle: counts.instagram ? value('instagram').replace(/^@/, '').toLowerCase() : '',
        observation: value('observation'), cep: value('cep'), street: value('street'), number: value('number'),
        complement: value('complement'), district: value('district'), city: value('city'), state: value('state')
      }}));
      submitted = true;
    } catch {
      status.textContent = 'Não foi possível salvar o pedido. Tente novamente. O WhatsApp não foi aberto.';
      status.hidden = false;
      form.querySelectorAll('input,select,textarea,button').forEach(control => control.disabled = false);
      updateProduct();
      submit.setAttribute('aria-busy', 'false');
      submit.querySelector('.login-arrow').hidden = false;
      submit.querySelector('.login-spinner').hidden = true;
      return;
    }
    // A real anchor opens WhatsApp with noopener after the transaction succeeds.
    const link = document.createElement('a');
    link.href = 'https://wa.me/5511997112511?text=' + encodeURIComponent(buildMessage());
    link.target = '_blank';
    link.rel = 'noopener';
    document.body.append(link);
    try {
      link.click();
      const fallback = document.createElement('a');
      fallback.href = link.href;
      fallback.target = '_blank';
      fallback.rel = 'noopener';
      fallback.className = 'button secondary customer-action';
      fallback.textContent = 'Continue seu pedido no WhatsApp';
      document.querySelector('.order-summary').append(fallback);
    }
    finally {
      link.remove();
      status.textContent = 'Seu pedido foi salvo. Continue a conversa no WhatsApp.';
      status.hidden = false;
      submit.disabled = true;
      submit.setAttribute('aria-busy', 'false');
      submit.querySelector('.login-arrow').hidden = false;
      submit.querySelector('.login-spinner').hidden = true;
    }
  });
  updateProduct();
})();
