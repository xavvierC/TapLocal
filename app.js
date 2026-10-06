const menuTrigger = document.querySelector('.menu-trigger');
const mobileNav = document.querySelector('#mobile-nav');
function setMenuOpen(isOpen, restoreFocus = false) {
  mobileNav.hidden = !isOpen;
  menuTrigger.setAttribute('aria-expanded', String(isOpen));
  menuTrigger.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
  if (restoreFocus) menuTrigger.focus();
}
menuTrigger.addEventListener('click', () => setMenuOpen(mobileNav.hidden));
mobileNav.addEventListener('click', event => {
  if (event.target.closest('a')) setMenuOpen(false);
});
document.addEventListener('click', event => {
  if (!event.target.closest('.header')) setMenuOpen(false);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !mobileNav.hidden) setMenuOpen(false, true);
});
matchMedia('(min-width: 1100px)').addEventListener('change', event => {
  if (event.matches) setMenuOpen(false);
});
let activeProduct = 'google';
function showProduct(product) {
  if (product === activeProduct) return;
  plaqueMotion.swap();
  activeProduct = product;
  document.querySelectorAll('[data-product]').forEach(plaque => {
    const isFront = plaque.dataset.product === activeProduct;
    plaque.classList.toggle('is-front', isFront);
    plaque.classList.toggle('is-back', !isFront);
  });
  document.querySelectorAll('[data-select-product]').forEach(dot => {
    const selected = dot.dataset.selectProduct === activeProduct;
    dot.classList.toggle('selected', selected);
    dot.setAttribute('aria-pressed', String(selected));
  });
  document.querySelector('#product-status').textContent = `Produto em destaque: ${activeProduct === 'google' ? 'Google' : 'Instagram'}.`;
}
function toggleProduct() {
  showProduct(activeProduct === 'google' ? 'instagram' : 'google');
}
document.querySelectorAll('[data-select-product]').forEach(button => {
  button.addEventListener('click', () => showProduct(button.dataset.selectProduct));
});
document.querySelectorAll('.product-control').forEach(button => button.addEventListener('click', toggleProduct));
document.querySelector('.product-area').addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    toggleProduct();
  }
});

// Decorative motion is independent of the carousel's activeProduct and slot transforms.
const plaqueMotion = (() => {
  const stage = document.querySelector('.product-stage');
  const plaques = [...stage.querySelectorAll('.plaque')];
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false, over = false, swapping = false, frame = 0, swapTimer;
  let current = [0, 0, 50, 50, 0, 0, 50, 50], target = [...current];
  const allowed = () => visible && !document.hidden && !reduced.matches;
  function paint() {
    plaques.forEach((plaque, i) => {
      const offset = i * 4;
      const values = { 'tilt-x': `${-current[offset + 1] * 5.5}deg`, 'tilt-y': `${current[offset] * 7.5}deg`,
        'depth-x': `${current[offset] * 8}px`, 'depth-y': `${current[offset + 1] * 6}px`,
        mx: `${current[offset + 2]}%`, my: `${current[offset + 3]}%` };
      Object.entries(values).forEach(([key, value]) => plaque.style.setProperty(`--${key}`, value));
    });
  }
  function tick() {
    frame = 0;
    let unsettled = false;
    current = current.map((value, i) => {
      if (Math.abs(target[i] - value) < .001) return target[i];
      unsettled = true;
      return value + (target[i] - value) * .10;
    });
    paint();
    if (unsettled && allowed()) frame = requestAnimationFrame(tick);
  }
  function wake() { if (!frame && allowed()) frame = requestAnimationFrame(tick); }
  function sync() {
    const active = allowed();
    if (!active || !fine.matches) {
      over = false;
      cancelAnimationFrame(frame); frame = 0;
      current = [0, 0, 50, 50, 0, 0, 50, 50]; target = [...current]; paint();
    }
    stage.classList.toggle('is-interacting', active && over && !swapping);
    stage.classList.toggle('motion-running', active && !over && !swapping);
  }
  function leave() {
    over = false; target = [0, 0, 50, 50, 0, 0, 50, 50]; sync(); wake();
  }
  stage.addEventListener('pointermove', event => {
    if (!allowed() || !fine.matches || swapping || event.pointerType === 'touch' || event.target.closest('.product-controls')) return;
    const bounds = stage.getBoundingClientRect();
    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
    const x = clamp((event.clientX - bounds.left) / bounds.width * 2 - 1, -1, 1);
    const y = clamp((event.clientY - bounds.top) / bounds.height * 2 - 1, -1, 1);
    target = plaques.flatMap(plaque => {
      const box = plaque.getBoundingClientRect();
      const depth = plaque.classList.contains('is-front') ? 1 : .55;
      return [x * depth, y * depth, clamp((event.clientX - box.left) / box.width * 100, 0, 100), clamp((event.clientY - box.top) / box.height * 100, 0, 100)];
    });
    over = true; sync(); wake();
  }, { passive: true });
  stage.addEventListener('pointerleave', leave);
  stage.querySelector('.product-controls').addEventListener('pointerenter', leave);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: 0 }).observe(stage);
  document.addEventListener('visibilitychange', sync);
  fine.addEventListener('change', sync);
  reduced.addEventListener('change', sync);
  return { swap() {
    clearTimeout(swapTimer); swapping = true; stage.classList.add('is-swapping'); leave();
    swapTimer = setTimeout(() => { swapping = false; stage.classList.remove('is-swapping'); sync(); }, reduced.matches ? 0 : 580);
  } };
})();
