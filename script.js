// script.js - integrado con Supabase (fallback a localStorage)
// Requiere: config.js con `CONFIG.SUPABASE_URL` y `CONFIG.SUPABASE_ANON_KEY`
// y la librería: https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js

// STORAGE key para fallback local
const LOCAL_STORAGE_KEY = 'rp_articles_local_v1';
const LOCAL_MOTORS_KEY = 'rp_motors_local_v1';

// Inicializa Supabase usando CONFIG desde config.js
let supabase = null;
try {
  if (typeof CONFIG !== 'undefined') {
    supabase = supabaseJs.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  } else {
    console.warn('CONFIG no definido. Asegúrate de tener config.js cargado antes de script.js');
  }
} catch (e) {
  console.warn('No se pudo inicializar Supabase (librería ausente o CONFIG faltante).', e);
  supabase = null;
}

// Datos en memoria
let articles = [];
let motors = {}; // motors keyed by id

// Utilidades
function generateId(prefix='id') { return prefix + '_' + Math.random().toString(36).slice(2,9); }
function escapeHtml(s) { return String(s || ''); }
function escapeId(s) { return String(s).replace(/[^a-zA-Z0-9_-]/g, '_'); }
function formatMoney(v) { return Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// ---------- Fallback localStorage helpers ----------
function loadLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) articles = JSON.parse(raw);
  } catch (e) { console.error('Error cargando articles de localStorage', e); }
  try {
    const rawm = localStorage.getItem(LOCAL_MOTORS_KEY);
    if (rawm) motors = JSON.parse(rawm);
  } catch (e) { console.error('Error cargando motors de localStorage', e); }
}

function saveLocal() {
  try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(articles)); } catch(e){ console.warn('No se pudo guardar articles en localStorage', e); }
  try { localStorage.setItem(LOCAL_MOTORS_KEY, JSON.stringify(motors)); } catch(e){ console.warn('No se pudo guardar motors en localStorage', e); }
}

// ---------- Supabase helpers ----------
async function fetchRemoteData() {
  if (!supabase) throw new Error('Supabase no inicializado');

  // Fetch articles
  const { data: articlesData, error: aErr } = await supabase
    .from('articles')
    .select('*')
    .order('created_at', { ascending: false });

  if (aErr) throw aErr;
  articles = articlesData || [];

  // Fetch motors with items (nested)
  const { data: motorsData, error: mErr } = await supabase
    .from('motors')
    .select('*, motor_items(*)')
    .order('created_at', { ascending: false });

  if (mErr) throw mErr;
  motors = {};
  (motorsData || []).forEach(m => {
    motors[m.id] = { id: m.id, name: m.name, items: (m.motor_items || []).map(it => ({
      id: it.id,
      code: it.code,
      name: it.name,
      measure: it.measure,
      qty: it.qty,
      price: Number(it.price),
      isLabor: !!it.is_labor,
      sourceArticleId: it.source_article_id || null
    })) , created_at: m.created_at };
  });
}

async function insertArticleRemote(article) {
  if (!supabase) throw new Error('Supabase no inicializado');
  const payload = {
    code: article.code || null,
    name: article.name,
    measure: article.measure || null,
    qty: article.qty || 0,
    price: article.price || 0,
    type: article.type || null,
    brand: article.brand || null,
    model: article.model || null
  };
  const { data, error } = await supabase.from('articles').insert([payload]).select().single();
  if (error) throw error;
  return data; // retornará el registro con id
}

async function updateArticleRemote(id, changes) {
  if (!supabase) throw new Error('Supabase no inicializado');
  const { data, error } = await supabase.from('articles').update(changes).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function deleteArticleRemote(id) {
  if (!supabase) throw new Error('Supabase no inicializado');
  // Borra motor_items que referencien el article (opcional)
  const { error: delItemsErr } = await supabase.from('motor_items').delete().eq('source_article_id', id);
  if (delItemsErr) console.warn('No se pudieron eliminar motor_items referenciados', delItemsErr);
  const { data, error } = await supabase.from('articles').delete().eq('id', id).select();
  if (error) throw error;
  return data;
}

async function insertMotorRemote(name) {
  if (!supabase) throw new Error('Supabase no inicializado');
  const { data, error } = await supabase.from('motors').insert([{ name }]).select().single();
  if (error) throw error;
  return data;
}

async function insertMotorItemRemote(motorId, item) {
  if (!supabase) throw new Error('Supabase no inicializado');
  const payload = {
    motor_id: motorId,
    source_article_id: item.sourceArticleId || null,
    code: item.code || null,
    name: item.name,
    measure: item.measure || null,
    qty: item.qty || 0,
    price: item.price || 0,
    is_labor: !!item.isLabor
  };
  const { data, error } = await supabase.from('motor_items').insert([payload]).select().single();
  if (error) throw error;
  return data;
}

async function deleteMotorItemRemote(id) {
  if (!supabase) throw new Error('Supabase no inicializado');
  const { data, error } = await supabase.from('motor_items').delete().eq('id', id).select();
  if (error) throw error;
  return data;
}

async function deleteMotorRemote(id) {
  if (!supabase) throw new Error('Supabase no inicializado');
  // motor_items con on delete cascade en schema.sql
  const { data, error } = await supabase.from('motors').delete().eq('id', id).select();
  if (error) throw error;
  return data;
}

// ---------- Abstracciones: usar Supabase con fallback local ----------
async function loadData() {
  // Intenta obtener de Supabase; si falla, carga local
  if (supabase) {
    try {
      await fetchRemoteData();
      // guardamos cache local
      saveLocal();
      return;
    } catch (e) {
      console.warn('No se pudo cargar desde Supabase, se usará cache local.', e);
      loadLocal();
      return;
    }
  } else {
    loadLocal();
  }
}

async function createArticle(article) {
  if (supabase) {
    try {
      const created = await insertArticleRemote(article);
      // push a memoria desde remoto
      articles.unshift(created);
      saveLocal();
      populateFilterOptionsAndDatalists();
      renderTable();
      return created;
    } catch (e) {
      console.warn('Fallo insertar en Supabase; guardando localmente', e);
    }
  }
  // fallback local
  const newArt = { id: generateId('art'), ...article };
  articles.unshift(newArt);
  saveLocal();
  populateFilterOptionsAndDatalists();
  renderTable();
  return newArt;
}

async function updateArticleQtyById(id, delta) {
  const idx = articles.findIndex(a => a.id === id || a.id === id); // id could be uuid or local generated
  if (idx === -1) return;
  const newQty = Math.max(0, (Number(articles[idx].qty) || 0) + delta);

  if (supabase && articles[idx].id && articles[idx].id.startsWith('art_') === false) {
    // If id looks like a DB uuid (not local 'art_*'), update remote
    try {
      await updateArticleRemote(articles[idx].id, { qty: newQty, updated_at: new Date().toISOString() });
      articles[idx].qty = newQty;
      saveLocal();
      const el = document.getElementById('qty-' + escapeId(articles[idx].id));
      if (el) el.textContent = articles[idx].qty;
      return;
    } catch (e) {
      console.warn('Error actualizando qty en Supabase, aplicando localmente', e);
    }
  }
  // fallback local update
  articles[idx].qty = newQty;
  saveLocal();
  const el = document.getElementById('qty-' + escapeId(articles[idx].id));
  if (el) el.textContent = articles[idx].qty;
}

async function removeArticleById(id) {
  // Remove remote if possible
  if (supabase && id && !id.startsWith('art_')) {
    try {
      await deleteArticleRemote(id);
      // refresh remote snapshot
      await loadData();
      populateFilterOptionsAndDatalists();
      renderTable();
      renderMotorsList( (document.getElementById('searchMotor')?.value || '').trim() );
      return;
    } catch (e) {
      console.warn('No se pudo eliminar remotamente, se eliminará localmente', e);
    }
  }
  // fallback local delete
  articles = articles.filter(a => a.id !== id);
  // limpiar en motors localmente
  Object.keys(motors).forEach(mid => {
    motors[mid].items = (motors[mid].items || []).filter(it => it.sourceArticleId !== id);
  });
  saveLocal();
  populateFilterOptionsAndDatalists();
  renderTable();
  renderMotorsList( (document.getElementById('searchMotor')?.value || '').trim() );
}

// Motors: create, add item, delete
async function createMotor(name) {
  if (supabase) {
    try {
      const created = await insertMotorRemote(name);
      motors[created.id] = { id: created.id, name: created.name, items: [], created_at: created.created_at };
      saveLocal();
      renderMotorsList('');
      return motors[created.id];
    } catch (e) {
      console.warn('Fallo crear motor en Supabase, creando local', e);
    }
  }
  const id = generateId('motor');
  motors[id] = { id, name, items: [], created_at: new Date().toISOString() };
  saveLocal();
  renderMotorsList('');
  return motors[id];
}

async function addItemToMotor(mid, item) {
  // item: { code, name, measure, qty, price, isLabor, sourceArticleId? }
  if (supabase && motors[mid] && motors[mid].id && !motors[mid].id.startsWith('motor_')) {
    try {
      const created = await insertMotorItemRemote(mid, item);
      // push to local motor snapshot
      if (!motors[mid].items) motors[mid].items = [];
      motors[mid].items.push({
        id: created.id,
        code: created.code,
        name: created.name,
        measure: created.measure,
        qty: created.qty,
        price: Number(created.price),
        isLabor: !!created.is_labor,
        sourceArticleId: created.source_article_id || null
      });
      saveLocal();
      renderMotorItems(motors[mid]);
      updateMotorTotal(mid);
      return;
    } catch (e) {
      console.warn('Error agregando item a motor en Supabase, aplicando local', e);
    }
  }
  // fallback local push
  if (!motors[mid]) {
    motors[mid] = { id: mid, name: 'Motor temporal', items: [], created_at: new Date().toISOString() };
  }
  const localItem = { id: generateId('mi'), ...item };
  motors[mid].items.push(localItem);
  saveLocal();
  renderMotorItems(motors[mid]);
  updateMotorTotal(mid);
}

// delete motor item
async function removeMotorItem(mid, idx) {
  const item = motors[mid].items[idx];
  if (!item) return;
  if (supabase && item.id && !item.id.startsWith('mi')) {
    try {
      await deleteMotorItemRemote(item.id);
      // refresh remote snapshot
      await loadData();
      renderMotorsList('');
      return;
    } catch (e) {
      console.warn('Error borrando motor_item remoto, borrando local', e);
    }
  }
  // fallback local
  motors[mid].items.splice(idx, 1);
  saveLocal();
  renderMotorItems(motors[mid]);
  updateMotorTotal(mid);
}

// ---------- UI rendering & event wiring (mantengo la estructura previa) ----------

// Cache de elementos
const els = {
  searchCode: null, filterType: null, filterBrand: null, filterModel: null, tableBody: null,
  addArticleForm: null, addToMotorForm: null, searchMotor: null, motorsList: null,
  modalConfirmDelete: null, confirmDeleteText: null, confirmDeleteBtn: null, cancelDeleteBtn: null,
  clearFiltersBtn: null
};

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

// Filters & datalists
function uniqueValues(field) {
  const s = new Set();
  articles.forEach(a => { if (a[field]) s.add(a[field]); });
  return Array.from(s).sort();
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
  fillDatalist('dlModels', models);
}

function filterArticles() {
  const codeQ = (els.searchCode?.value || '').trim().toLowerCase();
  const fType = els.filterType?.value;
  const fBrand = els.filterBrand?.value;
  const fModel = els.filterModel?.value;

  return articles.filter(a => {
    if (codeQ && !(a.code||'').toLowerCase().includes(codeQ)) return false;
    if (fType && a.type !== fType) return false;
    if (fBrand && a.brand !== fBrand) return false;
    if (fModel && a.model !== fModel) return false;
    return true;
  });
}

// Render inventario (muestro precio como pediste)
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
    btn.addEventListener('click', async () => {
      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      if (action === 'increase') await updateArticleQtyById(id, 1);
      if (action === 'decrease') await updateArticleQtyById(id, -1);
    });
  });

  els.tableBody.querySelectorAll('button.btn-trash').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      promptDeleteById(id);
    });
  });
}

// Delete flow (UI modal trigger)
let articleIdToDelete = null;
function promptDeleteById(id) {
  articleIdToDelete = id;
  const art = articles.find(a => a.id === id);
  const text = art ? `¿Eliminar "${art.name}" (código ${art.code})? Esta acción también quitará el ítem de cualquier motor.` : '¿Eliminar este artículo?';
  if (els.confirmDeleteText) els.confirmDeleteText.textContent = text;
  const modal = new bootstrap.Modal(els.modalConfirmDelete);
  modal.show();
}
function confirmDeleteNow() {
  if (!articleIdToDelete) return;
  removeArticleById(articleIdToDelete);
  articleIdToDelete = null;
}

// ---------- Modal: Add Article (usando createArticle) ----------
function setupAddArticle() {
  const modalEl = document.getElementById('modalAddArticle');
  const modal = new bootstrap.Modal(modalEl);
  const fab = document.getElementById('fabAddArticle');
  if (fab) fab.addEventListener('click', () => {
    document.getElementById('addArticleForm').reset();
    modal.show();
  });

  els.addArticleForm.addEventListener('submit', async e => {
    e.preventDefault();
    const code = document.getElementById('addCode').value.trim();
    const name = document.getElementById('addName').value.trim();
    const measure = document.getElementById('addMeasure').value.trim();
    const qty = Number(document.getElementById('addQty').value) || 0;
    const price = Number(document.getElementById('addPrice').value) || 0;
    const type = document.getElementById('addType').value.trim();
    const brand = document.getElementById('addBrand').value.trim();
    const model = document.getElementById('addModel').value.trim();

    if (!name) { alert('Nombre requerido'); return; }
    if (!measure) { alert('Medida requerida'); return; }
    if (!qty) { alert('Cantidad requerida'); return; }
    if (!price) { alert('Precio requerido'); return; }
    if (!brand) { alert('Marca requerida'); return; }
    if (!model) { alert('Modelo requerido'); return; }

    const newArticle = { code, name, measure, qty, price, type, brand, model };
    await createArticle(newArticle);
    modal.hide();
  });
}

// ---------- Motors UI + Add to motor modal ----------
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
            <div class="text-muted-small">${(m.items||[]).length} ítems</div>
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
            // try remote delete
            (async () => {
              if (supabase && !mid.startsWith('motor_')) {
                try { await deleteMotorRemote(mid); await loadData(); populateFilterOptionsAndDatalists(); renderTable(); renderMotorsList(''); return; } catch(e){ console.warn(e); }
              }
              delete motors[mid];
              saveLocal();
              renderMotorsList('');
            })();
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
      removeMotorItem(mid, idx);
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

// Add to motor modal
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

function populateMotorSelect() {
  const sel = document.getElementById('motorItemSelect');
  sel.innerHTML = '';
  const opt0 = document.createElement('option'); opt0.value=''; opt0.textContent='-- Seleccione un artículo --'; sel.appendChild(opt0);
  articles.forEach(a => {
    const o = document.createElement('option');
    o.value = a.id; // value is article id or uuid
    o.textContent = `${a.code || ''} ${a.name} ${a.measure ? '(' + a.measure + ')' : ''}`;
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

function toggleMotorItemFields(isLabor) {
  const selectWrap = document.getElementById('motorSelectWrap');
  const codeWrap = document.getElementById('motorItemCode').parentElement;
  const nameWrap = document.getElementById('motorItemName').parentElement;
  const measureWrap = document.getElementById('motorItemMeasure').parentElement;
  const qtyWrap = document.getElementById('motorItemQty').parentElement;
  const priceWrap = document.getElementById('motorItemPrice').parentElement;

  if (isLabor) {
    if (selectWrap) selectWrap.style.display = 'none';
    if (codeWrap) codeWrap.style.display = 'none';
    if (measureWrap) measureWrap.style.display = 'none';
    if (qtyWrap) qtyWrap.style.display = 'none';
    if (nameWrap) nameWrap.style.display = '';
    if (priceWrap) priceWrap.style.display = '';
    document.getElementById('motorItemName').readOnly = false;
    document.getElementById('motorItemPrice').readOnly = false;
    document.getElementById('motorItemCode').value = '';
    document.getElementById('motorItemMeasure').value = '';
    document.getElementById('motorItemQty').value = 1;
    document.getElementById('motorItemSelect').value = '';
  } else {
    if (selectWrap) selectWrap.style.display = '';
    if (codeWrap) codeWrap.style.display = '';
    if (measureWrap) measureWrap.style.display = '';
    if (qtyWrap) qtyWrap.style.display = '';
    if (nameWrap) nameWrap.style.display = '';
    if (priceWrap) priceWrap.style.display = '';
    document.getElementById('motorItemName').readOnly = true;
    document.getElementById('motorItemPrice').readOnly = false;
  }
}

function setupAddToMotorForm() {
  const modalEl = document.getElementById('modalAddToMotor');
  const modal = new bootstrap.Modal(modalEl);
  const chk = document.getElementById('isLabor');
  chk.addEventListener('change', () => toggleMotorItemFields(chk.checked));

  els.addToMotorForm.addEventListener('submit', async e => {
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
    if (!isLabor && selectedArticleId) item.sourceArticleId = selectedArticleId;

    await addItemToMotor(mid, item);
    // recalculate totals UI already done in addItemToMotor
    modal.hide();
  });
}

async function removeMotorItem(mid, idx) {
  const item = motors[mid].items[idx];
  if (!item) return;
  // if item has remote id and supabase available, call remote delete
  if (supabase && item.id && !item.id.startsWith('mi')) {
    try {
      await deleteMotorItemRemote(item.id);
      await loadData();
      populateFilterOptionsAndDatalists();
      renderTable();
      renderMotorsList('');
      return;
    } catch (e) {
      console.warn('Error remoto al borrar motor item, se borrará local', e);
    }
  }
  motors[mid].items.splice(idx, 1);
  saveLocal();
  renderMotorItems(motors[mid]);
  updateMotorTotal(mid);
}

// Sidebar & init wiring
function setupMotorsUI() {
  document.getElementById('btnNewMotor').addEventListener('click', async () => {
    const name = prompt('Nombre del motor (ej: Motor 1, Motor A):');
    if (!name) return;
    await createMotor(name.trim());
  });
  if (els.searchMotor) els.searchMotor.addEventListener('input', () => renderMotorsList(els.searchMotor.value.trim()));
}

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

// Inicialización
async function init() {
  cacheEls();
  // carga datos (remote preferido)
  await loadData();
  populateFilterOptionsAndDatalists();
  renderTable();

  setupAddArticle();
  setupAddToMotorForm();
  setupMotorsUI();
  renderMotorsList('');
  setupSidebar();

  // attach filters events
  [els.searchCode, els.filterType, els.filterBrand, els.filterModel].forEach(el => {
    if (!el) return;
    el.addEventListener('input', () => renderTable());
    el.addEventListener('change', () => renderTable());
  });

  // clear filters
  if (els.clearFiltersBtn) {
    els.clearFiltersBtn.addEventListener('click', () => {
      if (els.searchCode) els.searchCode.value = '';
      if (els.filterType) els.filterType.value = '';
      if (els.filterBrand) els.filterBrand.value = '';
      if (els.filterModel) els.filterModel.value = '';
      renderTable();
    });
  }

  // confirm delete modal buttons
  if (els.confirmDeleteBtn) els.confirmDeleteBtn.addEventListener('click', () => { confirmDeleteNow(); const modal = bootstrap.Modal.getInstance(els.modalConfirmDelete); if (modal) modal.hide(); });
  if (els.cancelDeleteBtn) els.cancelDeleteBtn.addEventListener('click', () => { articleIdToDelete = null; });

  // add listeners for addArticle form wired in setupAddArticle
  // save cache on unload
  window.addEventListener('beforeunload', () => saveLocal());
}

document.addEventListener('DOMContentLoaded', init);
