# AGENTS — Bitácora del Proyecto

# BotAr — SaaS de gestión de bots WhatsApp

## Stack
- Node.js ESM, Baileys v7, SQLite (better-sqlite3), Express, Docker Compose
- Frontend: React 19 + Vite + Tailwind v4
- Desktop: Tauri v2 (Rust)
- Túnel: Cloudflare Tunnel (trycloudflare.com) temporal

## Estructura

```
/dashboard/api/index.js        → Express (puerto 3001)
/dashboard/api/db.js            → SQLite dashboard.db (usuarios, clientes, productos, settings)
/dashboard/api/auth.js          → JWT + middlewares (authMiddleware, adminMiddleware)
/dashboard/api/bot-manager.js   → Forkea workers, IPC, heartbeat, auto-restart
/dashboard/index.html           → Entry Vite
/dashboard/src/                 → React (componentes)
/dashboard/src/components/      → Auth, Sidebar, BotList, BotDetail, Users, Settings, Plans, Stats, Support, Modals
/dashboard/dist/                → Build de React (servido por Express)
/dashboard/public/logo.svg      → Logo SVG
/dashboard/vite.config.js       → Vite + proxy API
/dashboard/Dockerfile           → Multi-stage: build React + server

/bot/worker.js                  → Child process con Baileys
/bot/database.js                → SQLite bot.db por cliente (users, conversations, etc.)

/src-tauri/                     → Tauri v2 (Rust)
/src-tauri/src/lib.rs           → Webview, URL hardcodeada del túnel
/src-tauri/tauri.conf.json      → Config Tauri (apunta a dashboard/dist/)

/docker-compose.yml             → Servicio dashboard
```

## Base de datos

**dashboard.db** — tabla `users`:
| Campo | Tipo | Default |
|---|---|---|
| id | TEXT PK | uuid |
| email | TEXT UNIQUE | — |
| name | TEXT | '' |
| password_hash | TEXT | — |
| role | TEXT | 'user' (admin/user) |
| plan | TEXT | 'free' (free/premium/unlimited) |
| plan_bots_limit | INTEGER | 1 |

**dashboard.db** — tabla `clients`:
| Campo | Tipo |
|---|---|
| id | TEXT PK |
| user_id | TEXT FK → users(id) |
| name, phone, business_name | TEXT |
| status | TEXT (offline/starting/awaiting_scan/online/error) |

## Planes
- **free**: 1 bot, gratis
- **premium**: 5 bots, $999/mes
- **unlimited**: bots ilimitados, $2499/mes

## Commands

### Dashboard API
| Endpoint | Método | Auth | Descripción |
|---|---|---|---|
| /api/auth/register | POST | — | Crear cuenta (user, free) |
| /api/auth/login | POST | — | Login por email |
| /api/auth/me | GET | auth | Perfil actual |
| /api/admin/users | GET | admin | Listar usuarios |
| /api/admin/users/:id | PUT | admin | Cambiar rol/plan |
| /api/clients | GET | auth | Lista (admin: todos, user: propios) |
| /api/clients | POST | auth | Crear (valida límite del plan) |
| /api/clients/:id | DELETE | auth | Eliminar (dueño o admin) |
| /api/clients/:id/restart | POST | auth | Reconectar worker |
| /api/clients/:id/status | GET | auth | Status + datos del bot |
| /api/clients/:id/qr | GET | auth | QR en base64 PNG |
| /api/clients/:id/stream | GET | auth | SSE (QR + status) |
| /api/clients/:id/products | GET/POST | auth | CRUD productos |
| /api/clients/:id/products/:pid | PUT/DELETE | auth | CRUD productos |
| /api/clients/:id/keywords | GET/POST | auth | CRUD palabras clave |
| /api/clients/:id/keywords/:kwId | PUT/DELETE | auth | CRUD palabras clave |
| /api/clients/:id/settings | GET/PUT | auth | CRUD settings |
| /api/settings | GET/PUT | admin | Settings globales |
| /api/plans | GET | — | Planes disponibles |
| /api/create-preference | POST | auth | Placeholder MP |
| /api/mercadopago/webhook | POST | — | Placeholder MP webhook |

### Bot Worker
| Comando | Descripción |
|---|---|
| !help | Menú principal |
| !productos / !menu | Lista productos |
| !pedido [args] | Hacer pedido |
| !horario | Horarios |
| !contacto | Contacto |
| 1-4 | Atajo numérico |
| Menu / Menú | Palabra clave |

## Formatos de respuesta (como el bot original)
**Auto-reply / help:**
```
🕊️ *El Palomo PrePizzas*

🍕 *Encargos por mayor* 🍕

1 🍕 Productos
2 🛵 Pedido
3 🕐 Horarios
4 📞 Contacto
```

**Productos:**
```
🕊️ *El Palomo PrePizzas*

*🍕 Pizzas*
  • Prepizza
    Masa lista para armar
  • Pizzetas x6
    Pack de 6 pizzetas
  • Pizzetas x12
    Pack de 12 pizzetas

💬 _Respondé 2 para pedir o 4 para contactar_
```

**Pedido (sin args):**
```
🕊️ *El Palomo PrePizzas*
━━━━━━━━━━━━━━

🛵 *Hacé tu pedido*

Usá: `!pedido [producto] [cantidad]`

Ej: `!pedido 2 prepizzas`
Ej: `!pedido 3 pizzetas x6`
```

**Pedido (con args):**
```
🕊️ *El Palomo PrePizzas*
━━━━━━━━━━━━━━

✅ *Pedido recibido*

> 2 prepizzas

🔔 Te confirmamos por este medio.
💬 Ante cualquier duda, consultános.
```

**Contacto:**
```
🕊️ *El Palomo PrePizzas*
━━━━━━━━━━━━━━

📍 Coronda 1146
📱 11 4563-6983
📧 erikpadilla592@gmail.com
🌐 IG: @padillaerik
```

**Horario:**
```
🕊️ *El Palomo PrePizzas*
━━━━━━━━━━━━━━

🕐 *Horarios*

Lunes a Sábados: 10:00 - 14:00 y 17:00 - 21:00
Domingos: Cerrado
```

## Estados del worker
- `starting` → worker arrancó, esperando QR o conexión
- `awaiting_scan` → QR generado, esperando escaneo
- `online` → conectado a WhatsApp
- `offline` → desconectado
- `error` → error

## Historial de cambios

### Sesión 16/07/2026
- **Formato menú**: restaurado el formato original del bot (🕊️, separador ━━━, bullet points •, emojis sin variants)
- **!pedido con args**: si el usuario manda `!pedido 2 prepizzas`, responde "Pedido recibido" con el detalle
- **!contacto**: muestra datos fijos (dirección, teléfono, email, IG) con separador
- **!horario**: muestra horarios con separador
- **Multi-usuario**: registro con email+pass, cada usuario ve solo sus bots, admin ve todo
- **Roles**: admin (puede todo) / user (solo sus bots)
- **Planes**: free (1 bot), premium (5), unlimited (999) — validación al crear bot
- **Panel admin**: pestaña "Usuarios" para cambiar plan de cada usuario, pestaña "Planes" pública
- **QR como imagen**: el QR string se convierte a base64 PNG via librería `qrcode`, se muestra como `<img>` en el frontend
- **SSE mejorado**: el QR se muestra aunque el SSE se conecte después de que el QR fue emitido (fetch inicial + SSE de actualizaciones)
- **Status inicial**: al crear un bot, arranca como `starting` en lugar de `offline`
- **Compatibilidad DB**: migración automática desde schema viejo (username → email, agrega role/plan/plan_bots_limit/user_id)
- **Electron**: actualizado para soportar servidor remoto vía env `DASHBOARD_URL`
- **BotManager**: el evento 'ready' ya no marca como 'online' prematuramente; espera el 'connected' real
- **Importación bots legacy**: `6d15c37c` (El Palomo PrePizzas) y `952c1d80` re-insertados en la nueva dashboard.db y asignados al admin
- **QR en docker**: agregada dependencia `qrcode` al dashboard/package.json
- **Panel keywords**: sección de palabras clave en el detalle del bot (CRUD con modal)
- **Sync keywords**: se sincronizan automáticamente al worker's bot.db al crear/editar/eliminar
- **Rebrand BotAr**: nombre actualizado en panel, landing, Electron, PayPal
- **Rediseño UI**: sidebar gradient, cards con sombra, inputs redondeados, colores indigo
- **Logo BotAr**: badge con inicial en sidebar y login
- **Dropdown plataformas**: WhatsApp (activo), Instagram/TikTok/Facebook (próximamente) en sidebar

### Sesión 17/07/2026
- **Sidebar**: el texto "SaaS" cambió a "Plataformas" y ahora funciona como dropdown clickeable que despliega WhatsApp Bot, Instagram, TikTok, Facebook (sin sección "Plataformas" separada)
- **Logo SVG**: creado logo personalizado (chat bubble con gradiente indigo) reemplazando la "B" genérica en sidebar, login, y landing page

### Sesión 18/07/2026
- **Sidebar**: corregido updateUserRole (confirm con mensaje según rol actual, pasa el rol al onclick)
- **Loading states**: agregados en register, login, updateUser, updateUserRole, upgradePlan
- **api()**: ahora lanza error si la respuesta no es OK (antes devolvía JSON con error silenciosamente)
- **Tickets / Soporte**: implementado completo
  - DB: tablas `tickets` + `ticket_messages`
  - API: CRUD completo con permisos (admin ve todos, user ve propios)
  - Frontend: vista con sidebar de tickets + detalle con conversación, modal para crear/responder
  - Admin puede cerrar/reabrir tickets
- **Bugfix tickets**: `datetime("now")` → `datetime('now')` (SQLite dobles comillas = identificador)
- **Tickets en tiempo real**: polling cada 3s actualiza lista + detalle automáticamente
- **Eliminar tickets**: admin puede eliminar tickets cerrados (botón rojo visible solo en cerrados)
- **Estadísticas por bot**: API `/api/clients/:id/stats` que lee bot.db (mensajes totales, usuarios únicos, pedidos, comandos más usados, gráfico últimos 7 días). Vista en detalle del bot en cards con gradientes, tooltips y barras de progreso.
- **Sección Estadísticas**: vista independiente en el sidebar que muestra stats de todos los bots en cards con mini-gráficos y barras.
- **DDNS no-ip**: configurado pero no funciona por CGNAT de Movistar
- **ngrok**: alternativa probada para acceso externo sin abrir puertos

### Sesión 19/07/2026
- **React + Vite**: frontend migrado de vanilla HTML+JS a React con componentes reutilizables
  - `dashboard/src/` con componentes: Auth, Sidebar, BotList, BotDetail, Users, Settings, Plans, StatsView, Support, Modals
  - Tailwind v4 con `@tailwindcss/postcss`, tema custom (mismos colores indigo)
  - Vite build → `dashboard/dist/`, Express lo sirve en producción
  - Vite dev server (5173) con proxy API a Express (3001)
  - Hot reload automático en desarrollo
- **Tauri v2**: configurado completamente
  - `src-tauri/` con Cargo.toml, tauri.conf.json, lib.rs, íconos generados
  - `.exe` build exitoso desde Windows (PowerShell)
  - Por defecto apunta a URL del túnel Cloudflare
- **Docker multi-stage**: actualizado `dashboard/Dockerfile` para buildear React + server
- **Tailscale Funnel**: URL fija y permanente, funciona con CGNAT
  - URL actual: `https://desktop-6acpbav.tailcf1d70.ts.net`
  - `tailscale funnel --bg 3001` (ya no requiere Cloudflare Tunnel)
- **Admin email**: cambiado de `admin` a `admin@botar.com` (requerido por validación HTML5 type="email")

### Sesión 22/07/2026
- **Selector de temas** rediseñado: de dropdown a grid responsive de cards (2-5 columnas) con checkmark de selección
- **10 temas visuales** redefinidos con emojis coherentes y separadores decorativos:
  - Clásico 🕊️, Moderno ◇, Minimal ──, Osado ★彡 (borde █), Elegante ✦ (borde ═)
  - Oceano 🌊, Atardecer 🌅, Neón 💜 (borde ▬), Naturaleza 🌿, Real 👑 (borde ═)
- **Propiedad `borderChar`** en temas: cuando no es null, envuelve el mensaje completo con el caracter repetido, usando `wrapBorder()` en worker.js (ancho máximo 44 chars, contenido indentado 2 espacios)
- **Panel de personalización** (`✎ Personalizar`): togglea 12 campos editables con vista previa en vivo; solo guarda valores que difieran del tema base como `custom_theme_*` en settings (evita guardar vacíos)
- **Crear tema personalizado** (`ThemeCreator.jsx`): modal con los 12 campos, vista previa en vivo, guarda como tema en `saved_themes` JSON array en `client_settings`, notifica al admin via `POST /api/notifications`
- **Temas guardados** aparecen en la grid con borde verde, se pueden seleccionar y eliminar (✕), persisten en `client_settings.saved_themes`
- **Notificaciones admin**: tabla `notifications` en dashboard.db, API endpoints `GET/POST /api/notifications` y `PUT /api/notifications/read`, badge con contador en sidebar (polling cada 15s), timbre desactiva al clickear
- **Notificación automática**: al crear un tema personalizado, se genera notificación para el admin con nombre e ícono del tema

## Próximos pasos
1. **DDNS + Cloudflare**: dominio gratis (no-ip.com) ocultando IP real con Cloudflare
2. ~~**Migrar a React + Vite**~~ (✅ implementado)
3. ~~**Build Tauri para distribución**~~ (✅ implementado, .exe generado)
4. ~~**Sistema de tickets / soporte**~~ (✅ implementado)
5. ~~**Estadísticas por bot**~~ (✅ implementado)
6. ~~**Dominio propio + Cloudflare Tunnel permanente**~~ (✅ reemplazado por Tailscale Funnel)

## Build Tauri (Windows)

El proyecto ya tiene la estructura `src-tauri/` con íconos generados.

1. Abrí **PowerShell / CMD desde Windows** (no WSL) en la carpeta del proyecto
2. Instalá Rust: https://rustup.rs
3. Instalá Visual Studio Build Tools (o VS Community) con workloads "Desktop development with C++"
4. Corré:
```bash
npm install -D @tauri-apps/cli@latest
npm run tauri build
```

El `.exe` va a salir en `src-tauri/target/release/botar.exe`.

## Cómo correr
```bash
# Desarrollo local
docker compose up -d

# Desarrollo frontend (hot reload)
cd dashboard && npm run dev:frontend

# Logs
docker compose logs -f

# Rebuild Docker
docker compose build dashboard && docker compose up -d

# Tailscale Funnel (URL fija sin abrir puertos)
tailscale funnel --bg 3001
```
