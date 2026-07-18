const API = '';
let token = localStorage.getItem('token');
let currentUser = null;
let currentClientId = null;
let eventSources = {};

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API + path, { ...options, headers });
  if (res.status === 401) { logout(); throw new Error('Unauthorized'); }
  return res.json();
}

// ─── Auth ───────────────────────────────────────────────────────
function showRegister() {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.remove('hidden');
  document.getElementById('login-error').classList.add('hidden');
  document.getElementById('reg-error').classList.add('hidden');
}

function showLogin() {
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('login-error').classList.add('hidden');
  document.getElementById('reg-error').classList.add('hidden');
}

async function register() {
  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-pass').value;
  if (!email || !password) return alert('Completá todos los campos');
  showLoading('Creando cuenta...');
  try {
    const data = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    hideLoading();
    token = data.token;
    localStorage.setItem('token', token);
    enterApp(data);
  } catch (e) {
    hideLoading();
    document.getElementById('reg-error').textContent = 'Error al registrarse';
    document.getElementById('reg-error').classList.remove('hidden');
  }
}

async function login() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-pass').value;
  showLoading('Ingresando...');
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    hideLoading();
    token = data.token;
    localStorage.setItem('token', token);
    enterApp(data);
  } catch {
    hideLoading();
    document.getElementById('login-error').textContent = 'Email o contraseña incorrectos';
    document.getElementById('login-error').classList.remove('hidden');
  }
}

function enterApp(user) {
  currentUser = user;
  document.getElementById('auth-container').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('sidebarUser').textContent = user.name || user.email;
  document.getElementById('planLabel').textContent = `Plan: ${user.plan}`;

  if (user.role === 'admin') {
    document.getElementById('adminNav').classList.remove('hidden');
  }

  showView('clients');
  loadClients();
}

function logout() {
  token = null;
  currentUser = null;
  localStorage.removeItem('token');
  Object.values(eventSources).forEach(es => es.close());
  eventSources = {};
  document.getElementById('app').classList.add('hidden');
  document.getElementById('auth-container').classList.remove('hidden');
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('register-form').classList.add('hidden');
}

// ─── Navigation ─────────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
  document.getElementById(`view-${name}`).classList.remove('hidden');

  // Highlight active nav button
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('bg-white/10'));
  document.querySelectorAll('.platform-btn').forEach(b => b.classList.remove('bg-white/10', 'text-white'));
  document.querySelectorAll('.platform-btn').forEach(b => b.classList.add('text-white/50'));
  const active = document.querySelector(`[onclick*="'${name}'"]`);
  if (active) {
    active.classList.add('bg-white/10');
    active.classList.remove('text-white/50');
    active.classList.add('text-white');
  }

  if (name === 'users') loadUsers();
  if (name === 'plans') loadPlans();
  if (name === 'settings') loadGlobalSettings();
  if (name === 'support') loadTickets();
}

function showPlatform(platform) {
  showView('clients');
}

function togglePlatforms() {
  const dropdown = document.getElementById('platformsDropdown');
  const chevron = document.getElementById('chevron');
  dropdown.classList.toggle('hidden');
  chevron.classList.toggle('rotate-180');
}

// ─── Clients ────────────────────────────────────────────────────
async function loadClients() {
  const clients = await api('/api/clients');
  const list = document.getElementById('clientList');
  list.innerHTML = clients.map(c => `
    <div class="p-3 rounded-lg cursor-pointer hover:bg-gray-100 mb-1 ${currentClientId === c.id ? 'bg-blue-50 border border-blue-200' : ''}"
         onclick="selectClient('${c.id}')">
      <div class="flex items-center justify-between">
        <span class="font-medium">${c.business_name || c.name}</span>
        <span class="flex items-center gap-1">
          ${c.phone ? `<a href="https://wa.me/${c.phone.replace(/[^0-9]/g,'')}" target="_blank" class="text-green-500 hover:text-green-700 text-sm" title="Abrir WhatsApp" onclick="event.stopPropagation()">💬</a>` : ''}
          <span class="text-sm ${c.status === 'online' ? 'text-green-500' : c.status === 'awaiting_scan' ? 'text-yellow-500' : 'text-gray-400'}">
            ${c.status === 'online' ? '🟢' : c.status === 'awaiting_scan' ? '🟡' : '⚫'}
          </span>
        </span>
      </div>
      <p class="text-sm text-gray-500">${c.phone || ''}</p>
      ${c.user_email && currentUser?.role === 'admin' ? `<p class="text-xs text-gray-400">${c.user_name || c.user_email}</p>` : ''}
    </div>
  `).join('');
}

function selectClient(id) {
  currentClientId = id;
  loadClients();
  loadClientDetail(id);
}

async function loadClientDetail(id) {
  const [data, products, settings, keywords] = await Promise.all([
    api(`/api/clients/${id}/status`),
    api(`/api/clients/${id}/products`),
    api(`/api/clients/${id}/settings`),
    api(`/api/clients/${id}/keywords`),
  ]);

  document.getElementById('clientDetail').innerHTML = `
    <div class="max-w-3xl">
      <div class="flex items-start justify-between mb-4">
        <div class="flex items-start gap-3">
          <div>
            <h3 class="text-2xl font-bold">${data.business_name || data.name}</h3>
            <p class="text-gray-500">${data.phone || ''}</p>
          </div>
          <button onclick="showEditClient('${id}', ${JSON.stringify(data).replace(/"/g,'&quot;')})" class="text-blue-500 hover:text-blue-700 text-sm mt-1" title="Editar bot">✏️</button>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-3 py-1 rounded-full text-sm ${data.status === 'online' ? 'bg-green-100 text-green-700' : data.status === 'awaiting_scan' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}">
            ${data.status === 'online' ? '🟢 Conectado' : data.status === 'awaiting_scan' ? '🟡 Esperando QR' : '⚫ Desconectado'}
          </span>
          <button onclick="deleteClient('${id}')" class="text-red-500 hover:text-red-700 px-2" title="Eliminar">🗑️</button>
        </div>
      </div>

      ${data.status !== 'online' ? `
        <div class="bg-white rounded-lg p-4 mb-4">
          <h4 class="font-semibold mb-2">📷 Escaneá el QR con WhatsApp</h4>
          <div id="qrContainer" class="flex justify-center">
            <p class="text-gray-400">${data.status === 'awaiting_scan' ? 'Generando QR...' : 'Conectando...'}</p>
          </div>
        </div>
      ` : ''}

      ${data.status === 'offline' && data.phone ? `
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <p class="text-yellow-800">El bot está desconectado. Asegurate de que el número ${data.phone} tenga WhatsApp activo.</p>
          <button onclick="restartClient('${id}')" class="mt-2 bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-yellow-700">
            Reconectar
          </button>
        </div>
      ` : ''}

      <div class="bg-white rounded-lg p-4 mb-4">
        <div class="flex items-center justify-between mb-3">
          <h4 class="font-semibold">📋 Productos</h4>
          <button onclick="showAddProduct('${id}')" class="text-blue-600 text-sm hover:underline">+ Agregar</button>
        </div>
        <div id="productList">
          ${products.map(p => `
            <div class="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <span class="font-medium">${p.emoji} ${p.name}</span>
                ${p.price ? `<span class="text-gray-500">$${p.price}</span>` : ''}
                ${p.description ? `<p class="text-sm text-gray-400">${p.description}</p>` : ''}
              </div>
              <div class="flex gap-2">
                <button onclick="showEditProduct('${id}', ${JSON.stringify(p).replace(/"/g,'&quot;')})" class="text-blue-400 hover:text-blue-600 text-sm">✏️</button>
                <button onclick="deleteProduct('${id}', ${p.id})" class="text-red-400 hover:text-red-600 text-sm">🗑️</button>
              </div>
            </div>
          `).join('') || '<p class="text-gray-400 text-sm">Sin productos.</p>'}
        </div>
      </div>

      <!-- Custom Keywords -->
      <div class="bg-white rounded-lg p-4 mb-4">
        <div class="flex items-center justify-between mb-3">
          <h4 class="font-semibold">🔑 Palabras clave (autorespuesta)</h4>
          <button onclick="showAddKeyword('${id}')" class="text-blue-600 text-sm hover:underline">+ Agregar</button>
        </div>
        <div id="keywordList">
          ${keywords.length === 0 ? '<p class="text-gray-400 text-sm">Sin palabras clave. Agregá usando el botón de arriba.</p>' : keywords.map(k => `
            <div class="flex items-start justify-between py-2 border-b last:border-0">
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-sm">${k.keyword}</span>
                  ${k.is_active ? '<span class="text-xs text-green-500">activa</span>' : '<span class="text-xs text-gray-400">inactiva</span>'}
                </div>
                <p class="text-sm text-gray-600 mt-1 whitespace-pre-line">${k.response}</p>
              </div>
              <div class="flex gap-2 ml-2 shrink-0">
                <button onclick="showEditKeyword('${id}', ${JSON.stringify(k).replace(/"/g,'&quot;')})" class="text-blue-400 hover:text-blue-600 text-sm">✏️</button>
                <button onclick="deleteKeyword('${id}', ${k.id})" class="text-red-400 hover:text-red-600 text-sm">🗑️</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="bg-white rounded-lg p-4 mb-8">
        <h4 class="font-semibold mb-3">⚙️ Configuración</h4>
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-600">Horario</label>
            <textarea id="set-horario" class="w-full border rounded px-3 py-2 text-sm">${settings.horario || ''}</textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-600">Contacto</label>
            <textarea id="set-contacto" class="w-full border rounded px-3 py-2 text-sm">${settings.contacto || ''}</textarea>
          </div>
          <button onclick="saveClientSettings('${id}')" class="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">
            Guardar todo
          </button>
        </div>
      </div>
    </div>
  `;

  // Fetch current QR immediately (may have been emitted before SSE opened)
  if (data.status !== 'online') {
    api(`/api/clients/${id}/qr`).then(({ qr }) => {
      const container = document.getElementById('qrContainer');
      if (container && qr) {
        if (qr.startsWith('data:image')) {
          container.innerHTML = `<img src="${qr}" alt="QR" class="w-64 h-64">`;
        } else {
          container.innerHTML = `<pre class="text-xs leading-tight font-mono">${qr}</pre>`;
        }
      }
    });
    startQRStream(id);
  }
}

function startQRStream(id) {
  if (eventSources[id]) eventSources[id].close();
  const es = new EventSource(`${API}/api/clients/${id}/stream`);
  eventSources[id] = es;
  es.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.type === 'qr') {
      const container = document.getElementById('qrContainer');
      if (container) {
        if (data.qr && data.qr.startsWith('data:image')) {
          container.innerHTML = `<img src="${data.qr}" alt="QR" class="w-64 h-64">`;
        } else if (data.qr) {
          container.innerHTML = `<pre class="text-xs leading-tight font-mono">${data.qr}</pre>`;
        }
      }
    }
    if (data.type === 'status') {
      loadClients();
      loadClientDetail(id);
    }
  };
}

// ─── Users (admin) ──────────────────────────────────────────────
async function loadUsers() {
  const users = await api('/api/admin/users');
  document.getElementById('usersList').innerHTML = users.map(u => `
    <div class="bg-white rounded-lg p-4 flex items-center justify-between">
      <div>
        <p class="font-medium">${u.name || u.email}</p>
        <p class="text-sm text-gray-500">${u.email}</p>
        <p class="text-xs text-gray-400">Plan: ${u.plan} | Bots: ${u.plan_bots_limit} | Rol: ${u.role}</p>
      </div>
      <div class="flex gap-2 items-center text-sm">
        <select onchange="updateUser('${u.id}', this)" class="border rounded px-2 py-1">
          <option value="free" ${u.plan === 'free' ? 'selected' : ''}>Gratuito</option>
          <option value="premium" ${u.plan === 'premium' ? 'selected' : ''}>Premium</option>
          <option value="unlimited" ${u.plan === 'unlimited' ? 'selected' : ''}>Ilimitado</option>
        </select>
        <button onclick="updateUserRole('${u.id}', '${u.role}')" class="text-blue-600 hover:underline">
          ${u.role === 'admin' ? '🔴 Quitar admin' : '⭐ Hacer admin'}
        </button>
      </div>
    </div>
  `).join('');
}

async function updateUser(id, select) {
  const plan = select.value;
  const limits = { free: 1, premium: 5, unlimited: 999 };
  showLoading('Actualizando plan...');
  await api(`/api/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ plan, plan_bots_limit: limits[plan] }),
  });
  hideLoading();
  loadUsers();
}

async function updateUserRole(id, currentRole) {
  const newRole = currentRole === 'admin' ? 'user' : 'admin';
  const msg = currentRole === 'admin' ? '¿Quitar admin a este usuario?' : '¿Hacer admin a este usuario?';
  if (!confirm(msg)) return;
  showLoading('Actualizando rol...');
  await api(`/api/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ role: newRole }),
  });
  hideLoading();
  loadUsers();
}

// ─── Plans ──────────────────────────────────────────────────────
async function loadPlans() {
  const plans = await api('/api/plans');
  const isPremium = currentUser?.plan !== 'free';
  document.getElementById('plansList').innerHTML = plans.map(p => `
    <div class="bg-white rounded-lg p-6 shadow ${p.price === 0 ? 'border-2 border-gray-200' : 'border-2 border-blue-200'}">
      <h3 class="text-xl font-bold mb-2">${p.name}</h3>
      <p class="text-3xl font-bold mb-4">${p.price === 0 ? 'Gratis' : `$${p.price}/mes`}</p>
      <ul class="space-y-2 mb-4">
        ${p.features.map(f => `<li class="text-sm text-gray-600">✅ ${f}</li>`).join('')}
      </ul>
      ${currentUser?.plan === p.id
        ? '<span class="block text-center text-green-600 font-semibold">✔ Plan actual</span>'
        : p.price === 0 ? ''
        : `<button onclick="upgradePlan('${p.id}')" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">Contratar</button>`
      }
    </div>
  `).join('');
}

async function upgradePlan(planId) {
  showLoading('Preparando pago...');
  try {
    const data = await api('/api/create-preference', {
      method: 'POST',
      body: JSON.stringify({ plan_id: planId }),
    });
    hideLoading();
    if (data.approve_link) {
      window.location.href = data.approve_link;
    } else {
      alert('Error: ' + (data.error || 'No se pudo crear el pago'));
    }
  } catch (e) {
    hideLoading();
    alert('Error al conectar con PayPal');
  }
}

// ─── Loading States ─────────────────────────────────────────────
function showLoading(text = 'Cargando...') {
  document.getElementById('loadingText').textContent = text;
  document.getElementById('loadingOverlay').classList.remove('hidden');
  document.getElementById('loadingOverlay').classList.add('flex');
}

function hideLoading() {
  document.getElementById('loadingOverlay').classList.add('hidden');
  document.getElementById('loadingOverlay').classList.remove('flex');
}

// ─── CRUD ───────────────────────────────────────────────────────
function showAddClient() {
  document.getElementById('clientModalTitle').textContent = 'Nuevo Bot';
  document.getElementById('clientModal-name').value = '';
  document.getElementById('clientModal-phone').value = '';
  document.getElementById('clientModal-business').value = '';
  document.getElementById('clientModal').dataset.editId = '';
  document.getElementById('clientModal').classList.remove('hidden');
  document.getElementById('clientModal').classList.add('flex');
}

function showEditClient(id, data) {
  document.getElementById('clientModalTitle').textContent = 'Editar Bot';
  document.getElementById('clientModal-name').value = data.name || '';
  document.getElementById('clientModal-phone').value = data.phone || '';
  document.getElementById('clientModal-business').value = data.business_name || '';
  document.getElementById('clientModal').dataset.editId = id;
  document.getElementById('clientModal').classList.remove('hidden');
  document.getElementById('clientModal').classList.add('flex');
}

function closeClientModal() {
  document.getElementById('clientModal').classList.add('hidden');
  document.getElementById('clientModal').classList.remove('flex');
}

async function saveClient() {
  const name = document.getElementById('clientModal-name').value;
  const phone = document.getElementById('clientModal-phone').value;
  const business_name = document.getElementById('clientModal-business').value;
  if (!name) return alert('El nombre es obligatorio');
  const editId = document.getElementById('clientModal').dataset.editId;
  const isEdit = !!editId;
  showLoading(isEdit ? 'Guardando...' : 'Creando bot...');
  try {
    if (isEdit) {
      await api(`/api/clients/${editId}`, {
        method: 'PUT',
        body: JSON.stringify({ name, phone, business_name }),
      });
    } else {
      const res = await fetch(API + '/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name, phone, business_name }),
      });
      if (res.status === 403) {
        const data = await res.json();
        hideLoading();
        return alert(data.error);
      }
    }
    closeClientModal();
    loadClients();
    if (isEdit && currentClientId === editId) loadClientDetail(editId);
  } catch (e) {
    alert('Error al guardar');
  }
  hideLoading();
}

// ─── Products (modal-based) ──────────────────────────────────────
let _editingProductId = null;
let _editingProductClientId = null;
let _editingKeywordId = null;
let _editingKeywordClientId = null;

function showAddProduct(clientId) {
  _editingProductId = null;
  _editingProductClientId = clientId;
  document.getElementById('productModalTitle').textContent = 'Nuevo Producto';
  document.getElementById('productModal-name').value = '';
  document.getElementById('productModal-price').value = '';
  document.getElementById('productModal-emoji').value = '🔹';
  document.getElementById('productModal-desc').value = '';
  document.getElementById('productModalBtn').textContent = 'Guardar';
  document.getElementById('productModal').classList.remove('hidden');
  document.getElementById('productModal').classList.add('flex');
}

function showEditProduct(clientId, product) {
  _editingProductId = product.id;
  _editingProductClientId = clientId;
  document.getElementById('productModalTitle').textContent = 'Editar Producto';
  document.getElementById('productModal-name').value = product.name;
  document.getElementById('productModal-price').value = product.price || '';
  document.getElementById('productModal-emoji').value = product.emoji || '🔹';
  document.getElementById('productModal-desc').value = product.description || '';
  document.getElementById('productModalBtn').textContent = 'Actualizar';
  document.getElementById('productModal').classList.remove('hidden');
  document.getElementById('productModal').classList.add('flex');
}

function closeProductModal() {
  document.getElementById('productModal').classList.add('hidden');
  document.getElementById('productModal').classList.remove('flex');
  _editingProductId = null;
  _editingProductClientId = null;
}

async function saveProduct() {
  const clientId = _editingProductClientId;
  if (!clientId) return;
  const name = document.getElementById('productModal-name').value;
  const price = document.getElementById('productModal-price').value;
  const emoji = document.getElementById('productModal-emoji').value || '🔹';
  const description = document.getElementById('productModal-desc').value;
  if (!name) return alert('El nombre es obligatorio');
  showLoading('Guardando producto...');
  try {
    if (_editingProductId) {
      await api(`/api/clients/${clientId}/products/${_editingProductId}`, {
        method: 'PUT',
        body: JSON.stringify({ name, price: price ? parseFloat(price) : null, emoji, description }),
      });
    } else {
      await api(`/api/clients/${clientId}/products`, {
        method: 'POST',
        body: JSON.stringify({ name, price: price ? parseFloat(price) : null, emoji, description, category: 'General' }),
      });
    }
    closeProductModal();
    loadClientDetail(clientId);
  } catch (e) {
    alert('Error al guardar producto');
  }
  hideLoading();
}

async function deleteClient(id) {
  if (!confirm('¿Eliminar este cliente? Se perderán todos los datos.')) return;
  showLoading('Eliminando bot...');
  await api(`/api/clients/${id}`, { method: 'DELETE' });
  currentClientId = null;
  loadClients();
  hideLoading();
  document.getElementById('clientDetail').innerHTML = `
    <div class="text-center text-gray-400 mt-20">
      <p class="text-4xl mb-4">👈</p>
      <p>Seleccioná un bot de la lista</p>
    </div>`;
}

async function restartClient(id) {
  showLoading('Reconectando...');
  await api(`/api/clients/${id}/restart`, { method: 'POST' });
  loadClientDetail(id);
  hideLoading();
}

// ─── Products (legacy removed, now uses modal) ──────────────────
async function deleteProduct(clientId, productId) {
  if (!confirm('¿Eliminar este producto?')) return;
  showLoading('Eliminando...');
  await api(`/api/clients/${clientId}/products/${productId}`, { method: 'DELETE' });
  loadClientDetail(clientId);
  hideLoading();
}

// ─── Keywords ──────────────────────────────────────────────────
function showAddKeyword(clientId) {
  _editingKeywordId = null;
  _editingKeywordClientId = clientId;
  document.getElementById('keywordModalTitle').textContent = 'Nueva palabra clave';
  document.getElementById('keywordModal-keyword').value = '';
  document.getElementById('keywordModal-response').value = '';
  document.getElementById('keywordModal-active').checked = true;
  document.getElementById('keywordModal').classList.remove('hidden');
  document.getElementById('keywordModal').classList.add('flex');
}

function showEditKeyword(clientId, kw) {
  _editingKeywordId = kw.id;
  _editingKeywordClientId = clientId;
  document.getElementById('keywordModalTitle').textContent = 'Editar palabra clave';
  document.getElementById('keywordModal-keyword').value = kw.keyword;
  document.getElementById('keywordModal-response').value = kw.response;
  document.getElementById('keywordModal-active').checked = kw.is_active === 1;
  document.getElementById('keywordModal').classList.remove('hidden');
  document.getElementById('keywordModal').classList.add('flex');
}

function closeKeywordModal() {
  document.getElementById('keywordModal').classList.add('hidden');
  document.getElementById('keywordModal').classList.remove('flex');
  _editingKeywordId = null;
  _editingKeywordClientId = null;
}

async function saveKeyword() {
  const clientId = _editingKeywordClientId;
  if (!clientId) return;
  const keyword = document.getElementById('keywordModal-keyword').value.trim();
  const response = document.getElementById('keywordModal-response').value.trim();
  const is_active = document.getElementById('keywordModal-active').checked ? 1 : 0;
  if (!keyword || !response) return alert('Completá todos los campos');
  showLoading('Guardando...');
  try {
    if (_editingKeywordId) {
      await api(`/api/clients/${clientId}/keywords/${_editingKeywordId}`, {
        method: 'PUT',
        body: JSON.stringify({ keyword, response, is_active }),
      });
    } else {
      await api(`/api/clients/${clientId}/keywords`, {
        method: 'POST',
        body: JSON.stringify({ keyword, response, is_active }),
      });
    }
    closeKeywordModal();
    loadClientDetail(clientId);
  } catch (e) {
    alert('Error al guardar: ' + (e.message || ''));
  }
  hideLoading();
}

async function deleteKeyword(clientId, kwId) {
  if (!confirm('¿Eliminar esta palabra clave?')) return;
  showLoading('Eliminando...');
  await api(`/api/clients/${clientId}/keywords/${kwId}`, { method: 'DELETE' });
  loadClientDetail(clientId);
  hideLoading();
}

// ─── Settings ───────────────────────────────────────────────────
async function saveClientSettings(id) {
  showLoading('Guardando configuración...');
  const body = {
    horario: document.getElementById('set-horario')?.value || '',
    contacto: document.getElementById('set-contacto')?.value || '',
    autoreply_welcome: document.getElementById('set-ar-welcome')?.value || '',
    autoreply_help: document.getElementById('set-ar-help')?.value || '',
    autoreply_productos: document.getElementById('set-ar-productos')?.value || '',
    autoreply_pedido: document.getElementById('set-ar-pedido')?.value || '',
    autoreply_pedido_recibido: document.getElementById('set-ar-pedido-recibido')?.value || '',
    autoreply_horario: document.getElementById('set-ar-horario')?.value || '',
    autoreply_contacto: document.getElementById('set-ar-contacto')?.value || '',
  };
  await api(`/api/clients/${id}/settings`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  hideLoading();
  alert('Configuración guardada');
}

async function loadGlobalSettings() {
  try {
    const s = await api('/api/settings');
    if (s.bot_prefix) document.getElementById('set-prefix').value = s.bot_prefix;
    if (s.bot_cooldown) document.getElementById('set-cooldown').value = s.bot_cooldown;
    if (s.paypal_client_id) document.getElementById('set-paypal-client-id').value = s.paypal_client_id;
    if (s.paypal_client_secret) document.getElementById('set-paypal-secret').value = s.paypal_client_secret;
    if (s.paypal_mode) document.getElementById('set-paypal-mode').value = s.paypal_mode;
  } catch {}
}

async function saveGlobalSettings() {
  showLoading('Guardando configuración global...');
  const prefix = document.getElementById('set-prefix').value;
  const cooldown = document.getElementById('set-cooldown').value;
  const body = { bot_prefix: prefix, bot_cooldown: cooldown };
  const paypalId = document.getElementById('set-paypal-client-id').value;
  const paypalSecret = document.getElementById('set-paypal-secret').value;
  if (paypalId) body.paypal_client_id = paypalId;
  if (paypalSecret) body.paypal_client_secret = paypalSecret;
  body.paypal_mode = document.getElementById('set-paypal-mode').value;
  await api('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  hideLoading();
  alert('Configuración global guardada');
}

// ─── Tickets / Support ──────────────────────────────────────────
let currentTicketId = null;

function showNewTicket() {
  document.getElementById('ticketModal-subject').value = '';
  document.getElementById('ticketModal-message').value = '';
  document.getElementById('ticketModal').classList.remove('hidden');
  document.getElementById('ticketModal').classList.add('flex');
}

function closeTicketModal() {
  document.getElementById('ticketModal').classList.add('hidden');
  document.getElementById('ticketModal').classList.remove('flex');
}

async function saveTicket() {
  const subject = document.getElementById('ticketModal-subject').value;
  const message = document.getElementById('ticketModal-message').value;
  if (!subject || !message) return alert('Completá todos los campos');
  showLoading('Creando ticket...');
  await api('/api/tickets', {
    method: 'POST',
    body: JSON.stringify({ subject, message }),
  });
  hideLoading();
  closeTicketModal();
  loadTickets();
}

async function loadTickets() {
  const tickets = await api('/api/tickets');
  document.getElementById('ticketList').innerHTML = tickets.map(t => `
    <div onclick="loadTicketDetail('${t.id}')" class="p-3 rounded-xl cursor-pointer hover:bg-gray-50 transition-all ${currentTicketId === t.id ? 'bg-blue-50 border border-blue-200' : 'border border-transparent'}">
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm font-medium truncate">${t.subject}</p>
        <span class="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded-full ${t.status === 'open' ? 'bg-green-100 text-green-700' : t.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}">${t.status}</span>
      </div>
      ${currentUser?.role === 'admin' ? `<p class="text-xs text-gray-400 mt-1">${t.user_name || t.user_email}</p>` : ''}
      <p class="text-xs text-gray-400 mt-0.5">${new Date(t.created_at).toLocaleDateString()}</p>
    </div>
  `).join('');
  if (currentTicketId && document.querySelector(`[onclick*='${currentTicketId}']`)) {
    loadTicketDetail(currentTicketId);
  }
}

async function loadTicketDetail(id) {
  currentTicketId = id;
  const ticket = await api(`/api/tickets/${id}`);
  const msgs = ticket.messages.map(m => `
    <div class="flex ${m.is_admin ? 'justify-start' : 'justify-end'} mb-3">
      <div class="max-w-[75%] ${m.is_admin ? 'bg-gray-100 rounded-2xl rounded-bl-sm' : 'bg-blue-600 text-white rounded-2xl rounded-br-sm'} px-4 py-2.5">
        <p class="text-xs font-medium opacity-70 mb-0.5">${m.is_admin ? 'Soporte' : 'Tú'}</p>
        <p class="text-sm">${m.message}</p>
        <p class="text-[10px] opacity-50 mt-1">${new Date(m.created_at).toLocaleString()}</p>
      </div>
    </div>
  `).join('');

  const statusBadge = ticket.status === 'open' ? '🟢 Abierto' : ticket.status === 'pending' ? '🟡 Pendiente' : '🔴 Cerrado';
  const canClose = currentUser?.role === 'admin';
  const isClosed = ticket.status === 'closed';

  document.getElementById('ticketDetail').innerHTML = `
    <div class="max-w-3xl mx-auto">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-lg font-semibold">${ticket.subject}</h3>
          <p class="text-sm text-gray-500">${statusBadge}${currentUser?.role === 'admin' ? ` — ${ticket.user_name || ticket.user_email}` : ''}</p>
        </div>
        <div class="flex gap-2">
          ${canClose ? `
            <button onclick="toggleTicketStatus('${id}', '${isClosed ? 'open' : 'closed'}')" class="px-3 py-1.5 rounded-xl text-sm font-medium border ${isClosed ? 'border-green-300 text-green-700 hover:bg-green-50' : 'border-red-300 text-red-700 hover:bg-red-50'} transition-all">
              ${isClosed ? 'Reabrir' : 'Cerrar'}
            </button>
          ` : ''}
          ${isClosed ? '' : `<button onclick="showReply('${id}')" class="px-3 py-1.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-all">Responder</button>`}
        </div>
      </div>
      <div class="bg-white rounded-2xl border border-gray-100 p-4 min-h-[300px] flex flex-col">
        <div class="flex-1 overflow-y-auto mb-4">${msgs}</div>
      </div>
    </div>
  `;
}

function showReply(ticketId) {
  currentTicketId = ticketId;
  document.getElementById('replyModal-message').value = '';
  document.getElementById('replyModal').classList.remove('hidden');
  document.getElementById('replyModal').classList.add('flex');
}

function closeReplyModal() {
  document.getElementById('replyModal').classList.add('hidden');
  document.getElementById('replyModal').classList.remove('flex');
}

async function sendReply() {
  const message = document.getElementById('replyModal-message').value;
  if (!message) return alert('Escribí un mensaje');
  showLoading('Enviando...');
  await api(`/api/tickets/${currentTicketId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
  hideLoading();
  closeReplyModal();
  loadTickets();
}

async function toggleTicketStatus(id, status) {
  showLoading('Actualizando...');
  await api(`/api/tickets/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
  hideLoading();
  loadTickets();
}

// ─── Init ───────────────────────────────────────────────────────
if (token) {
  api('/api/auth/me').then(user => {
    if (user) {
      enterApp(user);
    } else {
      logout();
    }
  }).catch(() => logout());
}