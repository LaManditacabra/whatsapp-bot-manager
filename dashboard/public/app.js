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
  try {
    const data = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    token = data.token;
    localStorage.setItem('token', token);
    enterApp(data);
  } catch (e) {
    document.getElementById('reg-error').textContent = 'Error al registrarse';
    document.getElementById('reg-error').classList.remove('hidden');
  }
}

async function login() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-pass').value;
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    token = data.token;
    localStorage.setItem('token', token);
    enterApp(data);
  } catch {
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

  if (name === 'users') loadUsers();
  if (name === 'plans') loadPlans();
  if (name === 'settings') loadGlobalSettings();
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
        <span class="text-sm ${c.status === 'online' ? 'text-green-500' : c.status === 'awaiting_scan' ? 'text-yellow-500' : 'text-gray-400'}">
          ${c.status === 'online' ? '🟢' : c.status === 'awaiting_scan' ? '🟡' : '⚫'}
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
  const data = await api(`/api/clients/${id}/status`);
  const products = await api(`/api/clients/${id}/products`);
  const settings = await api(`/api/clients/${id}/settings`);

  document.getElementById('clientDetail').innerHTML = `
    <div class="max-w-3xl">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-2xl font-bold">${data.business_name || data.name}</h3>
          <p class="text-gray-500">${data.phone || ''}</p>
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
              <button onclick="deleteProduct('${id}', ${p.id})" class="text-red-400 hover:text-red-600 text-sm">Eliminar</button>
            </div>
          `).join('') || '<p class="text-gray-400 text-sm">Sin productos.</p>'}
        </div>
      </div>

      <div class="bg-white rounded-lg p-4">
        <h4 class="font-semibold mb-3">⚙️ Configuración</h4>
        <div class="space-y-3">
          <div>
            <label class="block text-sm">Horario</label>
            <textarea id="set-horario" class="w-full border rounded px-3 py-2 text-sm">${settings.horario || ''}</textarea>
          </div>
          <div>
            <label class="block text-sm">Contacto</label>
            <textarea id="set-contacto" class="w-full border rounded px-3 py-2 text-sm">${settings.contacto || ''}</textarea>
          </div>
          <button onclick="saveClientSettings('${id}')" class="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">
            Guardar Configuración
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
        <button onclick="updateUserRole('${u.id}')" class="text-blue-600 hover:underline">
          ${u.role === 'admin' ? '🔴 Quitar admin' : '⭐ Hacer admin'}
        </button>
      </div>
    </div>
  `).join('');
}

async function updateUser(id, select) {
  const plan = select.value;
  const limits = { free: 1, premium: 5, unlimited: 999 };
  await api(`/api/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ plan, plan_bots_limit: limits[plan] }),
  });
  loadUsers();
}

async function updateUserRole(id) {
  const newRole = confirm('Cambiar rol de este usuario?') ? 'admin' : 'user';
  // Toggle
  const user = document.querySelector(`#usersList option[value]`); // hacky
  await api(`/api/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ role: newRole }),
  });
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
  try {
    const data = await api('/api/create-preference', {
      method: 'POST',
      body: JSON.stringify({ plan_id: planId }),
    });
    if (data.approve_link) {
      window.location.href = data.approve_link;
    } else {
      alert('Error: ' + (data.error || 'No se pudo crear el pago'));
    }
  } catch (e) {
    alert('Error al conectar con PayPal');
  }
}

// ─── CRUD ───────────────────────────────────────────────────────
function showAddClient() {
  document.getElementById('modalTitle').textContent = 'Nuevo Bot';
  document.getElementById('modal-name').value = '';
  document.getElementById('modal-phone').value = '';
  document.getElementById('modal-business').value = '';
  document.getElementById('modal').classList.remove('hidden');
  document.getElementById('modal').classList.add('flex');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  document.getElementById('modal').classList.remove('flex');
}

async function saveClient() {
  const name = document.getElementById('modal-name').value;
  const phone = document.getElementById('modal-phone').value;
  const business_name = document.getElementById('modal-business').value;
  if (!name) return alert('El nombre es obligatorio');
  const res = await fetch(API + '/api/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ name, phone, business_name }),
  });
  if (res.status === 403) {
    const data = await res.json();
    return alert(data.error);
  }
  closeModal();
  loadClients();
}

async function deleteClient(id) {
  if (!confirm('¿Eliminar este cliente? Se perderán todos los datos.')) return;
  await api(`/api/clients/${id}`, { method: 'DELETE' });
  currentClientId = null;
  loadClients();
  document.getElementById('clientDetail').innerHTML = `
    <div class="text-center text-gray-400 mt-20">
      <p class="text-4xl mb-4">👈</p>
      <p>Seleccioná un bot de la lista</p>
    </div>`;
}

async function restartClient(id) {
  await api(`/api/clients/${id}/restart`, { method: 'POST' });
  loadClientDetail(id);
}

// ─── Products ───────────────────────────────────────────────────
function showAddProduct(clientId) {
  const name = prompt('Nombre del producto:');
  if (!name) return;
  const price = prompt('Precio (opcional, ej: 1500):');
  const desc = prompt('Descripción (opcional):');
  api(`/api/clients/${clientId}/products`, {
    method: 'POST',
    body: JSON.stringify({
      name,
      price: price ? parseFloat(price) : null,
      description: desc || '',
      category: 'General',
      emoji: '🔹',
    }),
  }).then(() => loadClientDetail(clientId));
}

async function deleteProduct(clientId, productId) {
  if (!confirm('¿Eliminar este producto?')) return;
  await api(`/api/clients/${clientId}/products/${productId}`, { method: 'DELETE' });
  loadClientDetail(clientId);
}

// ─── Settings ───────────────────────────────────────────────────
async function saveClientSettings(id) {
  const horario = document.getElementById('set-horario')?.value || '';
  const contacto = document.getElementById('set-contacto')?.value || '';
  await api(`/api/clients/${id}/settings`, {
    method: 'PUT',
    body: JSON.stringify({ horario, contacto }),
  });
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
  alert('Configuración global guardada');
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