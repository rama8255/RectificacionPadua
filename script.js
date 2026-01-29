import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ovrfmnzacrxgfhumebwv.supabase.co'
const SUPABASE_KEY = 'sb_publishable_AzHzLucADvr77dDabbiRzw_K_wJZkov'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// STORAGE keys
const STORAGE_KEY = 'rp_articles_v4'; // con ids y precios
const MOTORS_KEY = 'rp_motors_v1';

// helper id generator
function generateId(prefix='id') { return prefix + '_' + Math.random().toString(36).slice(2,9); }

// Datos de ejemplo iniciales (con ids y precios)
let articles = [
  { id: 'art_A100', code: 'A100', name: 'Filtro aceite', measure: 'Pieza', qty: 12, price: 15.50, type: 'Motor', brand: 'MarcaX', model: 'M1' },
  { id: 'art_B200', code: 'B200', name: 'Biela', measure: 'Unidad', qty: 5, price: 120.00, type: 'Motor', brand: 'MarcaY', model: 'M2' },
  { id: 'art_C300', code: 'C300', name: 'Cojinete', measure: 'Juego', qty: 8, price: 45.00, type: 'Motor', brand: 'MarcaX', model: 'M1' },
];

// motors structure
let motors = {};

// Delete candidate (article id)
let articleIdToDelete = null;

// Save/load
async function loadArticlesFromSupabase() {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error cargando artículos', error)
    alert('No se pudieron cargar los artículos')
    return
  }

  articles = data || []
}

async function insertArticleSupabase(article) {
  const { data, error } = await supabase
    .from('articles')
    .insert([article])
    .select()

  if (error) {
    console.error('ERROR SUPABASE:', error)
    alert(error.message)
    return false
  }

  return true
}

async function updateArticleQty(id, qty) {
  const { error } = await supabase
    .from('articles')
    .update({ qty })
    .eq('id', id)

  if (error) console.error('Error actualizando cantidad', error)
}
// Elementos DOM
const els = {
  addArticleForm: document.querySelector('#addArticleForm'),

  addCode: document.querySelector('#addCode'),
  addName: document.querySelector('#addName'),
  addMeasure: document.querySelector('#addMeasure'),
  addQty: document.querySelector('#addQty'),
  addPrice: document.querySelector('#addPrice'),
  addType: document.querySelector('#addType'),
  addBrand: document.querySelector('#addBrand'),
  addModel: document.querySelector('#addModel')
};;

function cacheEls() {
  els.searchCode = document.getElementById('searchCode');
  els.filterType = document.getElementById('filterType');
  els.filterBrand = document.getElementById('filterBrand');
  els.filterModel = document.getElementById('filterModel');
  els.tableBody = document.querySelector('#articlesTable tbody');

  els.addArticleForm = document.getElementById('addArticleForm');
  els.addToMotorForm = document.getElementById('addToMotorForm');

  els.searchMotor = document.getElementById('searchMotor');
  els.motorsList = document.getElementById('motorsList');

  els.modalConfirmDelete = document.getElementById('modalConfirmDelete');
  els.confirmDeleteText = document.getElementById('confirmDeleteText');
  els.confirmDeleteBtn = document.getElementById('confirmDelete');
  els.cancelDeleteBtn = document.getElementById('cancelDelete');

  els.clearFiltersBtn = document.getElementById('clearFiltersBtn');
}

// Utils
function escapeHtml(s) { return String(s).replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escapeId(s) { return String(s).replace(/[^a-zA-Z0-9_-]/g, '_'); }
function uniqueValues(field) {
  const s = new Set();
  articles.forEach(a => { if (a[field]) s.add(a[field]); });
  return Array.from(s).sort();
}

// Populate filter selects & datalists
function populateFilterOptionsAndDatalists() {
  const types = uniqueValues('type');
  const brands = uniqueValues('brand');
  const models = uniqueValues('model');
  const names = uniqueValues('name');

  fillSelect(els.filterType, types, 'Todos');
  fillSelect(els.filterBrand, brands, 'Todas');
  fillSelect(els.filterModel, models, 'Todos');
  fillDatalist('dlNames', names);
  fillDatalist('dlTypes', types);
  fillDatalist('dlBrands', brands);
  fillDatalist('dlModels', models); // datalist para modelos
}
function fillSelect(selectEl, values, firstLabel) {
  if (!selectEl) return;
  const current = selectEl.value || '';
  selectEl.innerHTML = '';
  const opt0 = document.createElement('option'); opt0.value=''; opt0.textContent = firstLabel; selectEl.appendChild(opt0);
  values.forEach(v => { const o = document.createElement('option'); o.value=v; o.textContent=v; selectEl.appendChild(o); });
  if (current) selectEl.value = current;
}
function fillDatalist(dlId, values) {
  const dl = document.getElementById(dlId);
  if (!dl) return;
  dl.innerHTML = '';
  values.forEach(v => {
    const o = document.createElement('option'); o.value = v;
    dl.appendChild(o);
  });
}

function filterArticles() {
  const codeQ = (els.searchCode?.value || '').trim().toLowerCase();
  const fType = els.filterType?.value;
  const fBrand = els.filterBrand?.value;
  const fModel = els.filterModel?.value;

  return articles.filter(a => {
    if (codeQ && !a.code.toLowerCase().includes(codeQ)) return false;
    if (fType && a.type !== fType) return false;
    if (fBrand && a.brand !== fBrand) return false;
    if (fModel && a.model !== fModel) return false;
    return true;
  });
}

// Render inventory table (ahora con columna precio)
function renderTable() {
  const list = filterArticles();
  els.tableBody.innerHTML = '';
  if (list.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6" class="text-center p-3">No se encontraron artículos</td>`;
    els.tableBody.appendChild(tr);
    return;
  }

  list.forEach(a => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(a.code)}</td>
      <td>${escapeHtml(a.name)}</td>
      <td>${escapeHtml(a.measure || '')}</td>
      <td>${formatMoney(a.price)}</td>
      <td class="fw-bold" id="qty-${escapeId(a.id)}">${a.qty}</td>
      <td class="text-center">
        <div class="d-flex justify-content-center align-items-center gap-2">
          <div class="btn-group" role="group" aria-label="cantidad">
            <button class="btn btn-outline-danger btn-sm action-btn" data-action="decrease" data-id="${a.id}">−</button>
            <button class="btn btn-outline-success btn-sm action-btn" data-action="increase" data-id="${a.id}">+</button>
          </div>
          <button class="btn btn-light btn-trash" title="Eliminar" data-id="${a.id}">🗑️</button>
        </div>
      </td>
    `;
    els.tableBody.appendChild(tr);
  });

  // handlers
  els.tableBody.querySelectorAll('button.action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      if (action === 'increase') changeQtyById(id, 1);
      if (action === 'decrease') changeQtyById(id, -1);
    });
  });

  els.tableBody.querySelectorAll('button.btn-trash').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      promptDeleteById(id);
    });
  });
}

// Change qty by article id
async function changeQtyById(id, delta) {
  const idx = articles.findIndex(x => x.id === id);
  if (idx === -1) return;

  const newQty = Math.max(0, (Number(articles[idx].qty) || 0) + delta);

  // actualizar en Supabase
  const { error } = await supabase
    .from('articles')
    .update({ qty: newQty })
    .eq('id', id);

  if (error) {
    console.error('Error actualizando stock', error);
    alert('No se pudo actualizar el stock');
    return;
  }

  // actualizar estado local solo si Supabase OK
  articles[idx].qty = newQty;

  const el = document.getElementById('qty-' + escapeId(id));
  if (el) el.textContent = newQty;
}

// Delete flow by id
function promptDeleteById(id) {
  articleIdToDelete = id;
  const art = articles.find(a => a.id === id);
  const text = art ? `¿Eliminar "${art.name}" (código ${art.code})? Esta acción también quitará el ítem de cualquier motor.` : '¿Eliminar este artículo?';
  els.confirmDeleteText.textContent = text;
  const modal = new bootstrap.Modal(els.modalConfirmDelete);
  modal.show();
}
function confirmDeleteNow() {
  if (!articleIdToDelete) return;
  // remove from articles
  articles = articles.filter(a => a.id !== articleIdToDelete);
  // remove from motors items where sourceArticleId matches
  Object.keys(motors).forEach(mid => {
    motors[mid].items = motors[mid].items.filter(it => it.sourceArticleId !== articleIdToDelete);
  });
  saveToStorage();
  populateFilterOptionsAndDatalists();
  renderTable();
  renderMotorsList(els.searchMotor?.value?.trim() || '');
  articleIdToDelete = null;
}

// Add article modal (FAB) - ahora con validaciones obligatorias
async function setupAddArticle() {
  const modalEl = document.getElementById('modalAddArticle');
  const modal = new bootstrap.Modal(modalEl);
  const fab = document.getElementById('fabAddArticle');
  if (fab) fab.addEventListener('click', () => {
    document.getElementById('addArticleForm').reset();
    modal.show();
  });

  const els = {
  addArticleForm: document.querySelector('#addArticleForm'),

  addCode: document.querySelector('#addCode'),
  addName: document.querySelector('#addName'),
  addMeasure: document.querySelector('#addMeasure'),
  addQty: document.querySelector('#addQty'),
  addPrice: document.querySelector('#addPrice'),
  addType: document.querySelector('#addType'),
  addBrand: document.querySelector('#addBrand'),
  addModel: document.querySelector('#addModel')
};
els.addArticleForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const article = {
    id: generateId('art'),
    code: els.addCode.value.trim(),
    name: els.addName.value.trim(),
    measure: els.addMeasure.value.trim(),
    qty: Number(els.addQty.value),
    price: Number(els.addPrice.value),
    type: els.addType.value.trim(),
    brand: els.addBrand.value.trim(),
    model: els.addModel.value.trim()
  };

  const ok = await insertArticleSupabase(article);

  if (!ok) {
    alert('Error al guardar en la base');
    return;
  }

  alert('Artículo guardado correctamente');
  els.addArticleForm.reset();
});

// Motors: helpers
function renderMotorsList(filterText='') {
  els.motorsList.innerHTML = '';
  const motorsArr = Object.values(motors).filter(m => !filterText || m.name.toLowerCase().includes(filterText.toLowerCase()));
  if (motorsArr.length === 0) {
    els.motorsList.innerHTML = `<div class="col-12"><div class="alert alert-info">No hay motores. Crea uno con "Nuevo motor".</div></div>`;
    return;
  }

  motorsArr.forEach(m => {
    const col = document.createElement('div'); col.className='col-md-6';
    const card = document.createElement('div'); card.className='card motor-card';
    card.innerHTML = `
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div><h5 class="card-title mb-0">${escapeHtml(m.name)}</h5><div class="text-muted-small">ID: ${m.id}</div></div>
          <div class="text-end">
            <div class="fw-bold">Total: <span id="motor-total-${m.id}">${formatMoney(calculateMotorTotal(m))}</span></div>
            <div class="text-muted-small">${m.items.length} ítems</div>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table table-sm mb-0">
            <thead><tr><th>Código</th><th>Nombre</th><th>Medida</th><th>Cant</th><th>Precio</th><th>Subtotal</th><th></th></tr></thead>
            <tbody id="motor-items-${m.id}"></tbody>
          </table>
        </div>

        <div class="mt-2 d-flex gap-2">
          <button class="btn btn-outline-secondary btn-sm" data-action="open" data-motor="${m.id}">Abrir</button>
          <button class="btn btn-outline-danger btn-sm" data-action="delete" data-motor="${m.id}">Eliminar</button>
        </div>
      </div>
    `;
    col.appendChild(card);
    els.motorsList.appendChild(col);

    renderMotorItems(m);
    const fab = document.createElement('button');
    fab.className = 'btn btn-primary motor-fab';
    fab.title = 'Agregar ítem';
    fab.innerText = '+';
    fab.addEventListener('click', () => openAddToMotorModal(m.id));
    card.appendChild(fab);

    card.querySelectorAll('button[data-action]').forEach(b => {
      b.addEventListener('click', ev => {
        const act = b.getAttribute('data-action');
        const mid = b.getAttribute('data-motor');
        if (act === 'open') openMotorDetail(mid);
        else if (act === 'delete') {
          if (confirm('Eliminar este motor y todos sus ítems?')) {
            delete motors[mid];
            saveToStorage();
            renderMotorsList(els.searchMotor?.value?.trim() || '');
          }
        }
      });
    });
  });
}

function renderMotorItems(motor) {
  const tbody = document.getElementById('motor-items-' + motor.id);
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!motor.items || motor.items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-muted-small">Sin ítems</td></tr>`;
    updateMotorTotal(motor.id);
    return;
  }
  motor.items.forEach((it, idx) => {
    const subtotal = (Number(it.qty)||0) * (Number(it.price)||0);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${it.code || ''}</td>
      <td>${escapeHtml(it.name)}</td>
      <td>${it.measure || ''}</td>
      <td>${it.qty}</td>
      <td>${formatMoney(it.price)}</td>
      <td>${formatMoney(subtotal)}</td>
      <td><div class="btn-group btn-group-sm"><button class="btn btn-outline-danger" data-action="remove" data-mid="${motor.id}" data-idx="${idx}">Eliminar</button></div></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('button[data-action="remove"]').forEach(b => {
    b.addEventListener('click', () => {
      const mid = b.getAttribute('data-mid');
      const idx = Number(b.getAttribute('data-idx'));
      motors[mid].items.splice(idx, 1);
      saveToStorage();
      renderMotorItems(motors[mid]);
      updateMotorTotal(mid);
    });
  });

  updateMotorTotal(motor.id);
}

function calculateMotorTotal(motor) {
  return (motor.items || []).reduce((s,it) => s + ((Number(it.qty)||0)*(Number(it.price)||0)), 0);
}
function updateMotorTotal(mid) {
  const el = document.getElementById('motor-total-' + mid);
  if (el && motors[mid]) el.textContent = formatMoney(calculateMotorTotal(motors[mid]));
}

// Create motor
function createNewMotor(name) {
  const id = generateId('motor');
  motors[id] = { id, name, items: [], created_at: new Date().toISOString() };
  saveToStorage();
  renderMotorsList(els.searchMotor?.value?.trim() || '');
  return id;
}

// Add to motor modal: uses select from articles (by id)
function openAddToMotorModal(motorId) {
  const modalEl = document.getElementById('modalAddToMotor');
  const modal = new bootstrap.Modal(modalEl);
  document.getElementById('addToMotorForm').reset();
  document.getElementById('currentMotorId').value = motorId;
  document.getElementById('isLabor').checked = false;
  toggleMotorItemFields(false);
  populateMotorSelect();
  modal.show();
}

// Modified populateMotorSelect to show code, name and measure (como pediste)
function populateMotorSelect() {
  const sel = document.getElementById('motorItemSelect');
  sel.innerHTML = '';
  const opt0 = document.createElement('option'); opt0.value=''; opt0.textContent='-- Seleccione un artículo --'; sel.appendChild(opt0);
  articles.forEach(a => {
    const o = document.createElement('option');
    o.value = a.id; // value is article id
    // muestra código, nombre y medida
    o.textContent = `${a.code} ${a.name} ${a.measure || ''}`;
    sel.appendChild(o);
  });
  sel.onchange = () => {
    const id = sel.value;
    const art = articles.find(x => x.id === id);
    if (art) {
      document.getElementById('motorItemCode').value = art.code || '';
      document.getElementById('motorItemName').value = art.name || '';
      document.getElementById('motorItemMeasure').value = art.measure || '';
      document.getElementById('motorItemPrice').value = (art.price || 0).toFixed(2);
    } else {
      document.getElementById('motorItemCode').value = '';
      document.getElementById('motorItemName').value = '';
      document.getElementById('motorItemMeasure').value = '';
      document.getElementById('motorItemPrice').value = '0.00';
    }
  };
}

// Toggle labor (manual) vs selecting from inventory
function toggleMotorItemFields(isLabor) {
  const selectWrap = document.getElementById('motorSelectWrap');
  const codeWrap = document.getElementById('motorItemCode').parentElement;
  const nameWrap = document.getElementById('motorItemName').parentElement;
  const measureWrap = document.getElementById('motorItemMeasure').parentElement;
  const qtyWrap = document.getElementById('motorItemQty').parentElement;
  const priceWrap = document.getElementById('motorItemPrice').parentElement;

  if (isLabor) {
    // Mostrar solo Nombre y Precio
    if (selectWrap) selectWrap.style.display = 'none';
    if (codeWrap) codeWrap.style.display = 'none';
    if (measureWrap) measureWrap.style.display = 'none';
    if (qtyWrap) qtyWrap.style.display = 'none';

    if (nameWrap) nameWrap.style.display = '';
    if (priceWrap) priceWrap.style.display = '';

    // Hacer editable nombre y precio
    document.getElementById('motorItemName').readOnly = false;
    document.getElementById('motorItemPrice').readOnly = false;

    // Limpiar/ajustar campos no usados
    document.getElementById('motorItemCode').value = '';
    document.getElementById('motorItemMeasure').value = '';
    document.getElementById('motorItemQty').value = 1;
    document.getElementById('motorItemSelect').value = '';
  } else {
    // Restaurar vista completa para seleccionar desde inventario
    if (selectWrap) selectWrap.style.display = '';
    if (codeWrap) codeWrap.style.display = '';
    if (measureWrap) measureWrap.style.display = '';
    if (qtyWrap) qtyWrap.style.display = '';

    if (nameWrap) nameWrap.style.display = '';
    if (priceWrap) priceWrap.style.display = '';

    // Nombre se rellena desde la selección (lectura), precio editable para override
    document.getElementById('motorItemName').readOnly = true;
    document.getElementById('motorItemPrice').readOnly = false;
  }
}

// Add to motor submit
function setupAddToMotorForm() {
  const modalEl = document.getElementById('modalAddToMotor');
  const modal = new bootstrap.Modal(modalEl);
  const chk = document.getElementById('isLabor');
  chk.addEventListener('change', () => toggleMotorItemFields(chk.checked));

  els.addToMotorForm.addEventListener('submit', e => {
    e.preventDefault();
    const mid = document.getElementById('currentMotorId').value;
    if (!motors[mid]) { alert('Motor inválido'); return; }
    const isLabor = document.getElementById('isLabor').checked;
    const selectedArticleId = document.getElementById('motorItemSelect').value || null;
    const code = (document.getElementById('motorItemCode').value || '').trim();
    const name = (document.getElementById('motorItemName').value || '').trim();
    const measure = (document.getElementById('motorItemMeasure').value || '').trim();
    const qty = Number(document.getElementById('motorItemQty').value) || 0;
    const price = Number(document.getElementById('motorItemPrice').value) || 0;

    if (!name) { alert('Nombre requerido'); return; }

    const item = { code: isLabor ? '' : code, name, measure: isLabor ? '' : measure, qty, price, isLabor: !!isLabor };
    // if it comes from inventory, link sourceArticleId
    if (!isLabor && selectedArticleId) item.sourceArticleId = selectedArticleId;
    motors[mid].items.push(item);
    saveToStorage();
    renderMotorItems(motors[mid]);
    updateMotorTotal(mid);
    modal.hide();
  });
}

// Motors UI setup
function setupMotorsUI() {
  document.getElementById('btnNewMotor').addEventListener('click', () => {
    const name = prompt('Nombre del motor (ej: Motor 1, Motor A):');
    if (!name) return;
    createNewMotor(name.trim());
  });
  if (els.searchMotor) els.searchMotor.addEventListener('input', () => renderMotorsList(els.searchMotor.value.trim()));
}

// Sidebar switching
function setupSidebar() {
  const buttons = document.querySelectorAll('.sidebar .btn-square');
  buttons.forEach(b => {
    b.addEventListener('click', () => {
      buttons.forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      const target = b.getAttribute('data-bs-target');
      document.querySelectorAll('main .tab-pane').forEach(tp => tp.classList.add('d-none'));
      const panel = document.querySelector(target);
      if (panel) panel.classList.remove('d-none');
    });
  });
}

// Format money util
function formatMoney(v) { return Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// Init
function init() {
  cacheEls();
  async function init() {
  cacheEls()

  await loadArticlesFromSupabase()

  populateFilterOptionsAndDatalists()
  renderTable()

  setupAddArticle()
  setupAddToMotorForm()
  setupMotorsUI()
  renderMotorsList('')
  setupSidebar()
}

  // ensure sample data saved if none
  if (!localStorage.getItem(STORAGE_KEY)) saveToStorage();

  populateFilterOptionsAndDatalists();
  document.addEventListener('DOMContentLoaded', init)

  setupAddArticle();
  setupAddToMotorForm();
  setupMotorsUI();
  renderMotorsList('');

  setupSidebar();

  // filters events
  [els.searchCode, els.filterType, els.filterBrand, els.filterModel].forEach(el => {
    if (!el) return;
    el.addEventListener('input', () => renderTable());
    el.addEventListener('change', () => renderTable());
  });

  // clear filters button
  if (els.clearFiltersBtn) {
    els.clearFiltersBtn.addEventListener('click', () => {
      if (els.searchCode) els.searchCode.value = '';
      if (els.filterType) els.filterType.value = '';
      if (els.filterBrand) els.filterBrand.value = '';
      if (els.filterModel) els.filterModel.value = '';
      renderTable();
    });
  }

  // delete modal actions
  els.confirmDeleteBtn.addEventListener('click', () => {
    const modal = bootstrap.Modal.getInstance(els.modalConfirmDelete);
    confirmDeleteNow();
    if (modal) modal.hide();
  });
  els.cancelDeleteBtn.addEventListener('click', () => { articleIdToDelete = null; });

  // save on unload
  
}

document.addEventListener('DOMContentLoaded', init);


};















