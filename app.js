// ===== CONFIGURACIÓN =====
// Datos de la tienda: los inserta scripts/build.mjs desde tienda.config.json y data/ajustes.json
const TIENDA = %%TIENDA_JSON%%;
const WHATSAPP_NUMBER = TIENDA.whatsapp;

const ENTREGAS = {
  retiro: 'Entrega presencial en Rancagua',
  machali: 'Entrega presencial en Machalí',
  region: 'Envío a todo Chile',
};

// Productos y categorías se editan desde el panel /admin (data/productos, data/categorias)
// y se publican juntos en data/catalogo.json (lo genera scripts/build.mjs)
let PRODUCTS = [];
let FILTERS = [['todos', 'Todos']];

const ENCARGO = { id: 'encargo', name: 'Otro modelo (encargo)', price: 0 };

const SORTS = {
  destacados: null,
  'precio-asc': (a, b) => a.price - b.price,
  'precio-desc': (a, b) => b.price - a.price,
};

// ===== UTILIDADES =====
const clp = (n) => '$' + n.toLocaleString('es-CL');
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const findProduct = (id) => (id === ENCARGO.id ? ENCARGO : PRODUCTS.find((p) => p.id === id));
const priceText = (p) => (p.price > 0 ? clp(p.price) : 'Consultar precio');
// Se usa api.whatsapp.com y no wa.me: la redirección de wa.me rompe los emojis (llegan como �)
const waUrl = (text) =>
  `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}${text ? '&text=' + encodeURIComponent(text) : ''}`;

// ===== CATÁLOGO =====
const grid = $('#productGrid');
const filters = $('#filters');
let currentCat = 'todos';

function renderFilters(active) {
  const count = (k) => (k === 'todos' ? PRODUCTS.length : PRODUCTS.filter((p) => p.tags.includes(k)).length);
  filters.innerHTML = FILTERS
    .filter(([k]) => count(k) > 0) // oculta categorías vacías
    .map(([k, label]) => `<button class="tab ${k === active ? 'is-active' : ''}" role="tab" aria-selected="${k === active}" data-cat="${esc(k)}">${esc(label)}<span class="tab__n">${count(k)}</span></button>`)
    .join('');
}

function renderProducts(cat = currentCat) {
  currentCat = cat;
  let list = cat === 'todos' ? PRODUCTS : PRODUCTS.filter((p) => p.tags.includes(cat));
  const sort = SORTS[$('#sort').value];
  if (sort) list = [...list].sort(sort);
  $('#count').innerHTML = `Mostrando <strong>${list.length}</strong> ${list.length === 1 ? 'modelo' : 'modelos'}`;
  // misma tarjeta que card() en scripts/build.mjs
  grid.innerHTML = list.map((p) => `
    <article class="card${p.agotado ? ' is-soldout' : ''}">
      <div class="card__img">
        ${p.agotado ? '<span class="badge badge--soldout">Agotado</span>' : p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ''}
        <img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy">
      </div>
      <div class="card__body">
        <h3>${esc(p.name)}</h3>
        ${p.desc ? `<p class="card__desc">${esc(p.desc)}</p>` : ''}
        ${p.items.length ? `<ul>${p.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
        <div class="card__foot">
          <span class="price${p.price > 0 ? '' : ' price--ask'}">${priceText(p)}</span>
          ${p.agotado
            ? `<a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="${esc(waUrl(`Hola! ¿Tienen stock de ${p.name}?`))}">Consultar stock</a>`
            : `<button class="btn btn--primary btn--sm" data-order="${esc(p.id)}">Pedir</button>`}
        </div>
      </div>
    </article>`).join('');
}

filters.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-cat]');
  if (!btn) return;
  renderFilters(btn.dataset.cat);
  renderProducts(btn.dataset.cat);
});
$('#sort').addEventListener('change', () => renderProducts());

// ===== FORMULARIO / MODAL =====
const modal = $('#orderModal');
const form = $('#orderForm');
const fModelo = $('#fModelo');
const fOtroWrap = $('#fOtroWrap');
const fOtro = $('#fOtro');
const fTalla = $('#fTalla');
const fCliente = $('#fCliente');
const fComuna = $('#fComuna');
const deliveryRow = document.querySelector('[data-delivery]');
let lastFocus = null;

function renderModelOptions() {
  fModelo.innerHTML = PRODUCTS.filter((p) => !p.agotado)
    .map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('') +
    `<option value="${ENCARGO.id}">${ENCARGO.name}</option>`;
}

const entrega = () => form.querySelector('input[name=entrega]:checked').value;

function readOrder() {
  const product = findProduct(fModelo.value) || ENCARGO;
  return {
    product,
    otro: fOtro.value.trim(),
    talla: fTalla.value.trim(),
    cliente: fCliente.value.trim(),
    entrega: entrega(),
    comuna: fComuna.value.trim(),
  };
}

function buildMessage(o) {
  const modelo = o.product.id === ENCARGO.id ? `Encargo: ${o.otro || '(por definir)'}` : o.product.name;
  const lines = [
    `🔥 *Pedido ${TIENDA.nombre}*`,
    '',
    `*Modelo:* ${modelo}`,
    `*Talla:* ${o.talla || '(por definir)'}`,
    `*Entrega:* ${ENTREGAS[o.entrega]}${o.entrega === 'region' && o.comuna ? ` (${o.comuna})` : ''}`,
    `*Nombre:* ${o.cliente || '(por definir)'}`,
    '',
    '¿Tienen stock y cuál es el valor? 🙌',
  ];
  return lines.join('\n');
}

function refresh() {
  const o = readOrder();
  fOtroWrap.hidden = o.product.id !== ENCARGO.id;
  deliveryRow.hidden = o.entrega !== 'region';
  $('#msgPreview').textContent = buildMessage(o);
}

function openModal(id) {
  lastFocus = document.activeElement;
  renderModelOptions();
  if (id && findProduct(id)) fModelo.value = id;
  $('#formError').hidden = true;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  refresh();
  fTalla.focus();
}

function closeModal() {
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  if (lastFocus) lastFocus.focus();
}

document.addEventListener('click', (e) => {
  const opener = e.target.closest('[data-order]');
  if (opener) { openModal(opener.dataset.order); return; }
  if (e.target.closest('[data-close]')) closeModal();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal(); });
form.addEventListener('input', refresh);
form.addEventListener('change', refresh);

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const o = readOrder();
  const missing = [];
  if (o.product.id === ENCARGO.id && !o.otro) missing.push('el modelo que buscas');
  if (!o.talla) missing.push('tu talla');
  if (!o.cliente) missing.push('tu nombre');
  if (o.entrega === 'region' && !o.comuna) missing.push('la comuna o ciudad de envío');
  if (missing.length) {
    const err = $('#formError');
    err.textContent = 'Falta completar: ' + missing.join(', ') + '.';
    err.hidden = false;
    return;
  }
  window.open(waUrl(buildMessage(o)), '_blank', 'noopener');
  form.reset();
  closeModal();
});

['#footerWa', '#contactWa', '#contactWaBtn', '#floatWa'].forEach((s) => { const el = $(s); if (el) el.href = waUrl('Hola! Quiero consultar por un par 🔥'); });

// ===== FLYER EN VENTANA EMERGENTE (una vez por visita) =====
const promo = $('#promoModal');
if (promo) {
  const key = 'flyer-visto:' + promo.dataset.flyer; // un flyer nuevo se vuelve a mostrar
  const seen = () => { try { return sessionStorage.getItem(key); } catch { return null; } };
  const closePromo = () => {
    promo.classList.remove('is-open');
    promo.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };
  promo.addEventListener('click', (e) => { if (e.target.closest('[data-promo-close]')) closePromo(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && promo.classList.contains('is-open')) closePromo(); });
  if (!seen()) {
    setTimeout(() => {
      if (modal.classList.contains('is-open')) return; // no interrumpir un pedido en curso
      try { sessionStorage.setItem(key, '1'); } catch {}
      promo.classList.add('is-open');
      promo.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      promo.querySelector('.modal__close').focus();
    }, 1500);
  }
}

// ===== VIDEOS DE ENTREGAS: solo se reproducen cuando están en pantalla =====
const reelVideos = document.querySelectorAll('.reel video');
if (reelVideos.length && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => entries.forEach(({ target, isIntersecting }) => {
    if (isIntersecting) target.play().catch(() => {});
    else target.pause();
  }), { threshold: 0.25 });
  reelVideos.forEach((v) => io.observe(v));
}

// ===== CARGA DEL CATÁLOGO =====
async function loadProducts() {
  try {
    const res = await fetch('data/catalogo.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const categorias = Array.isArray(data.categorias) ? data.categorias : [];

    // producto -> categorías a las que pertenece (la categoría es la que dice qué productos tiene)
    const tagsOf = {};
    categorias.forEach((c) => (c.productos || []).forEach((id) => (tagsOf[id] = tagsOf[id] || []).push(c.id)));

    FILTERS = [['todos', 'Todos'], ...categorias.map((c) => [c.id, c.nombre])];
    PRODUCTS = (data.productos || []).map((p) => ({
      id: p.id,
      name: p.nombre,
      price: Number(p.precio) || 0,
      img: (p.foto || 'img/logo.jpg').replace(/^\//, ''),
      desc: p.descripcion || '',
      items: Array.isArray(p.incluye) ? p.incluye : [],
      tags: tagsOf[p.id] || [],
      badge: p.etiqueta || '',
      agotado: !!p.agotado,
    }));
  } catch (e) {
    console.error(e);
    if (!grid.children.length) grid.innerHTML = '<p class="muted">No se pudo cargar el catálogo. Intenta recargar la página.</p>';
    return; // conserva el HTML que ya escribió el build
  }
  // sin precios cargados, ordenar por precio no tiene sentido
  if (!PRODUCTS.some((p) => p.price > 0)) document.querySelector('.sort').hidden = true;
  renderFilters('todos');
  renderProducts('todos');
}

loadProducts();
