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
