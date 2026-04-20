import pkg from 'whatsapp-web.js'
const { Client, LocalAuth, MessageMedia } = pkg
import qrcode from 'qrcode-terminal'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import ExcelJS from 'exceljs'
import { ImapFlow } from 'imapflow'
import http from 'http'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── CONFIGURACION ───────────────────────────────────────────
// strip() elimina comillas que puedan haber quedado en los valores de env vars
const strip = v => (v || '').replace(/^["']|["']$/g, '').trim()
const GROQ_API_KEY     = strip(process.env.GROQ_API_KEY)
const GEMINI_KEY       = strip(process.env.GEMINI_KEY)
const GMAIL_USER       = strip(process.env.GMAIL_USER)
const GMAIL_APP_PASS   = strip(process.env.GMAIL_APP_PASSWORD).replace(/\s+/g, '')

// Grupos donde al llegar una imagen, el bot la interpreta como comprobante
// de pago y verifica en el correo de Bancolombia antes de registrar.
const GRUPOS_VERIFICACION_PAGO = ['jorge - verificacion pagos ai']

// PROYECTO_DIR: carpeta del Drive donde viven los datos (se define en ARRANCAR_BOT_PERSONAL.bat)
const PROYECTO_DIR        = strip(process.env.PROYECTO_DIR) || '/app'
const GASTOS_DIR          = path.join(PROYECTO_DIR, 'datos')
const ASISTENTE_DIR       = GASTOS_DIR   // todo va en la misma carpeta
const APRENDIZAJE_FILE    = path.join(GASTOS_DIR, 'aprendizaje.json')
const PENDIENTE_FILE      = path.join(GASTOS_DIR, 'pendiente.json')
const RECORDATORIOS_FILE  = path.join(ASISTENTE_DIR, 'recordatorios.json')
const PROYECTOS_FILE      = path.join(GASTOS_DIR, 'proyectos.json')
const PROYECTOS_EXCEL     = path.join(GASTOS_DIR, 'proyectos.xlsx')
const TIEMPOS_FILE        = path.join(GASTOS_DIR, 'tiempos.json')
const TIMER_FILE          = path.join(GASTOS_DIR, 'timer_activo.json')
const TIEMPOS_EXCEL       = path.join(GASTOS_DIR, 'tiempos.xlsx')

// Número de Aura (empleada del hogar) — recibe comprobante cuando se registra pago
const NUMERO_AURA      = '573146425027'
const PAGOS_AURA_EXCEL  = path.join(GASTOS_DIR, 'pagos_aura.xlsx')

// Número de Chila (Finanzas Priority) — recibe comprobante cuando se registra pago
const NUMERO_CHILA      = '573216412940'
const PAGOS_CHILA_EXCEL = path.join(GASTOS_DIR, 'pagos_chila.xlsx')

// Archivo espejo de Valen (Pago Stella / Valen AI) — comprobante va al grupo
const PAGOS_STELLA_VALEN_EXCEL = path.join(GASTOS_DIR, 'pagos_stella_valen.xlsx')

// Número de Beatriz (PR Beatriz Producción AI) — recibe comprobante cuando se registra pago
const NUMERO_BEATRIZ      = '573206917024'
const PAGOS_BEATRIZ_EXCEL = path.join(GASTOS_DIR, 'pagos_beatriz.xlsx')

// Grupo Interrapidísimo Envíos Priority AI — comprobante va al grupo
const PAGOS_INTER_EXCEL = path.join(GASTOS_DIR, 'pagos_interrapidisimo.xlsx')

// Proveedores de Priority (cueros) — cada uno recibe comprobante en su chat directo
const NUMERO_ORLANDO       = '573104692008'
const PAGOS_ORLANDO_EXCEL  = path.join(GASTOS_DIR, 'pagos_orlando.xlsx')
const NUMERO_MAGDA         = '573128311794'
const PAGOS_MAGDA_EXCEL    = path.join(GASTOS_DIR, 'pagos_magda.xlsx')
const NUMERO_JUANCARLOS    = '573105542864'
const PAGOS_JUANCARLOS_EXCEL = path.join(GASTOS_DIR, 'pagos_juancarlos.xlsx')
const NUMERO_MAURICIO      = '573158727475'
const PAGOS_MAURICIO_EXCEL = path.join(GASTOS_DIR, 'pagos_mauricio.xlsx')

// Proveedor de herrajes
const NUMERO_HERRAJES      = '573135581815'
const PAGOS_HERRAJES_EXCEL = path.join(GASTOS_DIR, 'pagos_herrajes.xlsx')

// Archivos que se espejan automáticamente a Finanzas Priority
const FINANZAS_PRIORITY_EXCEL = path.join(GASTOS_DIR, 'felipe_pagos.xlsx')
const MIRROR_A_FINANZAS = {
  [path.join(GASTOS_DIR, 'pagos_stella_valen.xlsx')]:  'Valen',
  [path.join(GASTOS_DIR, 'pagos_beatriz.xlsx')]:       'Beatriz',
  [path.join(GASTOS_DIR, 'pagos_orlando.xlsx')]:       'Orlando',
  [path.join(GASTOS_DIR, 'pagos_magda.xlsx')]:         'Magda',
  [path.join(GASTOS_DIR, 'pagos_juancarlos.xlsx')]:    'Juan Carlos',
  [path.join(GASTOS_DIR, 'pagos_mauricio.xlsx')]:      'Mauricio',
  [path.join(GASTOS_DIR, 'pagos_herrajes.xlsx')]:      'Herrajes Pereira',
}

const GRUPOS_GASTOS = {
  'gastos':                     path.join(PROYECTO_DIR, 'datos', 'gastos_personales.xlsx'),
  'gastos ai':                  path.join(PROYECTO_DIR, 'datos', 'gastos_personales.xlsx'),
  'mariana - gastos personales ai': path.join(PROYECTO_DIR, 'datos', 'gastos_personales.xlsx'),
  'mariana gastos personales ai':   path.join(PROYECTO_DIR, 'datos', 'gastos_personales.xlsx'),
  'pago stella / juancho':      path.join(PROYECTO_DIR, 'datos', 'pagos_stella_juancho.xlsx'),
  'pago stella/juancho':        path.join(PROYECTO_DIR, 'datos', 'pagos_stella_juancho.xlsx'),
  'pago stella / juancho ai':   path.join(PROYECTO_DIR, 'datos', 'pagos_stella_juancho.xlsx'),
  'pago stella/juancho ai':     path.join(PROYECTO_DIR, 'datos', 'pagos_stella_juancho.xlsx'),
  'pago stella / valen':        path.join(PROYECTO_DIR, 'datos', 'pagos_stella_valen.xlsx'),
  'pago stella/valen':          path.join(PROYECTO_DIR, 'datos', 'pagos_stella_valen.xlsx'),
  'pago stella / valen ai':     path.join(PROYECTO_DIR, 'datos', 'pagos_stella_valen.xlsx'),
  'pago stella/valen ai':       path.join(PROYECTO_DIR, 'datos', 'pagos_stella_valen.xlsx'),
  'pago stella / nania':        path.join(PROYECTO_DIR, 'datos', 'pagos_stella_nania.xlsx'),
  'pago stella/nania':          path.join(PROYECTO_DIR, 'datos', 'pagos_stella_nania.xlsx'),
  'pago stella / nania ai':     path.join(PROYECTO_DIR, 'datos', 'pagos_stella_nania.xlsx'),
  'pago stella/nania ai':       path.join(PROYECTO_DIR, 'datos', 'pagos_stella_nania.xlsx'),
  'felipe - pagos ai':       path.join(PROYECTO_DIR, 'datos', 'felipe_pagos.xlsx'),
  'jorge - verificacion pagos ai': path.join(PROYECTO_DIR, 'datos', 'jorge_verificacion_pagos.xlsx'),
  'aura casa ai':               path.join(PROYECTO_DIR, 'datos', 'pagos_aura.xlsx'),
  'aura casa':                  path.join(PROYECTO_DIR, 'datos', 'pagos_aura.xlsx'),
  'chila pagos ai':             path.join(PROYECTO_DIR, 'datos', 'pagos_chila.xlsx'),
  'interrapidisimo envios priority ai': path.join(PROYECTO_DIR, 'datos', 'pagos_interrapidisimo.xlsx'),
  'interrapidisimo envios priority':    path.join(PROYECTO_DIR, 'datos', 'pagos_interrapidisimo.xlsx'),
}

// Conversaciones directas (chats individuales) que el bot también monitorea
const CHATS_DIRECTOS_GASTOS = {
  'pr beatriz produccion':     path.join(PROYECTO_DIR, 'datos', 'pagos_beatriz.xlsx'),
  'pr beatriz producción':     path.join(PROYECTO_DIR, 'datos', 'pagos_beatriz.xlsx'),
  'pr beatriz produccion ai':  path.join(PROYECTO_DIR, 'datos', 'pagos_beatriz.xlsx'),
  'pr beatriz producción ai':  path.join(PROYECTO_DIR, 'datos', 'pagos_beatriz.xlsx'),
}

// Grupos donde el bot SOLO escucha al dueño — ignora mensajes de los demás
const GRUPOS_SOLO_DUENO = [
  'pago stella / juancho',
  'pago stella/juancho',
  'pago stella / juancho ai',
  'pago stella/juancho ai',
  'pago stella / valen',
  'pago stella/valen',
  'pago stella / valen ai',
  'pago stella/valen ai',
  'pago stella / nania',
  'pago stella/nania',
  'pago stella / nania ai',
  'pago stella/nania ai',
  'pr beatriz produccion',
  'pr beatriz producción',
  'pr beatriz produccion ai',
  'pr beatriz producción ai',
  'felipe - pagos ai',
  'jorge - verificacion pagos ai',
  'interrapidisimo envios priority ai',
  'interrapidisimo envios priority',
]

// Grupos/chats con categoría fija — todo va a esa categoría sin preguntar
const GRUPOS_CATEGORIA_FIJA = {
  'pago stella / juancho':     'Abono',
  'pago stella/juancho':       'Abono',
  'pago stella / juancho ai':  'Abono',
  'pago stella/juancho ai':    'Abono',
  'pago stella / valen':       'Abono',
  'pago stella/valen':         'Abono',
  'pago stella / valen ai':    'Abono',
  'pago stella/valen ai':      'Abono',
  'pago stella / nania':       'Abono',
  'pago stella/nania':         'Abono',
  'pago stella / nania ai':    'Abono',
  'pago stella/nania ai':      'Abono',
  'pr beatriz produccion':     'Abono',
  'pr beatriz producción':     'Abono',
  'pr beatriz produccion ai':  'Abono',
  'pr beatriz producción ai':  'Abono',
  'felipe - pagos ai':            'Pagos',
  'jorge - verificacion pagos ai': 'Pagos',
}

const GRUPOS_ASISTENTE = ['mi asistente', 'mi asistente ai', 'sofia - mi asistente ai', 'sofia mi asistente ai']

// ─── CAMILA — Bot de marketing de Priority Leather ──────────────
// Grupo WhatsApp con comandos de texto/voz para análisis de pauta + contenido
// Arquitectura: bot LOCAL (ARRANCAR_BOT_PERSONAL.bat) → spawn Python directo
// Requisito: el bot debe correr en el PC donde están los scripts y el Chrome con sesión IG
const GRUPOS_CAMILA = ['camila - marketing ai', 'camila marketing ai']
const CAMILA_BASE_DIR = 'H:\\Mi unidad\\1. NEGOCIOS\\Claude\\bot-marketing-priority-ai'
const CAMILA_PYTHON_EXE = 'C:\\Users\\Equipo\\AppData\\Local\\Programs\\Python\\Python312\\python.exe'

// ─── CATEGORÍAS ──────────────────────────────────────────────
// El bot asigna automáticamente según palabras clave conocidas.
// Si no sabe, pregunta al usuario y aprende para siempre.
const CATEGORIAS = ['Hogar', 'Hijos', 'Ocio', 'Otros']

const CATEGORIA_MENU = `❓ *¿En qué categoría va este gasto?*\n\n1️⃣ Hogar _(mercado, casa, servicios, salud prepagada, transporte)_\n2️⃣ Hijos _(colegio, ropa niños, Salvador, Violeta)_\n3️⃣ Ocio _(restaurantes, diversión, peluquería, motilada)_\n\nResponde con el número (1-3)`

const OPCION_A_CATEGORIA = { '1':'Hogar', '2':'Hijos', '3':'Ocio' }

// Palabras de alimentación que generan la pregunta Hogar vs Ocio
const COMIDA_RE = /\b(desayuno|almuerzo|almuerzos|cena|comida|comidas|restaurante|restaurant|cafeteria|cafeteria|cafe|tinto|menu|merienda|onces|domicilio|rappi|ifood|uber\s*eats|picada|pizza|hamburguesa|hamburgues|sushi|pollo|bandeja|sancocho|empanada|pandebono|brunch|lunch|snack|fajitas|tacos|crepes|ensalada|sopa|caldo|arepa|arepas|bunuelo|changua|fritanga|corrientazo|ejecutivo|plato\s+del\s+dia|almuerzo\s+veredal|veredal|parrilla|asado|churrasco|seco|sudado)\b/i
function esComidaAmbigua(descripcion) {
  const desc = descripcion.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return COMIDA_RE.test(desc)
}
// ─────────────────────────────────────────────────────────────

// DEBUG STARTUP — muestra qué variables llegaron (primeros 10 chars del key)
console.log('=== STARTUP DEBUG ===')
console.log('RAW_GROQ:', JSON.stringify(process.env.GROQ_API_KEY), 'len:', (process.env.GROQ_API_KEY||'').length)
console.log('GROQ_API_KEY:', GROQ_API_KEY ? ('OK - ' + GROQ_API_KEY.substring(0,10) + '...') : 'VACIA')
console.log('PROYECTO_DIR:', process.env.PROYECTO_DIR || '(no definida)')
console.log('ALL_KEYS_COUNT:', Object.keys(process.env).length)
console.log('ALL_KEYS:', Object.keys(process.env).sort().join(', '))
console.log('NODE_ENV:', process.env.NODE_ENV || '(no definida)')
console.log('=====================')

if (!GROQ_API_KEY) {
  console.log('ADVERTENCIA: Falta GROQ_API_KEY — funciones de IA desactivadas, pero el bot continúa')
}

// ─── WHATSAPP-WEB.JS ─────────────────────────────────────────
// Número personal del dueño — el bot responde cuando le escriben directamente
const NUMERO_DUENO   = strip(process.env.NUMERO_DUENO)   || '573117647723'
const DUENO_JID      = NUMERO_DUENO + '@c.us'

// Caché de JID de grupo → nombre en minúsculas
const grupoJids = {}

// Última imagen enviada por el dueño en cada grupo (para reenvío de comprobantes)
const lastImagePerGroup = {}  // { [grupoId]: { msg, timestamp } }

// Cliente whatsapp-web.js con sesión persistente
// La sesión se guarda en C:\bot-personal\session (ver ARRANCAR_BOT_PERSONAL.bat que copia bot.js allí)
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: path.join(__dirname, 'session') }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  },
})

// ─────────────────────────────────────────────────────────────

const GROQ_URL       = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_AUDIO_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'

// ─── APRENDIZAJE ─────────────────────────────────────────────
function cargarAprendizaje() {
  try { return JSON.parse(fs.readFileSync(APRENDIZAJE_FILE, 'utf-8')) }
  catch { return {} }
}

function guardarAprendizaje(a) {
  if (!fs.existsSync(GASTOS_DIR)) fs.mkdirSync(GASTOS_DIR, { recursive: true })
  fs.writeFileSync(APRENDIZAJE_FILE, JSON.stringify(a, null, 2))
}

function buscarEnAprendizaje(descripcion) {
  const aprendizaje = cargarAprendizaje()
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const desc = norm(descripcion)
  // Prioridad 1: descripción completa exacta
  if (aprendizaje[descripcion.toLowerCase()]) return aprendizaje[descripcion.toLowerCase()]
  // Prioridad 2: clave completa como palabra(s) entera(s) — evita que "libro" matchee "libros"
  for (const [clave, categoria] of Object.entries(aprendizaje)) {
    const claveN = norm(clave)
    const escaped = claveN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // \b no funciona con español, usamos (?:^|\s)clave(?:\s|$) para palabras completas
    if (new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(desc) || desc === claveN) {
      return categoria
    }
  }
  return null
}

function aprenderCategoria(descripcion, categoria) {
  const aprendizaje = cargarAprendizaje()
  // Guardar palabras clave de la descripción (no toda la frase)
  const palabras = descripcion.toLowerCase().split(' ').filter(p => p.length > 3)
  for (const palabra of palabras) {
    if (!aprendizaje[palabra]) {
      aprendizaje[palabra] = categoria
    }
  }
  // También guardar la descripción completa en minúsculas
  aprendizaje[descripcion.toLowerCase()] = categoria
  guardarAprendizaje(aprendizaje)
  console.log(`[APRENDIZAJE] "${descripcion}" → ${categoria}`)
}

// Borra del aprendizaje todas las entradas que contengan la palabra clave
function olvidarAprendizaje(clave) {
  const aprendizaje = cargarAprendizaje()
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const claveN = norm(clave)
  const antes = Object.keys(aprendizaje).length
  for (const k of Object.keys(aprendizaje)) {
    if (norm(k).includes(claveN)) delete aprendizaje[k]
  }
  guardarAprendizaje(aprendizaje)
  return antes - Object.keys(aprendizaje).length  // cuántas se borraron
}

// ─── ESTADO PENDIENTE ────────────────────────────────────────
function cargarPendientes() {
  try { return JSON.parse(fs.readFileSync(PENDIENTE_FILE, 'utf-8')) }
  catch { return {} }
}

function guardarPendientes(p) {
  if (!fs.existsSync(GASTOS_DIR)) fs.mkdirSync(GASTOS_DIR, { recursive: true })
  fs.writeFileSync(PENDIENTE_FILE, JSON.stringify(p, null, 2))
}

function setPendiente(grupoId, datos, remitente, archivoExcel, tipo = 'categoria') {
  const pendientes = cargarPendientes()
  pendientes[grupoId] = { datos, remitente, archivoExcel, tipo, timestamp: Date.now() }
  guardarPendientes(pendientes)
}

function getPendiente(grupoId) {
  const pendientes = cargarPendientes()
  const p = pendientes[grupoId]
  if (!p) return null
  // Expira en 10 minutos
  if (Date.now() - p.timestamp > 10 * 60 * 1000) {
    delete pendientes[grupoId]
    guardarPendientes(pendientes)
    return null
  }
  return p
}

function borrarPendiente(grupoId) {
  const pendientes = cargarPendientes()
  delete pendientes[grupoId]
  guardarPendientes(pendientes)
}

// ─── ESTADO PENDIENTE DE PERÍODO (resumen sin período) ───────
const PENDIENTE_PERIODO_FILE = path.join(GASTOS_DIR, 'pendiente_periodo.json')

function setPendientePeriodo(grupoId, consultaParcial) {
  let p = {}
  try { p = JSON.parse(fs.readFileSync(PENDIENTE_PERIODO_FILE, 'utf-8')) } catch {}
  p[grupoId] = { consulta: consultaParcial, timestamp: Date.now() }
  fs.writeFileSync(PENDIENTE_PERIODO_FILE, JSON.stringify(p, null, 2))
}

function getPendientePeriodo(grupoId) {
  try {
    const p = JSON.parse(fs.readFileSync(PENDIENTE_PERIODO_FILE, 'utf-8'))
    const e = p[grupoId]
    if (!e) return null
    if (Date.now() - e.timestamp > 5 * 60 * 1000) { // expira en 5 min
      delete p[grupoId]
      fs.writeFileSync(PENDIENTE_PERIODO_FILE, JSON.stringify(p, null, 2))
      return null
    }
    return e.consulta
  } catch { return null }
}

function borrarPendientePeriodo(grupoId) {
  try {
    const p = JSON.parse(fs.readFileSync(PENDIENTE_PERIODO_FILE, 'utf-8'))
    delete p[grupoId]
    fs.writeFileSync(PENDIENTE_PERIODO_FILE, JSON.stringify(p, null, 2))
  } catch {}
}

// ─── ESTADO PENDIENTE DE ACCIÓN (confirmación borrar/corregir) ──
const PENDIENTE_ACCION_FILE = path.join(GASTOS_DIR, 'pendiente_accion.json')

function setPendienteAccion(grupoId, accion) {
  let p = {}
  try { p = JSON.parse(fs.readFileSync(PENDIENTE_ACCION_FILE, 'utf-8')) } catch {}
  p[grupoId] = { ...accion, timestamp: Date.now() }
  fs.writeFileSync(PENDIENTE_ACCION_FILE, JSON.stringify(p, null, 2))
}

function getPendienteAccion(grupoId) {
  try {
    const p = JSON.parse(fs.readFileSync(PENDIENTE_ACCION_FILE, 'utf-8'))
    const e = p[grupoId]
    if (!e) return null
    if (Date.now() - e.timestamp > 5 * 60 * 1000) {
      delete p[grupoId]
      fs.writeFileSync(PENDIENTE_ACCION_FILE, JSON.stringify(p, null, 2))
      return null
    }
    return e
  } catch { return null }
}

function borrarPendienteAccion(grupoId) {
  try {
    const p = JSON.parse(fs.readFileSync(PENDIENTE_ACCION_FILE, 'utf-8'))
    delete p[grupoId]
    fs.writeFileSync(PENDIENTE_ACCION_FILE, JSON.stringify(p, null, 2))
  } catch {}
}

// ─── GROQ CON REINTENTOS ─────────────────────────────────────
async function llamarGroq(messages, intentos = 3, demora = 3000) {
  for (let i = 1; i <= intentos; i++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages,
          temperature: 0.3,
          max_tokens: 500,
        }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const data = await res.json()
      if (res.status === 503 || res.status === 429) {
        console.log(`[Groq] Limite (${res.status}), reintento ${i}/${intentos}...`)
        if (i < intentos) await new Promise(r => setTimeout(r, demora))
        continue
      }
      return { res, data }
    } catch (err) {
      console.error(`[Groq] Error red intento ${i}:`, err.message)
      if (i < intentos) await new Promise(r => setTimeout(r, demora))
    }
  }
  return null
}

// ─── TRANSCRIBIR AUDIO ───────────────────────────────────────
async function transcribirAudio(media) {
  try {
    const buffer = Buffer.from(media.data, 'base64')
    const ext    = media.mimetype.includes('ogg') ? 'ogg' : 'mp4'
    const blob   = new Blob([buffer], { type: media.mimetype })
    const form   = new FormData()
    form.append('file',     blob, `audio.${ext}`)
    form.append('model',    'whisper-large-v3-turbo')
    form.append('language', 'es')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    const res = await fetch(GROQ_AUDIO_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` },
      body: form,
      signal: controller.signal,
    })
    clearTimeout(timeout)
    const data = await res.json()
    let texto = data.text || null
    if (texto) texto = corregirTranscripcion(texto)
    return texto
  } catch (err) {
    console.error('[GASTOS] Error transcribiendo audio:', err.message)
    return null
  }
}

// ─── CORRECCIONES DE TRANSCRIPCIÓN (errores conocidos de Whisper) ─
// Agrega aquí palabras que Whisper confunde con frecuencia
const CORRECCIONES_WHISPER = [
  [/\bSVG\b/gi,         'SBG'],
  [/\bSBG\s+corporation/gi, 'SBG Corporation'],
]
function corregirTranscripcion(texto) {
  for (const [patron, reemplazo] of CORRECCIONES_WHISPER) {
    texto = texto.replace(patron, reemplazo)
  }
  return texto
}

// ─── EXTRAER DATOS DEL GASTO ─────────────────────────────────
async function extraerDatosGasto(texto) {
  const messages = [{
    role: 'user',
    content: `Eres un asistente que registra gastos personales en Colombia. Interpreta CUALQUIER mensaje en español colombiano informal y extrae el gasto, así esté mal escrito, use jerga o sea una frase larga.

MONTOS — usar siempre el número exacto que da el usuario, sin conversiones:
- Tomar el número tal cual como está escrito (960 = 960, 45000 = 45000, 1500000 = 1500000)
- "pesos" se ignora
- Si no hay número claro → {"error":"no_entendido"}

CATEGORÍAS:
- Hogar: mercado, domicilios de comida, arriendo, servicios (agua/luz/gas/internet), salud prepagada, farmacia, médico, aseo, limpieza, gasolina, taxi, Uber, bus, parqueadero, peaje, SOAT, taller
- Hijos: colegio, guardería, útiles, libros, cuadernos, colores, mochila, uniforme, Salvador, Violeta, pediatra, ropa niños, zapatos niños, juguetes — TODO lo que diga "hijos" va aquí
  → subcategoria "Salvador": si menciona solo a Salvador (bicicleta salvador, tenis salvador, cuadernos salvador)
  → subcategoria "Violeta": si menciona solo a Violeta (ropa violeta, zapatos violeta, violeta necesitaba)
  → subcategoria "Ambos": si menciona ambos nombres, o dice "los niños", "los hijos", "los dos", "ambos", o es un gasto sin nombre específico como "colegio niños", "uniforme", "matrícula", "libros hijos", "útiles"
- Ocio: restaurante, almuerzo/cena fuera, bar, café, trago, cerveza, cine, viaje, hotel, peluquería, motilada, deporte, pádel, rumba, gym, gimnasio, entretenimiento
- Otros: si no encaja claramente en ninguna

DESCRIPCIÓN: escribe algo natural y descriptivo, no solo la palabra clave. Ej: "Almuerzo en el centro", "Gasolina full tank", "Cerveza con amigos"

TIPO: "gasto" por defecto. "ingreso" solo si claramente recibió plata (le pagaron, consignaron, etc.)

Si el mensaje es una instrucción para borrar, corregir o modificar algo (borra, elimina, era X no Y, estaba mal, cambia, etc.) → {"error":"no_entendido"}
Si NO hay ninguna referencia a dinero o monto → {"error":"no_entendido"}

EJEMPLOS:
- "almorcé en el centro, 15000" → {"tipo":"gasto","monto":15000,"categoria":"Ocio","subcategoria":null,"descripcion":"Almuerzo en el centro"}
- "gym, 80000" → {"tipo":"gasto","monto":80000,"categoria":"Ocio","subcategoria":null,"descripcion":"Gimnasio"}
- "arriendo, 2500000" → {"tipo":"gasto","monto":2500000,"categoria":"Hogar","subcategoria":null,"descripcion":"Arriendo"}
- "útiles salvador, 45000" → {"tipo":"gasto","monto":45000,"categoria":"Hijos","subcategoria":"Salvador","descripcion":"Útiles escolares Salvador"}
- "consignaron arriendo local, 800000" → {"tipo":"ingreso","monto":800000,"categoria":"Otros","subcategoria":null,"descripcion":"Arriendo local recibido"}
- "zapatos violeta colegio, 120000" → {"tipo":"gasto","monto":120000,"categoria":"Hijos","subcategoria":"Violeta","descripcion":"Zapatos colegio Violeta"}
- "gasolina, 180000" → {"tipo":"gasto","monto":180000,"categoria":"Hogar","subcategoria":null,"descripcion":"Gasolina"}
- "colegio niños, 800000" → {"tipo":"gasto","monto":800000,"categoria":"Hijos","subcategoria":"Ambos","descripcion":"Colegio niños"}
- "matricula, 2000000" → {"tipo":"gasto","monto":2000000,"categoria":"Hijos","subcategoria":"Ambos","descripcion":"Matrícula"}

FECHA DEL EVENTO (fechaAbono): si el mensaje menciona una fecha específica ("el 22 de diciembre", "el lunes", "ayer", "el 5"), extráela en formato DD/MM/YYYY usando el año actual (${new Date().getFullYear()}). Si no menciona fecha → null.

Mensaje: "${texto.replace(/"/g, "'")}"

Responde SOLO con JSON válido (incluye siempre los campos "subcategoria" y "fechaAbono"):
Ejemplo con fecha: {"tipo":"gasto","monto":200000,"categoria":"Hogar","subcategoria":null,"descripcion":"Abono SBG Corporation","fechaAbono":"22/12/2026"}
Ejemplo sin fecha: {"tipo":"gasto","monto":200000,"categoria":"Hogar","subcategoria":null,"descripcion":"Abono SBG Corporation","fechaAbono":null}`,
  }]

  try {
    const resultado = await llamarGroq(messages)
    if (!resultado) return { error: 'fallo_tecnico' }
    const respuesta = resultado?.data?.choices?.[0]?.message?.content || ''
    const json = respuesta.replace(/```json\n?|\n?```/g, '').trim()
    if (!json) return { error: 'fallo_tecnico' }
    return JSON.parse(json)
  } catch (err) {
    console.error('[GASTOS] Error extrayendo datos:', err.message)
    return { error: 'fallo_tecnico' }
  }
}

// ─── DATOS PLANOS (JSON) + EXCEL FORMATEADO ──────────────────
const ORDEN_CATEGORIAS = ['Hogar', 'Hijos', 'Ocio', 'Otros']

function archivoData(archivoExcel) {
  return archivoExcel.replace('.xlsx', '_data.json')
}

function cargarDatos(archivoExcel) {
  try { return JSON.parse(fs.readFileSync(archivoData(archivoExcel), 'utf-8')) }
  catch { return [] }
}

function guardarDatos(lista, archivoExcel) {
  fs.writeFileSync(archivoData(archivoExcel), JSON.stringify(lista, null, 2))
}

async function regenerarExcel(archivoExcel) {
  const lista = cargarDatos(archivoExcel)
  const wb    = new ExcelJS.Workbook()
  const esAbono = lista.length > 0 && (lista[0].categoria === 'Abono' || lista[0].categoria === 'Pagos')
        || archivoExcel.includes('stella') || archivoExcel.includes('juancho') || archivoExcel.includes('felipe_pagos') || archivoExcel.includes('jorge_verificacion_pagos')

  const ws    = wb.addWorksheet(esAbono ? 'Abonos' : 'Gastos')

  if (esAbono) {
    ws.columns = [
      { key: 'num',        width: 5  },
      { key: 'fechaAbono', width: 14 },
      { key: 'monto',      width: 16 },
      { key: 'desc',       width: 32 },
      { key: 'reg',        width: 18 },
    ]
    const hdr = ws.addRow(['#', 'Fecha pago', 'Monto', 'Descripción', 'Registrado por'])
    hdr.eachCell(c => {
      c.font      = { bold: true, color: { argb: 'FFFFFFFF' } }
      c.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }
      c.alignment = { horizontal: 'center', vertical: 'middle' }
      c.border    = { bottom: { style: 'thin', color: { argb: 'FF2E75B6' } } }
    })
    hdr.height = 20
    let total = 0
    for (const e of lista) {
      const row = ws.addRow([e.numero || '', e.fechaAbono || '', e.monto, e.descripcion, e.remitente])
      row.getCell(1).font      = { color: { argb: 'FF9E9E9E' }, size: 9 }
      row.getCell(1).alignment = { horizontal: 'center' }
      row.getCell(2).alignment = { horizontal: 'center' }
      row.getCell(3).numFmt    = '"$"#,##0'
      row.getCell(3).font      = { color: { argb: 'FF375623' } }
      total += e.monto
    }
    // Fila total
    const totRow = ws.addRow(['', '', total, 'TOTAL', ''])
    totRow.getCell(3).numFmt = '"$"#,##0'
    totRow.getCell(3).font   = { bold: true }
    totRow.getCell(3).border = { top: { style: 'medium' } }
    totRow.getCell(4).font   = { bold: true }
    ;[2,3,4].forEach(i => totRow.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } })
    try { await wb.xlsx.writeFile(archivoExcel) } catch (err) { if (err.code === 'EBUSY') throw new Error('EXCEL_ABIERTO'); throw err }
    return
  }

  ws.columns = [
    { key: 'num',   width: 5  },
    { key: 'cat',   width: 14 },
    { key: 'desc',  width: 32 },
    { key: 'monto', width: 16 },
    { key: 'fecha', width: 12 },
    { key: 'hora',  width: 12 },
    { key: 'reg',   width: 18 },
  ]

  // Header
  const hdr = ws.addRow(['#', 'Categoría', 'Descripción', 'Monto', 'Fecha', 'Hora', 'Registrado por'])
  hdr.eachCell(c => {
    c.font      = { bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }
    c.alignment = { horizontal: 'center', vertical: 'middle' }
    c.border    = { bottom: { style: 'thin', color: { argb: 'FF2E75B6' } } }
  })
  hdr.height = 20

  // Agrupar por categoría
  const grupos = {}
  for (const d of lista) {
    if (!grupos[d.categoria]) grupos[d.categoria] = []
    grupos[d.categoria].push(d)
  }
  const cats = [
    ...ORDEN_CATEGORIAS.filter(c => grupos[c]),
    ...Object.keys(grupos).filter(c => !ORDEN_CATEGORIAS.includes(c)),
  ]

  let totalGeneral = 0

  for (const cat of cats) {
    const entradas = grupos[cat]

    if (cat === 'Hijos') {
      // ── Sub-agrupar Hijos por subcategoría ──────────────────
      const ORDEN_SUB = ['Salvador', 'Violeta', 'Ambos']
      const subgrupos = {}
      for (const e of entradas) {
        const sub = e.subcategoria || 'Ambos'
        if (!subgrupos[sub]) subgrupos[sub] = []
        subgrupos[sub].push(e)
      }
      const subs = [
        ...ORDEN_SUB.filter(s => subgrupos[s]),
        ...Object.keys(subgrupos).filter(s => !ORDEN_SUB.includes(s)),
      ]

      let subtotalHijos = 0
      let primeraFilaHijos = true

      for (const sub of subs) {
        let subtotalSub = 0

        for (const e of subgrupos[sub]) {
          const row = ws.addRow([
            e.numero || '',
            primeraFilaHijos ? cat : '',
            e.descripcion,
            e.monto,
            e.fecha,
            e.hora,
            e.remitente,
          ])
          row.getCell(1).font      = { color: { argb: 'FF9E9E9E' }, size: 9 }
          row.getCell(1).alignment = { horizontal: 'center' }
          if (primeraFilaHijos) {
            row.getCell(2).font      = { bold: true }
            row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' }
          }
          row.getCell(3).font = { color: { argb: e.monto < 0 ? 'FFC00000' : 'FF375623' } }
          row.getCell(4).numFmt = '"$"#,##0'
          subtotalSub   += e.monto
          subtotalHijos += e.monto
          totalGeneral  += e.monto
          primeraFilaHijos = false
        }

        // Fila subtotal subcategoría
        const subRow = ws.addRow(['', sub, '', subtotalSub, '', '', ''])
        subRow.getCell(2).font      = { italic: true, color: { argb: 'FF404040' } }
        subRow.getCell(2).alignment = { horizontal: 'right' }
        subRow.getCell(4).numFmt   = '"$"#,##0'
        subRow.getCell(4).font     = { italic: true, bold: true }
        subRow.getCell(4).border   = { top: { style: 'thin', color: { argb: 'FFAAAAAA' } } }
        ;[2,3,4].forEach(i => {
          subRow.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
        })

        ws.addRow([])
      }

      // Fila total Hijos
      const totHijos = ws.addRow(['', '', 'TOTAL HIJOS', subtotalHijos, '', '', ''])
      totHijos.getCell(3).font = { bold: true }
      totHijos.getCell(4).numFmt = '"$"#,##0'
      totHijos.getCell(4).font   = { bold: true }
      totHijos.getCell(4).border = { top: { style: 'medium' } }
      ;[2,3,4].forEach(i => {
        totHijos.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF6' } }
      })

      // Línea divisoria
      ws.addRow([])
      const sepHijos = ws.addRow(['', '', '', '', '', ''])
      sepHijos.eachCell(c => {
        c.border = { bottom: { style: 'medium', color: { argb: 'FF9E9E9E' } } }
      })
      ws.addRow([])

    } else {
      // ── Otras categorías: mismo estilo que Hijos ─────────────
      let subtotal    = 0
      let primeraFila = true

      for (const e of entradas) {
        const row = ws.addRow([
          e.numero || '',
          primeraFila ? cat : '',
          e.descripcion,
          e.monto,
          e.fecha,
          e.hora,
          e.remitente,
        ])
        row.getCell(1).font      = { color: { argb: 'FF9E9E9E' }, size: 9 }
        row.getCell(1).alignment = { horizontal: 'center' }
        if (primeraFila) {
          row.getCell(2).font      = { bold: true }
          row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' }
        }
        row.getCell(3).font = { color: { argb: e.monto < 0 ? 'FFC00000' : 'FF375623' } }
        row.getCell(4).numFmt = '"$"#,##0'
        subtotal     += e.monto
        totalGeneral += e.monto
        primeraFila   = false
      }

      // Fila TOTAL [CATEGORÍA] — mismo estilo morado que Hijos
      const totCat = ws.addRow(['', '', `TOTAL ${cat.toUpperCase()}`, subtotal, '', '', ''])
      totCat.getCell(3).font = { bold: true }
      totCat.getCell(4).numFmt = '"$"#,##0'
      totCat.getCell(4).font   = { bold: true }
      totCat.getCell(4).border = { top: { style: 'medium' } }
      ;[2,3,4].forEach(i => {
        totCat.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF6' } }
      })

      // Línea divisoria visible entre categorías
      ws.addRow([])
      const sep = ws.addRow(['', '', '', '', '', ''])
      sep.eachCell(c => {
        c.border = { bottom: { style: 'medium', color: { argb: 'FF9E9E9E' } } }
      })
      ws.addRow([])
    }
  }

  // Fila TOTAL ACUMULADO
  const tot = ws.addRow(['', '', 'TOTAL ACUMULADO', totalGeneral, '', '', ''])
  tot.getCell(3).font = { bold: true, size: 11 }
  tot.getCell(4).numFmt = '"$"#,##0'
  tot.getCell(4).font   = { bold: true, size: 11 }
  tot.getCell(4).border = { top: { style: 'medium' } }
  ;[1,2,3,4,5,6,7].forEach(i => {
    tot.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } }
  })

  try {
    await wb.xlsx.writeFile(archivoExcel)
  } catch (err) {
    if (err.code === 'EBUSY') throw new Error('EXCEL_ABIERTO')
    throw err
  }
}

async function guardarEnExcel(datos, remitente, archivoExcel) {
  if (!fs.existsSync(GASTOS_DIR)) fs.mkdirSync(GASTOS_DIR, { recursive: true })

  const now   = new Date()
  const monto = datos.tipo === 'gasto' ? -Math.abs(datos.monto) : Math.abs(datos.monto)

  const lista = cargarDatos(archivoExcel)
  const numero = lista.length > 0 ? Math.max(...lista.map(e => e.numero || 0)) + 1 : 1
  const entrada = {
    id:           Date.now().toString(),
    numero,
    fecha:        now.toLocaleDateString('es-CO'),
    hora:         now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    tipo:         datos.tipo,
    monto,
    categoria:    datos.categoria,
    subcategoria: datos.subcategoria || null,
    descripcion:  datos.descripcion,
    fechaAbono:   datos.fechaAbono || null,
    remitente,
  }
  lista.push(entrada)
  guardarDatos(lista, archivoExcel)
  await regenerarExcel(archivoExcel)

  datos._numero = numero
  console.log(`[GASTOS] ✅ #${numero} ${datos.tipo} $${Math.abs(datos.monto).toLocaleString('es-CO')} — ${datos.descripcion} [${datos.categoria}]`)

  // ── Espejo automático a Finanzas Priority ──────────────────
  const origenFinanzas = MIRROR_A_FINANZAS[archivoExcel]
  if (origenFinanzas) {
    try {
      const listaF  = cargarDatos(FINANZAS_PRIORITY_EXCEL)
      const numeroF = listaF.length > 0 ? Math.max(...listaF.map(e => e.numero || 0)) + 1 : 1
      listaF.push({
        ...entrada,
        id:          (Date.now() + 1).toString(),
        numero:      numeroF,
        descripcion: `[${origenFinanzas}] ${datos.descripcion}`,
      })
      guardarDatos(listaF, FINANZAS_PRIORITY_EXCEL)
      await regenerarExcel(FINANZAS_PRIORITY_EXCEL)
      console.log(`[FINANZAS] ✅ Espejo de ${origenFinanzas} → finanzas_priority #${numeroF}`)
    } catch (err) {
      console.error('[FINANZAS] Error espejo:', err.message)
    }
  }
}

// ─── CONFIRMAR Y GUARDAR ─────────────────────────────────────
// ─── REENVIAR COMPROBANTE (número directo o grupo por nombre) ──
// destino: número string "573146425027" | { grupo: "pago stella / valen ai" }
async function enviarComprobante(grupoId, destino, nombre, textoDestino = null) {
  const guardada = lastImagePerGroup[grupoId]
  if (!guardada) {
    await client.sendMessage(grupoId, '⚠️ Gasto guardado, pero no encontré ningún comprobante. Envíe primero la imagen y luego el audio.')
    return
  }
  if (Date.now() - guardada.timestamp > 20 * 60 * 1000) {
    await client.sendMessage(grupoId, '⚠️ La imagen del comprobante expiró (más de 20 min). Envíela de nuevo junto con el audio.')
    return
  }
  try {
    const media = await guardada.msg.downloadMedia()
    if (!media?.data) return

    // Resolver chat destino
    let chatIdDestino
    if (typeof destino === 'string') {
      // número directo (ej "573146425027")
      chatIdDestino = destino + '@c.us'
    } else if (destino?.grupo) {
      const chats = await client.getChats()
      const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
      const g = chats.find(c => c.isGroup && norm(c.name).includes(norm(destino.grupo)))
      if (!g) { await client.sendMessage(grupoId, `⚠️ No encontré el grupo "${destino.grupo}".`); return }
      chatIdDestino = g.id._serialized
    }

    // Reenviar imagen con whatsapp-web.js MessageMedia
    const mediaWA = new MessageMedia(media.mimetype || 'image/jpeg', media.data, 'comprobante.jpg')
    await client.sendMessage(chatIdDestino, mediaWA, { caption: '📎 Comprobante de pago' })
    delete lastImagePerGroup[grupoId]
    console.log(`[COMPROBANTE] Enviado a ${nombre}`)
    if (nombre) await client.sendMessage(grupoId, `✅ Comprobante enviado a ${nombre}.`)
    if (textoDestino) await client.sendMessage(chatIdDestino, textoDestino)
  } catch (err) {
    console.error('[COMPROBANTE] Error:', err.message)
  }
}


async function confirmarYGuardar(grupoId, datos, remitente, archivoExcel) {
  try {
    await guardarEnExcel(datos, remitente, archivoExcel)
  } catch (err) {
    if (err.message === 'EXCEL_ABIERTO')
      await client.sendMessage(grupoId, '⚠️ El archivo Excel está abierto. Ciérralo y reenvía el mensaje.')
    else {
      await client.sendMessage(grupoId, '⚠️ Error guardando. Intenta de nuevo.')
      console.error('[GASTOS] Error Excel:', err.message)
    }
    return
  }
  // ── Mensaje de confirmación ───────────────────────────────────
  if (datos.categoria === 'Abono') {
    const numTag   = datos._numero ? `#${datos._numero}` : ''
    const fechaTag = datos.fechaAbono ? `📂 ${datos.fechaAbono} · ${numTag}` : `📂 ${numTag}`
    await client.sendMessage(grupoId,
      `💸 *Abono registrado*\n\n` +
      `$${Math.abs(datos.monto).toLocaleString('es-CO')} — ${datos.descripcion}\n\n` +
      `${fechaTag}`
    )
  } else {
    const emoji  = datos.tipo === 'ingreso' ? '💰' : '💸'
    const signo  = datos.tipo === 'ingreso' ? '+' : '-'
    const subcat = (datos.categoria === 'Hijos' && datos.subcategoria) ? ` › ${datos.subcategoria}` : ''
    const numTag = datos._numero ? ` | #${datos._numero}` : ''
    await client.sendMessage(grupoId,
      `${emoji} *Gasto guardado*\n\n` +
      `${signo}$${Math.abs(datos.monto).toLocaleString('es-CO')} — ${datos.descripcion}\n\n` +
      `📂 ${datos.categoria}${subcat}${numTag}`
    )
  }

  // ── Espejo + comprobante por persona ─────────────────────────
  // TABLA MAESTRA: agregar aquí para sumar personas nuevas.
  // trigger(texto, excel): condición para activar
  // destino: número string → chat directo | { grupo: "..." } → grupo por nombre
  // excel: archivo donde se espeja el pago
  const PERSONAS_PAGO = [
    {
      nombre:  'Aura',
      trigger: (txt, xl) => /\baura\b/i.test(txt),
      destino: NUMERO_AURA,
      excel:   PAGOS_AURA_EXCEL,
    },
    {
      nombre:  'Chila',
      trigger: (txt, xl) => /\bchila\b/i.test(txt)
                         || (xl === FINANZAS_PRIORITY_EXCEL && /\bquincena\b/i.test(txt)),
      destino: NUMERO_CHILA,
      excel:   PAGOS_CHILA_EXCEL,
    },
    {
      nombre:  'Valen',
      trigger: (txt, xl) => /\bvalen\b/i.test(txt),
      destino: { grupo: 'pago stella / valen' },
      excel:   PAGOS_STELLA_VALEN_EXCEL,
    },
    {
      nombre:  'Beatriz',
      trigger: (txt, xl) => /\bbeatriz\b/i.test(txt),
      destino: NUMERO_BEATRIZ,
      excel:   PAGOS_BEATRIZ_EXCEL,
    },
    {
      nombre:  'Interrapidísimo',
      trigger: (txt, xl) => /\binterrapid/i.test(txt)
                         || (xl === FINANZAS_PRIORITY_EXCEL && /\binter\b/i.test(txt)),
      destino: { grupo: 'interrapidisimo envios priority' },
      excel:   PAGOS_INTER_EXCEL,
    },
    {
      nombre:  'Orlando',
      trigger: (txt, xl) => /\b(orlando|bedoya)\b/i.test(txt),
      destino: NUMERO_ORLANDO,
      excel:   PAGOS_ORLANDO_EXCEL,
    },
    {
      nombre:  'Magda',
      trigger: (txt, xl) => /\bmagda\b/i.test(txt),
      destino: NUMERO_MAGDA,
      excel:   PAGOS_MAGDA_EXCEL,
    },
    {
      nombre:  'Juan Carlos',
      trigger: (txt, xl) => /\b(juan\s+carlos|cuero\s+pelo)\b/i.test(txt),
      destino: NUMERO_JUANCARLOS,
      excel:   PAGOS_JUANCARLOS_EXCEL,
    },
    {
      nombre:  'Mauricio',
      trigger: (txt, xl) => /\b(mauricio|ammi)\b/i.test(txt),
      destino: NUMERO_MAURICIO,
      excel:   PAGOS_MAURICIO_EXCEL,
    },
    {
      nombre:  'Herrajes Pereira',
      trigger: (txt, xl) => /\bherrajes\b/i.test(txt),
      destino: NUMERO_HERRAJES,
      excel:   PAGOS_HERRAJES_EXCEL,
    },
  ]

  for (const persona of PERSONAS_PAGO) {
    if (!persona.trigger(datos.descripcion, archivoExcel)) continue
    // Espejo en su Excel (si no viene ya de ahí)
    try {
      if (archivoExcel !== persona.excel) {
        const lista = cargarDatos(persona.excel)
        const num   = lista.length > 0 ? Math.max(...lista.map(e => e.numero || 0)) + 1 : 1
        lista.push({ ...datos, id: Date.now().toString(), numero: num })
        guardarDatos(lista, persona.excel)
        await regenerarExcel(persona.excel)
      }
    } catch (err) { console.error(`[${persona.nombre.toUpperCase()}] Error espejo:`, err.message) }
    // Comprobante + confirmación
    const numTag = datos._numero ? ` | #${datos._numero}` : ''
    const textoConfirmacion = `✅ *Pago registrado*\n\n$${Math.abs(datos.monto).toLocaleString('es-CO')} — ${datos.descripcion}\n📂 ${datos.categoria}${numTag}`
    await enviarComprobante(grupoId, persona.destino, persona.nombre, textoConfirmacion)
  }
}

// ─── PARSEAR COMANDO DE EDICIÓN ──────────────────────────────
// Primero intenta regex directo (rápido y confiable), luego IA como respaldo
function parsearEdicionRapido(texto) {
  const t = texto.trim().toLowerCase()

  // ── BORRAR último ─────────────────────────────────────────
  if (/^(borra|elimina|quita|bórra|bórralo|elimínalo|elimínala)(lo|la)?\s*(el\s+)?(último|ultimo|ese|eso|este|esa|esta)?\.?$/i.test(t))
    return { accion: 'borrar', referencia: 'ultimo', valor_nuevo: null }
  if (/^(borra|elimina|quita)\s+(el\s+)?(último|ultimo)\.?$/i.test(t))
    return { accion: 'borrar', referencia: 'ultimo', valor_nuevo: null }
  if (/ese\s+(estab[ao]\s+mal|est[aá]\s+mal).*(bórra|borra|elimina)/i.test(t))
    return { accion: 'borrar', referencia: 'ultimo', valor_nuevo: null }
  if (/(bórra|borra|elimina)(lo|la)\s*$/i.test(t))
    return { accion: 'borrar', referencia: 'ultimo', valor_nuevo: null }

  // ── BORRAR por descripción: "elimina el de X" ─────────────
  const mBorrarDesc = t.match(/^(borra|elimina|quita)\s+(el|la|ese|esa)?\s*(de\s+|del\s+)?(.+)$/)
  if (mBorrarDesc) {
    const ref = mBorrarDesc[4].trim()
    if (ref && ref !== 'último' && ref !== 'ultimo' && ref !== 'ese' && ref.length > 2)
      return { accion: 'borrar', referencia: ref, valor_nuevo: null }
  }

  // ── BORRAR / CORREGIR por número: "borra el #5", "modificar numero 3", "el #8 era 32 no 320" ─
  const mNumRef = t.match(/#(\d+)/)
    || t.match(/\b(?:numero|gasto|el)\b\s+(?:numero\s+)?#?(\d+)/)
  if (mNumRef) {
    const numRef = '#' + mNumRef[1]
    // Corregir monto: "el #5 era 32 no 320"
    const mEraNum = t.match(/era\s+([\d.,]+)\s+(?:no|y\s+no|pero)\s+([\d.,]+)/i)
    if (mEraNum) {
      const correcto = parseInt(mEraNum[1].replace(/[.,]/g, ''))
      const monto = correcto < 500 ? correcto * 1000 : correcto
      return { accion: 'corregir_monto', referencia: numRef, valor_nuevo: monto }
    }
    // Borrar: "borra el #5", "elimina el #12"
    if (/(borra|elimina|quita|borrar|eliminar|borré|eliminé)/i.test(t))
      return { accion: 'borrar', referencia: numRef, valor_nuevo: null }
    // Cambiar categoría: "modificar el numero 3 a hogar", "el #5 va en ocio"
    const mCat = t.match(/\b(hogar|hijos|ocio|otros)\b/i)
    if (mCat && /(modific|cambia|correg|va en|mover|cambiar)/i.test(t))
      return { accion: 'corregir_categoria', referencia: numRef, valor_nuevo: mCat[1].charAt(0).toUpperCase() + mCat[1].slice(1).toLowerCase() }
  }

  // ── CORREGIR MONTO: "era 32 no 320" / "ese era 15 no 150" ─
  const mEra = t.match(/era\s+([\d.,]+)\s+(no|y\s+no|pero)\s+([\d.,]+)/i)
  if (mEra) {
    const correcto = parseInt(mEra[1].replace(/[.,]/g, ''))
    const monto = correcto < 500 ? correcto * 1000 : correcto
    return { accion: 'corregir_monto', referencia: 'ultimo', valor_nuevo: monto }
  }
  const mNoEra = t.match(/([\d.,]+)\s+no\s+era\s+([\d.,]+)/i)
  if (mNoEra) {
    const correcto = parseInt(mNoEra[1].replace(/[.,]/g, ''))
    const monto = correcto < 500 ? correcto * 1000 : correcto
    return { accion: 'corregir_monto', referencia: 'ultimo', valor_nuevo: monto }
  }

  return null  // no entendido por regex → intentar con IA
}

async function parsearEdicion(texto) {
  // 1. Intentar regex rápido primero
  const rapido = parsearEdicionRapido(texto)
  if (rapido) {
    console.log(`[EDICION] Regex rápido: ${JSON.stringify(rapido)}`)
    return rapido
  }

  // 2. Fallback a IA
  const messages = [{
    role: 'user',
    content: `Interpreta este mensaje. El usuario quiere borrar o corregir un gasto ya registrado. Devuelve JSON.

ACCIONES:
- "borrar": eliminar un registro
- "corregir_monto": cambiar el monto
- "corregir_categoria": cambiar la categoría (Hogar/Hijos/Ocio/Otros)
- "corregir_descripcion": cambiar la descripción
- "no_es_edicion": si no es sobre editar/borrar un gasto

CAMPOS:
- "accion": una de las de arriba
- "referencia": "ultimo" si habla del último/ese/eso/ese último | o texto descriptivo (ej: "gasolina", "cerveza")
- "valor_nuevo": nuevo valor si aplica, null si es borrar

EJEMPLOS (memorizarlos bien):
- "elimina el último" → {"accion":"borrar","referencia":"ultimo","valor_nuevo":null}
- "borra el último" → {"accion":"borrar","referencia":"ultimo","valor_nuevo":null}
- "borra ese" → {"accion":"borrar","referencia":"ultimo","valor_nuevo":null}
- "ese estaba mal bórralo" → {"accion":"borrar","referencia":"ultimo","valor_nuevo":null}
- "quita ese" → {"accion":"borrar","referencia":"ultimo","valor_nuevo":null}
- "elimina el de gasolina" → {"accion":"borrar","referencia":"gasolina","valor_nuevo":null}
- "borra el gasto de cerveza" → {"accion":"borrar","referencia":"cerveza","valor_nuevo":null}
- "ese era 32 no 320" → {"accion":"corregir_monto","referencia":"ultimo","valor_nuevo":32000}
- "era 15 no 150" → {"accion":"corregir_monto","referencia":"ultimo","valor_nuevo":15000}
- "cambia el de cerveza a 25000" → {"accion":"corregir_monto","referencia":"cerveza","valor_nuevo":25000}
- "ese va en ocio no en hogar" → {"accion":"corregir_categoria","referencia":"ultimo","valor_nuevo":"Ocio"}
- "cambia carpa para camping a ocio" → {"accion":"corregir_categoria","referencia":"carpa para camping","valor_nuevo":"Ocio"}
- "borra el #5" → {"accion":"borrar","referencia":"#5","valor_nuevo":null}
- "elimina el #12" → {"accion":"borrar","referencia":"#12","valor_nuevo":null}
- "el #8 era 32 no 320" → {"accion":"corregir_monto","referencia":"#8","valor_nuevo":32000}
- "el #3 va en hogar no en ocio" → {"accion":"corregir_categoria","referencia":"#3","valor_nuevo":"Hogar"}
- "almorcé 15000" → {"accion":"no_es_edicion"}
- "gasolina 80000" → {"accion":"no_es_edicion"}

Mensaje: "${texto.replace(/"/g, "'")}"

Responde SOLO con JSON válido, sin explicaciones:`
  }]
  try {
    const resultado = await llamarGroq(messages)
    if (!resultado) return null
    const respuesta = resultado?.data?.choices?.[0]?.message?.content || ''
    const json = respuesta.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(json)
    console.log(`[EDICION] IA: ${JSON.stringify(parsed)}`)
    return parsed
  } catch { return null }
}

// ─── EJECUTAR EDICIÓN ────────────────────────────────────────
async function ejecutarEdicion(edicion, archivoExcel, grupoId) {
  const lista = cargarDatos(archivoExcel)
  if (!lista.length) {
    await client.sendMessage(grupoId, '❌ No hay gastos registrados aún.')
    return true
  }

  // Encontrar el registro
  let idx = -1
  if (edicion.referencia === 'ultimo') {
    idx = lista.length - 1
  } else if (/^#?\d+$/.test(edicion.referencia)) {
    // Buscar por número consecutivo: "#5", "44" (IA a veces devuelve sin #)
    const num = parseInt(edicion.referencia.replace('#', ''))
    idx = lista.findLastIndex(e => Number(e.numero) === num)
    if (idx < 0) {
      await client.sendMessage(grupoId, `❌ No encontré el gasto *#${num}*`)
      return true
    }
  } else if (/\d+/.test(edicion.referencia)) {
    // IA devolvió algo como "numero 3" o "3 de hijos" — extraer el número
    const numMatch = edicion.referencia.match(/\d+/)
    if (numMatch) {
      const num = parseInt(numMatch[0])
      idx = lista.findLastIndex(e => Number(e.numero) === num)
      if (idx < 0) {
        await client.sendMessage(grupoId, `❌ No encontré el gasto *#${num}*`)
        return true
      }
    }
  } else {
    const ref = edicion.referencia.toString().toLowerCase()
    // Buscar por descripción o monto
    idx = lista.findLastIndex(e =>
      e.descripcion.toLowerCase().includes(ref) ||
      Math.abs(e.monto).toString().includes(ref.replace(/\./g, ''))
    )
  }

  if (idx < 0) {
    await client.sendMessage(grupoId, `❌ No encontré ningún gasto que coincida con _"${edicion.referencia}"_`)
    return true
  }

  const entrada = lista[idx]

  if (edicion.accion === 'borrar') {
    await pedirConfirmacion(grupoId, 'borrar', entrada, null, null, archivoExcel)
    return
  }

  if (edicion.accion === 'corregir_monto') {
    await pedirConfirmacion(grupoId, 'corregir_monto', entrada, edicion.valor_nuevo, null, archivoExcel)
    return
  }

  if (edicion.accion === 'corregir_categoria') {
    await pedirConfirmacion(grupoId, 'corregir_categoria', entrada, edicion.valor_nuevo, entrada.categoria, archivoExcel)
    return
  }

  if (edicion.accion === 'corregir_descripcion') {
    // Descripción se aplica directamente (no tiene riesgo de pérdida)
    const descAnterior = entrada.descripcion
    entrada.descripcion = edicion.valor_nuevo
    guardarDatos(lista, archivoExcel)
    await regenerarExcel(archivoExcel)
    const numTagD  = entrada.numero ? ` #${entrada.numero}` : ''
    const montoTagD = `$${Math.abs(entrada.monto).toLocaleString('es-CO')}`
    await client.sendMessage(grupoId,
      `✅ *Corregido${numTagD}*\n\n_${descAnterior}_ → *${entrada.descripcion}*\n${montoTagD}`
    )
  }
}

// ─── CONFIRMACIÓN PREVIA A BORRAR/CORREGIR ───────────────────
async function pedirConfirmacion(grupoId, accion, entrada, valorNuevo, catAnterior, archivoExcel) {
  setPendienteAccion(grupoId, { accion, entradaId: entrada.id, valorNuevo, catAnterior, archivoExcel })
  const numPart   = entrada.numero ? `*#${entrada.numero}*` : ''
  const montoPart = `$${Math.abs(entrada.monto).toLocaleString('es-CO')}`
  const opciones  = `\n\n1️⃣ Sí\n2️⃣ No`
  let msg = ''
  if (accion === 'borrar') {
    msg = `🗑️ ¿Confirmas borrar?\n\n${numPart}\n${entrada.descripcion}\n${montoPart}`
  } else if (accion === 'corregir_monto') {
    msg = `✏️ ¿Confirmas corregir?\n\n${numPart}\n${entrada.descripcion}\n${montoPart} → *$${Math.abs(valorNuevo).toLocaleString('es-CO')}*`
  } else if (accion === 'corregir_categoria') {
    msg = `✏️ ¿Confirmas cambiar categoría?\n\n${numPart}\n${entrada.descripcion}\n${catAnterior} → *${valorNuevo}*`
  }
  await client.sendMessage(grupoId, msg + opciones)
}

async function ejecutarAccionConfirmada(pendAccion, grupoId) {
  const { accion, entradaId, valorNuevo, catAnterior, archivoExcel } = pendAccion
  const lista = cargarDatos(archivoExcel)
  const idx   = lista.findIndex(e => e.id === entradaId)
  if (idx < 0) {
    await client.sendMessage(grupoId, '❌ Ya no encontré ese gasto, quizás fue modificado antes.')
    return
  }
  const entrada = lista[idx]

  try {
    if (accion === 'borrar') {
      lista.splice(idx, 1)
      guardarDatos(lista, archivoExcel)
      await regenerarExcel(archivoExcel)
      const numTag = entrada.numero ? ` #${entrada.numero}` : ''
      await client.sendMessage(grupoId,
        `🗑️ *Borrado${numTag}*\n\n${entrada.descripcion} — $${Math.abs(entrada.monto).toLocaleString('es-CO')}`)
    } else if (accion === 'corregir_monto') {
      const anterior = entrada.monto
      entrada.monto  = entrada.monto < 0 ? -Math.abs(valorNuevo) : Math.abs(valorNuevo)
      guardarDatos(lista, archivoExcel)
      await regenerarExcel(archivoExcel)
      const numTagM = entrada.numero ? ` #${entrada.numero}` : ''
      await client.sendMessage(grupoId,
        `✅ *Corregido${numTagM}*\n\n${entrada.descripcion}\n$${Math.abs(anterior).toLocaleString('es-CO')} → *$${Math.abs(entrada.monto).toLocaleString('es-CO')}*`)
    } else if (accion === 'corregir_categoria') {
      entrada.categoria = valorNuevo
      guardarDatos(lista, archivoExcel)
      await regenerarExcel(archivoExcel)
      aprenderCategoria(entrada.descripcion, valorNuevo)
      const numTagC  = entrada.numero ? ` #${entrada.numero}` : ''
      const montoTagC = `$${Math.abs(entrada.monto).toLocaleString('es-CO')}`
      await client.sendMessage(grupoId,
        `✅ *Corregido${numTagC}*\n\n${entrada.descripcion} — ${montoTagC}\n${catAnterior} → *${entrada.categoria}*`)
    }
  } catch (err) {
    if (err.message === 'EXCEL_ABIERTO') {
      // Revertir cambios en el JSON para no perder datos
      const listaOriginal = cargarDatos(archivoExcel)
      if (accion === 'borrar') {
        listaOriginal.splice(idx, 0, entrada)  // restaurar entrada borrada
        guardarDatos(listaOriginal, archivoExcel)
      }
      await client.sendMessage(grupoId, '⚠️ El archivo Excel está abierto. Ciérralo e intenta de nuevo.')
    } else {
      await client.sendMessage(grupoId, '⚠️ Error ejecutando la acción. Intenta de nuevo.')
      console.error('[ACCION] Error:', err.message)
    }
  }
}

// ─── CORREGIR CATEGORIA ──────────────────────────────────────
async function corregirCategoria(descripcionBuscar, nuevaCategoria, archivoExcel) {
  const lista = cargarDatos(archivoExcel)
  if (!lista.length) return { ok: false, msg: 'No hay gastos registrados aún.' }

  let entrada
  if (descripcionBuscar === 'ultimo') {
    entrada = lista[lista.length - 1]
  } else {
    const buscar = descripcionBuscar.toLowerCase()
    entrada = lista.slice().reverse().find(e => e.descripcion.toLowerCase().includes(buscar))
  }
  if (!entrada) return { ok: false, msg: `No encontré ningún gasto con "${descripcionBuscar}".` }

  const anterior = entrada.categoria
  entrada.categoria = nuevaCategoria
  guardarDatos(lista, archivoExcel)

  try {
    await regenerarExcel(archivoExcel)
  } catch (err) {
    if (err.code === 'EBUSY') return { ok: false, msg: 'El archivo Excel está abierto. Ciérralo e intenta de nuevo.' }
    throw err
  }

  aprenderCategoria(entrada.descripcion, nuevaCategoria)
  console.log(`[CORRECCIÓN] "${entrada.descripcion}": ${anterior} → ${nuevaCategoria}`)
  return { ok: true, descripcion: entrada.descripcion, anterior, nueva: nuevaCategoria }
}

// ─── PARSEAR RANGO DE FECHAS CON IA ──────────────────────────
async function parsearConsultaResumen(texto) {
  const ahora  = new Date()
  const hoy    = ahora.toISOString().split('T')[0]
  const diaNum = ahora.getDay() // 0=dom, 1=lun...

  // Calcular fechas útiles para dar contexto al modelo
  const hace = (n) => {
    const d = new Date(ahora); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]
  }
  const inicioMes  = `${ahora.getFullYear()}-${String(ahora.getMonth()+1).padStart(2,'0')}-01`
  const finMes     = new Date(ahora.getFullYear(), ahora.getMonth()+1, 0).toISOString().split('T')[0]
  // Lunes de esta semana
  const diasDesdelunes = diaNum === 0 ? 6 : diaNum - 1
  const lunesEsta  = hace(diasDesdelunes)
  // Sábado y domingo pasados (fin de semana anterior)
  const domingoAnt = hace(diaNum === 0 ? 0 : diaNum)
  const sabadoAnt  = hace(diaNum === 0 ? 1 : diaNum + 1)

  const messages = [{
    role: 'user',
    content: `Hoy es ${ahora.toLocaleDateString('es-CO', { weekday:'long', year:'numeric', month:'long', day:'numeric' })} (${hoy}).
Lunes de esta semana: ${lunesEsta}. Inicio del mes: ${inicioMes}. Fin del mes: ${finMes}.

Interpreta esta consulta de gastos y devuelve JSON con el rango de fechas.

CAMPOS:
- "fechaDesde": YYYY-MM-DD
- "fechaHasta": YYYY-MM-DD (inclusive, normalmente hoy o fin del período)
- "categoria": null | "Hogar" | "Hijos" | "Ocio" | "Otros"
- "descripcion": null o ítem específico (cerveza, gasolina, restaurante…)
- "subcategoria": null | "Salvador" | "Violeta" — solo si pregunta específicamente por uno de los hijos
- "titulo": etiqueta corta del período + filtro

REGLAS para calcular fechas:
- "últimos N días" → desde hace(N-1) hasta hoy
- "últimos N días de [categoría]" → igual con categoría
- "última semana" / "últimos 7 días" → hace(6) hasta hoy
- "últimos 5 días" → hace(4) hasta hoy
- "últimos 3 días" → hace(2) hasta hoy
- "esta semana" → desde lunes (${lunesEsta}) hasta hoy
- "semana pasada" → lunes anterior hasta domingo anterior
- "último fin de semana" → sábado(${sabadoAnt}) hasta domingo(${domingoAnt})
- "este mes" → ${inicioMes} hasta ${finMes}
- "mes pasado" → primer y último día del mes anterior
- "ayer" → ${hace(1)} hasta ${hace(1)}
- "hoy" → ${hoy} hasta ${hoy}
- "del 1 al 15 de abril" → fechas exactas mencionadas
- Nombre de mes solo → todo ese mes del año actual

EJEMPLOS (hoy = ${hoy}):
- "últimos 15 días" → {"fechaDesde":"${hace(14)}","fechaHasta":"${hoy}","categoria":null,"descripcion":null,"titulo":"Últimos 15 días"}
- "últimos 7 días" → {"fechaDesde":"${hace(6)}","fechaHasta":"${hoy}","categoria":null,"descripcion":null,"titulo":"Últimos 7 días"}
- "últimos 3 días" → {"fechaDesde":"${hace(2)}","fechaHasta":"${hoy}","categoria":null,"descripcion":null,"titulo":"Últimos 3 días"}
- "gasto de los hijos en los últimos 15 días" → {"fechaDesde":"${hace(14)}","fechaHasta":"${hoy}","categoria":"Hijos","descripcion":null,"titulo":"Hijos — Últimos 15 días"}
- "último fin de semana" → {"fechaDesde":"${sabadoAnt}","fechaHasta":"${domingoAnt}","categoria":null,"descripcion":null,"titulo":"Último fin de semana"}
- "esta semana" → {"fechaDesde":"${lunesEsta}","fechaHasta":"${hoy}","categoria":null,"descripcion":null,"titulo":"Esta semana"}
- "resumen del mes" → {"fechaDesde":"${inicioMes}","fechaHasta":"${finMes}","categoria":null,"descripcion":null,"titulo":"${ahora.toLocaleDateString('es-CO',{month:'long',year:'numeric'})}"}
- "hogar este mes" → {"fechaDesde":"${inicioMes}","fechaHasta":"${finMes}","categoria":"Hogar","descripcion":null,"titulo":"Hogar — este mes"}
- "cuánto he gastado en cerveza este mes" → {"fechaDesde":"${inicioMes}","fechaHasta":"${finMes}","categoria":null,"descripcion":"cerveza","titulo":"Cerveza — este mes"}
- "gastos de ayer" → {"fechaDesde":"${hace(1)}","fechaHasta":"${hace(1)}","categoria":null,"descripcion":null,"subcategoria":null,"titulo":"Ayer"}
- "gastos de salvador este mes" → {"fechaDesde":"${inicioMes}","fechaHasta":"${finMes}","categoria":"Hijos","subcategoria":"Salvador","descripcion":null,"titulo":"Salvador — este mes"}
- "cuánto llevo en violeta" → {"fechaDesde":"${inicioMes}","fechaHasta":"${finMes}","categoria":"Hijos","subcategoria":"Violeta","descripcion":null,"titulo":"Violeta — este mes"}
- "cuánto he gastado en salvador los últimos 15 días" → {"fechaDesde":"${hace(14)}","fechaHasta":"${hoy}","categoria":"Hijos","subcategoria":"Salvador","descripcion":null,"titulo":"Salvador — últimos 15 días"}

SINÓNIMOS COLOMBIANOS — todos significan "cuánto he gastado":
- "le he metido X" = he gastado en X
- "cuánto va en X" = cuánto llevo en X
- "cómo voy en X" = resumen de X
- "cómo estoy en X" = resumen de X
- "en qué voy" = resumen general
- "cómo me ha ido" = resumen general
- "cuánto llevo" = resumen del período mencionado
- "por cuánto va" = cuánto llevo

Consulta: "${texto.replace(/"/g, "'")}"

Responde SOLO con JSON válido:`
  }]

  try {
    const resultado = await llamarGroq(messages)
    if (!resultado) return null
    const respuesta = resultado?.data?.choices?.[0]?.message?.content || ''
    const json = respuesta.replace(/```json\n?|\n?```/g, '').trim()
    return JSON.parse(json)
  } catch { return null }
}

// ─── RESUMEN FLEXIBLE ────────────────────────────────────────
async function obtenerResumen(archivoExcel, fechaDesde, fechaHasta, categoria = null, descripcion = null, subcategoria = null) {
  const lista = cargarDatos(archivoExcel)
  if (!lista.length) return null

  const desde   = new Date(fechaDesde + 'T00:00:00')
  const hasta   = new Date(fechaHasta + 'T23:59:59')
  const descFiltro = descripcion ? descripcion.toLowerCase() : null

  let totalGastos = 0, totalIngresos = 0, totalPropio = 0, totalCompartido = 0
  const porDescripcion = {}
  const porCategoria   = {}

  for (const e of lista) {
    const partes = e.fecha.split('/')
    const fechaE = new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]))
    if (fechaE < desde || fechaE > hasta) continue
    if (categoria  && e.categoria.toLowerCase()   !== categoria.toLowerCase())     continue
    if (descFiltro && !e.descripcion.toLowerCase().includes(descFiltro))           continue

    // Filtro y lógica de subcategoría para Hijos
    let factorMonto = 1
    if (subcategoria && e.categoria === 'Hijos') {
      if (e.subcategoria === subcategoria) {
        factorMonto = 1
      } else if (e.subcategoria === 'Ambos') {
        factorMonto = 0.5
        totalCompartido += Math.abs(e.monto) * 0.5  // ya dividido
      } else {
        continue
      }
    } else if (subcategoria && e.categoria !== 'Hijos') {
      continue
    }

    const monto = Math.abs(e.monto) * factorMonto
    if (e.tipo === 'gasto') {
      totalGastos += monto
      if (subcategoria && factorMonto === 1) totalPropio += monto
      porCategoria[e.categoria]     = (porCategoria[e.categoria]     || 0) + monto
      porDescripcion[e.descripcion] = (porDescripcion[e.descripcion] || 0) + monto
    }
    if (e.tipo === 'ingreso') totalIngresos += monto
  }
  return { totalGastos, totalIngresos, porCategoria, porDescripcion, filtroPorItem: !!descFiltro, totalPropio, totalCompartido }
}

// ─── MOSTRAR RESUMEN ─────────────────────────────────────────
async function ejecutarResumen(consulta, archivoExcel, grupoId) {
  const resumen = await obtenerResumen(archivoExcel, consulta.fechaDesde, consulta.fechaHasta, consulta.categoria, consulta.descripcion, consulta.subcategoria)
  const fmt = (n) => `$${n.toLocaleString('es-CO')}`

  const periodoTitulo = (consulta.titulo || '')
    .replace(/^(hogar|hijos|ocio|otros|salvador|violeta)\s*[—–-]\s*/i, '')
    .replace(/\s*[—–-]\s*(hogar|hijos|ocio|otros|salvador|violeta)$/i, '')
    .trim() || 'período solicitado'

  if (!resumen || (resumen.totalGastos === 0 && resumen.totalIngresos === 0)) {
    const filtroTexto = consulta.subcategoria
      ? ` en ${consulta.subcategoria}` : consulta.categoria
      ? ` en ${consulta.categoria}` : consulta.descripcion
      ? ` en ${consulta.descripcion}` : ''
    await client.sendMessage(grupoId,
      `💰 *Resumen* — ${periodoTitulo}\n\nNo hay gastos registrados${filtroTexto} en ese período.`)
    return
  }

  let msg2 = `💰 *Resumen* — ${periodoTitulo}\n\n`

  if (consulta.subcategoria && resumen.totalCompartido > 0) {
    // Formato especial para Salvador o Violeta: desglose propio + compartido
    msg2 += `Gastos ${consulta.subcategoria}   ${fmt(resumen.totalPropio)}\n`
    msg2 += `Gastos compartidos   ${fmt(resumen.totalCompartido)}\n`
    msg2 += `———————————\n`
    msg2 += `*Total ${consulta.subcategoria}   ${fmt(resumen.totalGastos)}*\n`
  } else if (consulta.subcategoria) {
    // Solo gastos propios, sin compartidos
    msg2 += `Gastos ${consulta.subcategoria}\n`
    msg2 += `${fmt(resumen.totalGastos)}\n`
  } else {
    // Resumen normal (categoría, ítem, o general)
    let labelTotal = 'Total gasto'
    if (consulta.descripcion) labelTotal = `Total gasto en ${consulta.descripcion}`
    else if (consulta.categoria) labelTotal = `Total gasto en ${consulta.categoria}`
    msg2 += `${labelTotal}\n`
    msg2 += `${fmt(resumen.totalGastos)}\n`

    if (!consulta.categoria && !resumen.filtroPorItem) {
      const cats = Object.entries(resumen.porCategoria).sort((a, b) => b[1] - a[1])
      if (cats.length > 0) {
        msg2 += `\n`
        for (const [cat, monto] of cats)
          msg2 += `• ${cat}: ${fmt(monto)}\n`
      }
    }
  }

  if (resumen.totalIngresos > 0)
    msg2 += `💰 Ingresos: ${fmt(resumen.totalIngresos)}\n`

  msg2 += `\n`
  if (consulta.subcategoria) msg2 += `📂 Hijos › ${consulta.subcategoria}`
  else if (consulta.categoria) msg2 += `📂 ${consulta.categoria}`
  else if (consulta.descripcion) msg2 += `📂 ${consulta.descripcion}`
  else msg2 += `📂 Todos`

  await client.sendMessage(grupoId, msg2)
}

// ─── CONVERTIR NÚMEROS ESCRITOS EN ESPAÑOL A DÍGITOS ─────────
// Ej: "borrar abono tres" → "borrar abono 3"
//     "eliminar el ciento veinte" → "eliminar el 120"
//     "borrar abono treinta y dos" → "borrar abono 32"
function convertirNumerosEscritos(texto) {
  const UNIDADES = { uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,
    diez:10,once:11,doce:12,trece:13,catorce:14,quince:15,
    dieciseis:16,diecisiete:17,dieciocho:18,diecinueve:19,
    veinte:20,veintiuno:21,veintidos:22,veintitres:23,veinticuatro:24,
    veinticinco:25,veintiseis:26,veintisiete:27,veintiocho:28,veintinueve:29 }
  const DECENAS = { treinta:30,cuarenta:40,cincuenta:50,sesenta:60,setenta:70,ochenta:80,noventa:90 }
  const CENTENAS = { cien:100,ciento:100,doscientos:200,doscientas:200,trescientos:300,trescientas:300,
    cuatrocientos:400,cuatrocientas:400,quinientos:500,quinientas:500,
    seiscientos:600,seiscientas:600,setecientos:700,setecientas:700,
    ochocientos:800,ochocientas:800,novecientos:900,novecientas:900 }

  // Patrón: [centenas] [decenas y unidades | unidades] [mil [...]]
  // Se reemplaza de izquierda a derecha el primer número escrito encontrado
  const palabras = Object.keys(CENTENAS).concat(Object.keys(DECENAS)).concat(Object.keys(UNIDADES))
  const pat = new RegExp(
    '\\b(' +
    // ciento/doscientos... + decena y unidad / unidad / decena
    Object.keys(CENTENAS).join('|') + ')(?:\\s+(' + Object.keys(DECENAS).join('|') + ')(?:\\s+y\\s+(' + Object.keys(UNIDADES).join('|') + '))?|\\s+(' + Object.keys(UNIDADES).join('|') + '))?' +
    '|\\b(' + Object.keys(DECENAS).join('|') + ')(?:\\s+y\\s+(' + Object.keys(UNIDADES).join('|') + '))?' +
    '|\\b(' + Object.keys(UNIDADES).join('|') + ')\\b',
    'g'
  )
  return texto.replace(pat, (...args) => {
    // args: match, cent, dec_after_cent, uni_after_dec_cent, uni_after_cent, dec, uni_after_dec, uni
    const [, cent, dec1, uni1, uni2, dec2, uni3, uni4] = args
    let val = 0
    if (cent)  val += CENTENAS[cent]
    if (dec1)  val += DECENAS[dec1]
    if (uni1)  val += UNIDADES[uni1]
    if (uni2)  val += UNIDADES[uni2]
    if (dec2)  val += DECENAS[dec2]
    if (uni3)  val += UNIDADES[uni3]
    if (uni4)  val += UNIDADES[uni4]
    return val > 0 ? String(val) : args[0]
  })
}

// ─── PROCESAR GASTO ──────────────────────────────────────────
async function procesarGasto(msg, chat, archivoExcel) {
  const grupoId = chat.id._serialized
  let texto = msg.body || ''
  console.log(`[GASTO] txt="${texto}" archivo=${archivoExcel.split('/').pop()}`)

  // ── Imagen recibida ──────────────────────────────────────────
  if (msg.hasMedia && msg.type === 'image') {
    // Siempre guardar como posible comprobante (Aura, Chila, etc.)
    lastImagePerGroup[grupoId] = { msg, timestamp: Date.now() }
    console.log(`[IMG] Comprobante guardado para grupo ${grupoId.slice(-15)}`)
    if (GRUPOS_VERIFICACION_PAGO.includes(chat.name.toLowerCase())) {
      await verificarPagoDesdeImagen(msg, chat, archivoExcel)
    }
    return
  }

  // ── ¿Hay una acción pendiente esperando sí/no? ───────────
  const pendAccion = getPendienteAccion(grupoId)
  if (pendAccion) {
    const resp = texto.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.!?,;]+$/, '')
    if (/^(1|si|dale|confirmo|ok|listo|yes|claro|afirmativo|va|eso)$/.test(resp)) {
      borrarPendienteAccion(grupoId)
      await ejecutarAccionConfirmada(pendAccion, grupoId)
      return
    } else if (/^(2|no|cancela|cancelar|nope|negativo|para)$/.test(resp)) {
      borrarPendienteAccion(grupoId)
      await client.sendMessage(grupoId, '❌ Cancelado.')
      return
    }
    // Otra cosa → cancelar la confirmación pendiente y procesar normal
    borrarPendienteAccion(grupoId)
  }

  // ── ¿Hay un gasto pendiente esperando categoría? ──────────
  const pendiente = getPendiente(grupoId)
  if (pendiente) {
    const opcion = texto.trim()
    let categoria = null

    if (pendiente.tipo === 'hogar_ocio') {
      // Solo dos opciones: 1 = Hogar, 2 = Ocio
      if (opcion === '1' || /^hogar$/i.test(opcion)) categoria = 'Hogar'
      else if (opcion === '2' || /^ocio$/i.test(opcion)) categoria = 'Ocio'
    } else {
      // Menú normal de 3 opciones
      categoria = OPCION_A_CATEGORIA[opcion]
        || CATEGORIAS.find(c => c.toLowerCase() === opcion.toLowerCase())
    }

    if (categoria) {
      borrarPendiente(grupoId)
      pendiente.datos.categoria = categoria
      // No guardar en aprendizaje para comidas (siempre se pregunta)
      if (pendiente.tipo !== 'hogar_ocio') {
        aprenderCategoria(pendiente.datos.descripcion, categoria)
      }
      await confirmarYGuardar(grupoId, pendiente.datos, pendiente.remitente, pendiente.archivoExcel)
      return
    }
    // No era una respuesta válida — continúa procesando como gasto nuevo
    borrarPendiente(grupoId)
  }

  // ── ¿Hay un resumen esperando período? ────────────────────
  const consultaParcial = getPendientePeriodo(grupoId)
  if (consultaParcial) {
    borrarPendientePeriodo(grupoId)
    // Combinar la consulta original con el período que acaba de dar
    const textoCombinado = `${consultaParcial} ${texto.trim()}`
    console.log(`[RESUMEN] Combinando consulta: "${textoCombinado}"`)
    const consulta = await parsearConsultaResumen(textoCombinado)
    if (consulta && consulta.fechaDesde) {
      await ejecutarResumen(consulta, archivoExcel, grupoId)
    } else {
      await client.sendMessage(grupoId,
        `💰 Aún no entendí el período.\nIntenta: _"este mes"_, _"últimos 7 días"_, _"esta semana"_`)
    }
    return
  }

  // ── Transcribir audio ─────────────────────────────────────
  if (msg.hasMedia && (msg.type === 'ptt' || msg.type === 'audio')) {
    console.log(`[GASTOS] Audio recibido, transcribiendo...`)
    const media = await msg.downloadMedia()
    texto = await transcribirAudio(media)
    if (!texto) {
      await client.sendMessage(grupoId, '🎙️ No pude transcribir el audio, hubo un problema con la grabación.\nEscríbelo así: _"gasté 50000 en gasolina"_')
      return
    }
    console.log(`[GASTOS] Audio transcrito: ${texto}`)
  }

  if (!texto || !texto.trim()) return

  // ── Aprendizaje: ver o borrar entradas ───────────────────
  const _tA = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const mOlvidar = _tA.match(/\bolvidar?\b\s+(.+)/)
  if (mOlvidar || /^\/(aprendizaje|olvida)$/i.test(texto.trim())) {
    if (mOlvidar) {
      const clave = mOlvidar[1].trim()
      const borradas = olvidarAprendizaje(clave)
      if (borradas > 0) {
        await client.sendMessage(grupoId, `✅ Olvidé "${clave}" (${borradas} entrada${borradas > 1 ? 's' : ''} borrada${borradas > 1 ? 's' : ''}).`)
      } else {
        await client.sendMessage(grupoId, `❓ No encontré nada con "${clave}" en el aprendizaje.`)
      }
    } else {
      const aprendizaje = cargarAprendizaje()
      const entradas = Object.entries(aprendizaje)
      if (!entradas.length) {
        await client.sendMessage(grupoId, '📚 El aprendizaje está vacío.')
      } else {
        const lineas = entradas.map(([k, v]) => `• "${k}" → ${v}`).join('\n')
        await client.sendMessage(grupoId, `📚 *Aprendizaje guardado (${entradas.length}):*\n\n${lineas}\n\n_Di "olvidar [palabra]" para borrar entradas._`)
      }
    }
    return
  }

  // ── Enviar Excel ─────────────────────────────────────────
  // Si el mensaje menciona "excel", "archivo", "planilla" o "historial" → entregar el archivo
  const _t = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const esEnviarExcel = /\b(excel|archivo|planilla|historial)\b/.test(_t)
    || /^\/excel$/i.test(texto.trim())
  if (esEnviarExcel) {
    const lista = cargarDatos(archivoExcel)
    if (!lista.length) {
      await client.sendMessage(grupoId, '📊 Aún no hay gastos registrados.')
      return
    }
    try {
      await regenerarExcel(archivoExcel)   // siempre regenerar para tener la versión más fresca
      const media = MessageMedia.fromFilePath(archivoExcel)
      await client.sendMessage(grupoId, media, {
        sendMediaAsDocument: true,
        caption: '📊 Aquí está el Excel actualizado',
      })
    } catch (err) {
      await client.sendMessage(grupoId, '⚠️ No pude enviar el archivo. Verifique que no esté abierto.')
      console.error('[EXCEL] Error enviando archivo:', err.message)
    }
    return
  }

  // ── Corrección de categoría — todas las formas posibles ──
  // "cambiar X a Y"
  // "X no iba/va/estaba en Y sino en Z"
  // "X va en Z no en Y" / "X es de Z"
  const CATS_RE = '(hogar|hijos|ocio|otros)'
  let descCorr = null, catCorr = null

  // "cambiar X a Y"
  const m1 = texto.match(new RegExp(`cambiar\\s+(.+?)\\s+a\\s+${CATS_RE}`, 'i'))
  if (m1) { descCorr = m1[1].trim(); catCorr = m1[2] }

  if (!catCorr) {
    // "X, cambiarlo a Y" / "X cambiarlo a Y" / "ese cambiarlo a Y"
    const m1b = texto.match(new RegExp(`(.+?)[,.]?\\s+cambiarlo?\\s+a\\s+${CATS_RE}`, 'i'))
    if (m1b) {
      descCorr = m1b[1].replace(/^(la|el|los|las|ese|esa)\s+/i, '')
                       .replace(/\s+de\s+\d[\d.,]*$/i, '')  // quitar "de 32000" al final
                       .trim()
      catCorr  = m1b[2]
    }
  }

  if (!catCorr) {
    // "mover X a Y" / "moverlo a Y" / "pasar X a Y" / "llevar X a Y"
    const m1c = texto.match(new RegExp(`(?:mover?|pasar(?:lo)?|llevar(?:lo)?)\\s+(?:el\\s+)?(.+?)\\s+a\\s+${CATS_RE}`, 'i'))
    if (m1c) {
      const desc = m1c[1].trim()
      // Si no hay descripción real (solo "lo", "eso", etc.) → usar el último gasto
      descCorr = /^(lo|eso|ese|esa|este|esta)$/i.test(desc) ? 'ultimo' : desc
      catCorr  = m1c[2]
    }
  }

  if (!catCorr) {
    // "la peluquería no iba en ocio sino en hogar"
    const m2 = texto.match(new RegExp(`(.+?)\\s+no\\s+(?:iba|va|está|estaba|era|es|queda)\\s+en\\s+${CATS_RE}\\s+sino\\s+(?:en\\s+)?${CATS_RE}`, 'i'))
    if (m2) { descCorr = m2[1].replace(/^(la|el|los|las|ese|esa)\s+/i, '').trim(); catCorr = m2[3] }
  }

  if (!catCorr) {
    // "la peluquería va en hogar" / "la peluquería es de hogar"
    const m3 = texto.match(new RegExp(`(.+?)\\s+(?:va|es|queda|está)\\s+(?:en|de)\\s+${CATS_RE}`, 'i'))
    if (m3) { descCorr = m3[1].replace(/^(la|el|los|las|ese|esa)\s+/i, '').trim(); catCorr = m3[2] }
  }

  if (descCorr && catCorr) {
    const nuevaCategoria = catCorr.charAt(0).toUpperCase() + catCorr.slice(1).toLowerCase()
    const lista = cargarDatos(archivoExcel)
    if (!lista.length) { await client.sendMessage(grupoId, '❌ No hay gastos registrados aún.'); return }
    let entrada
    // Limpiar descCorr de ruido: "el gasto 46 de hijos" → buscar por número 46
    const descLimpia = descCorr.toLowerCase()
      .replace(/^(el|la|ese|esa)\s+/, '')
      .replace(/\s+de\s+(hijos|hogar|ocio|otros)\s*$/, '')
      .trim()
    const mNumCorr = descLimpia.match(/(?:gasto\s+(?:numero\s+)?#?|numero\s+|#)(\d+)$/)
      || descLimpia.match(/^#?(\d{1,4})$/)
    if (descCorr === 'ultimo') {
      entrada = lista[lista.length - 1]
    } else if (mNumCorr) {
      const num = parseInt(mNumCorr[1])
      entrada = lista.slice().reverse().find(e => Number(e.numero) === num)
      if (!entrada) { await client.sendMessage(grupoId, `❌ No encontré el gasto *#${num}*`); return }
    } else {
      entrada = lista.slice().reverse().find(e => e.descripcion.toLowerCase().includes(descLimpia))
    }
    if (!entrada) {
      await client.sendMessage(grupoId, `❌ No encontré ningún gasto con _"${descLimpia}"_`)
      return
    }
    await pedirConfirmacion(grupoId, 'corregir_categoria', entrada, nuevaCategoria, entrada.categoria, archivoExcel)
    return
  }

  // ── Comandos de edición / borrado ────────────────────────
  const textoTrim = texto.trim()
  const textoN    = convertirNumerosEscritos(textoTrim.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // quitar tildes para comparar
    .replace(/[.!?,;]+$/, ''))                         // quitar puntuación final (Whisper agrega puntos)

  // Verbos de borrado en todas sus formas (textoN ya no tiene tildes)
  const VB = /borra(?:r[eé]?|me)?|borre|elimina(?:r[eé]?)?|elimine|quita(?:r[eé]?|me)?|quite/

  // /borrar  o  /borrar [texto]  o  borrar ultimo  o  eliminar ultimo
  const esBorrarUltimo =
    textoN === '/borrar' ||
    textoN === 'borrar' ||
    textoN === 'borrar ultimo' ||
    textoN === 'eliminar ultimo' ||
    textoN === 'elimina el ultimo' ||
    textoN === 'borra el ultimo' ||
    textoN === 'borra ese' ||
    textoN === 'borra ese ultimo' ||
    textoN === 'elimina ese' ||
    textoN === 'elimina ese ultimo' ||
    textoN === 'borralo' ||
    textoN === 'eliminalo' ||
    textoN === 'quita ese' ||
    textoN === 'quitar ese' ||
    textoN === 'quita el ultimo' ||
    /^(borra|elimina|quita|borrar|eliminar|borre|elimine|borré|eliminé)\s+(el\s+)?(ultimo|ese|eso|este|esa|esta)(\.|\s*$)/i.test(textoN) ||
    /^(borra|elimina|borré|eliminé|borre|elimine)\s+(el\s+)?(ultimo|ese).*(guardado|gasto|registro)?$/i.test(textoN) ||
    /ultimo\s+(guardado|gasto|registro)\s*$/i.test(textoN) && VB.test(textoN)

  if (esBorrarUltimo) {
    const lista = cargarDatos(archivoExcel)
    if (!lista.length) { await client.sendMessage(grupoId, '❌ No hay gastos registrados aún.'); return }
    await pedirConfirmacion(grupoId, 'borrar', lista[lista.length - 1], null, null, archivoExcel)
    return
  }

  // Borrar por número consecutivo: "borra el #5", "elimine el gasto numero 2", "borra el abono 3"
  const V = '(?:' + VB.source + ')'   // envolver para que | no rompa la precedencia
  const mBorrarNum = textoN.match(new RegExp(V + '.*#(\\d+)'))
    || textoN.match(new RegExp('#(\\d+).*' + V))
    || textoN.match(new RegExp(V + '.+\\b(?:numero|gasto|abono|registro|pago)\\b\\s+(?:numero\\s+)?#?(\\d+)$'))
    || textoN.match(new RegExp('\\b(?:numero|gasto|abono|registro|pago)\\s+(?:numero\\s+)?#?(\\d+)\\b.+' + V))
    || textoN.match(new RegExp(V + '\\s+(?:el\\s+|ese\\s+|esa\\s+)?(?:\\w+\\s+)?#?(\\d{1,4})\\s*[.]?$'))  // "borra el abono 3", "eliminar 44"
  if (mBorrarNum) {
    const num = parseInt(mBorrarNum[1])
    const lista = cargarDatos(archivoExcel)
    const idx = lista.findLastIndex(e => Number(e.numero) === num)
    if (idx < 0) { await client.sendMessage(grupoId, `❌ No encontré el registro *#${num}*`); return }
    await pedirConfirmacion(grupoId, 'borrar', lista[idx], null, null, archivoExcel)
    return
  }

  // /borrar [descripcion]  — busca por texto
  const mBorrarDesc = textoTrim.match(/^\/borrar\s+(.+)$/i)
    || textoTrim.match(/^(borra(?:r[eé]?|me)?|borre|elimina(?:r[eé]?)?|elimine|quita(?:r[eé]?|me)?|quite)\s+(?:el\s+gasto\s+de\s+|el\s+de\s+|la\s+de\s+|el\s+|la\s+)?(.+)$/i)
  if (mBorrarDesc) {
    // [1] es la palabra de acción si viene del segundo regex, [2] es la descripción real
    let ref = (mBorrarDesc[2] || mBorrarDesc[1]).trim().toLowerCase()
    ref = ref.replace(/^(gasto\s+(de\s+)?|ultimo\s+gasto\s+(de\s+)?)/, '').trim()
    ref = ref.replace(/\s+(guardado|ultimo|registrado)$/, '').trim()
    const excluir = ['ultimo', 'ese', 'eso', 'este', 'esa', 'esta', 'el ultimo', 'ese ultimo']
    if (!excluir.includes(ref) && ref.length > 2) {
      const lista = cargarDatos(archivoExcel)
      const idx = lista.findLastIndex(e => e.descripcion.toLowerCase().includes(ref))
      if (idx < 0) { await client.sendMessage(grupoId, `❌ No encontré ningún gasto con _"${ref}"_`); return }
      await pedirConfirmacion(grupoId, 'borrar', lista[idx], null, null, archivoExcel)
      return
    }
  }

  // Corrección de monto por número: "el #5 era 32 no 320", "#8 era 15000 no 1500"
  const mCorregirNum = textoN.match(/#(\d+).*era\s+([\d.,]+)\s+(?:no|y\s+no)\s+([\d.,]+)/i)
    || textoN.match(/era\s+([\d.,]+)\s+(?:no|y\s+no)\s+([\d.,]+).*#(\d+)/i)
  if (mCorregirNum) {
    const numIdx   = mCorregirNum[3] ? parseInt(mCorregirNum[3]) : parseInt(mCorregirNum[1])
    const valStr   = mCorregirNum[3] ? mCorregirNum[1] : mCorregirNum[2]
    const correcto = parseInt(valStr.replace(/[.,]/g, ''))
    const monto    = correcto < 500 ? correcto * 1000 : correcto
    const lista    = cargarDatos(archivoExcel)
    const idx      = lista.findLastIndex(e => Number(e.numero) === numIdx)
    if (idx < 0) { await client.sendMessage(grupoId, `❌ No encontré el gasto *#${numIdx}*`); return }
    await pedirConfirmacion(grupoId, 'corregir_monto', lista[idx], monto, null, archivoExcel)
    return
  }

  // Corrección de monto: "era 32 no 320" / "ese era 15 no 150"
  const mCorregir = textoN.match(/era\s+(\d[\d.,]*)\s+(?:no|y\s+no)\s+(\d[\d.,]*)/)
    || textoN.match(/(\d[\d.,]*)\s+no\s+era\s+(\d[\d.,]*)/)
  if (mCorregir) {
    const correcto = parseInt(mCorregir[1].replace(/[.,]/g, ''))
    const monto    = correcto < 500 ? correcto * 1000 : correcto
    const lista    = cargarDatos(archivoExcel)
    if (!lista.length) { await client.sendMessage(grupoId, '❌ No hay gastos registrados.'); return }
    await pedirConfirmacion(grupoId, 'corregir_monto', lista[lista.length - 1], monto, null, archivoExcel)
    return
  }

  // Intentar IA para casos más complejos de edición
  const palabrasEdicion = /borra|borrar|borre|elimina|eliminar|elimine|quita|quitar|quite|correg|modific|cambi[ao]|pas[ae]|mover?|lleva|estaba\s+mal|no\s+era|ese\s+era|eso\s+era|#\d+/i
  if (palabrasEdicion.test(textoTrim)) {
    console.log(`[EDICION] Intentando con IA: "${textoTrim}"`)
    const edicion = await parsearEdicion(textoTrim)
    if (edicion && edicion.accion !== 'no_es_edicion') {
      await ejecutarEdicion(edicion, archivoExcel, grupoId)
    } else {
      await client.sendMessage(grupoId,
        `✏️ Entendí que querías corregir algo pero no supe cuál.\n\nIntenta más específico:\n• _/borrar_ — borra el último\n• _/borrar gasolina_ — borra el de gasolina\n• _"era 32 no 320"_ — corrige el monto del último`
      )
    }
    return
  }

  // ── Comando resumen (con IA) ──────────────────────────────
  const textoLower = texto.trim().toLowerCase()

  // Palabras que indican consulta de periodo / resumen
  const tienePeriodo = /últimos?\s+\d+|ultimos?\s+\d+|del\s+mes|de\s+la\s+semana|esta\s+semana|semana\s+pasada|este\s+mes|mes\s+pasado|de\s+hoy|de\s+ayer|del\s+día|de\s+marzo|de\s+abril|de\s+enero|de\s+febrero|de\s+mayo|de\s+junio|de\s+julio|de\s+agosto|de\s+septiembre|de\s+octubre|de\s+noviembre|de\s+diciembre|del\s+\d+\s+al|del\s+uno|del\s+primero/.test(textoLower)
  const tieneCategoria = /\b(hogar|hijos|ocio|otros)\b/.test(textoLower)
  const tieneGasto = /\bgasto(s)?\b/.test(textoLower)
  const tienePregunta = /cuánto|cuanto|cuál|cual|cómo\s+voy|como\s+voy|resumen|le\s+he\s+metido|cuánto\s+llevo|cuanto\s+llevo|cuánto\s+voy|cuanto\s+voy|cuánto\s+he|cuanto\s+he|cuánto\s+gasté|cuanto\s+gaste|cuánto\s+va|cuanto\s+va|cómo\s+van|como\s+van|cómo\s+está|como\s+esta|cómo\s+estoy|como\s+estoy|en\s+qué\s+voy|en\s+que\s+voy|a\s+cuánto|a\s+cuanto|por\s+cuánto|por\s+cuanto|cómo\s+me|como\s+me|qué\s+he\s+gastado|que\s+he\s+gastado|total\s+gasto|total\s+gastos|total\s+de\s+gasto|dame\s+el\s+total|ver\s+gasto|ver\s+gastos|muéstrame|muestrame/.test(textoLower)

  const esResumen = textoLower === '/resumen'
    || textoLower.startsWith('/resumen')
    || tienePregunta
    || (tieneGasto && tienePeriodo)
    || (tieneGasto && tieneCategoria)
    || (tieneCategoria && tienePeriodo)

  if (esResumen) {
    const consulta = await parsearConsultaResumen(texto)

    // Si no hay fechas → asumir mes actual
    if (!consulta || !consulta.fechaDesde || !consulta.fechaHasta) {
      const ahora = new Date()
      const inicioMes = `${ahora.getFullYear()}-${String(ahora.getMonth()+1).padStart(2,'0')}-01`
      const finMes    = new Date(ahora.getFullYear(), ahora.getMonth()+1, 0).toISOString().split('T')[0]
      const mesNombre = ahora.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
      const consultaDefault = {
        ...(consulta || {}),
        fechaDesde: inicioMes,
        fechaHasta: finMes,
        titulo: consulta?.titulo || mesNombre,
      }
      await ejecutarResumen(consultaDefault, archivoExcel, grupoId)
      return
    }

    await ejecutarResumen(consulta, archivoExcel, grupoId)
    return
  }

  // ── Extraer datos del gasto ───────────────────────────────
  console.log(`[GASTOS] Procesando: ${texto}`)
  const datos = await extraerDatosGasto(texto)

  if (!datos || datos.error === 'fallo_tecnico') {
    await client.sendMessage(grupoId, '⚠️ Error de conexión. Intenta de nuevo en 30 segundos.')
    return
  }
  if (datos.error) {
    // En grupos de chat mixto (Beatriz, Interrapidísimo) se ignora silenciosamente
    const GRUPOS_SILENCIOSOS = [PAGOS_BEATRIZ_EXCEL, PAGOS_INTER_EXCEL]
    if (!GRUPOS_SILENCIOSOS.includes(archivoExcel)) {
      await client.sendMessage(grupoId,
        `💸 No registré ningún gasto — faltó el monto.\n\n` +
        `Dime cuánto fue, por ejemplo:\n` +
        `• _"almuerzo 15000"_\n` +
        `• _"taxi 8 lucas"_\n` +
        `• _"gasté 50 en gasolina"_`
      )
    }
    return
  }

  // ── Categoría fija por grupo (ej: Abono en Pago Stella/Juancho) ──
  const categoriaFija = GRUPOS_CATEGORIA_FIJA[chat.name.toLowerCase()]
  if (categoriaFija) {
    datos.categoria = categoriaFija
    let remitente = msg.author ? msg.author.replace('@c.us', '') : 'Desconocido'
    try { const contact = await msg.getContact(); remitente = contact.pushname || contact.name || remitente } catch {}

    // confirmarYGuardar llama a PERSONAS_PAGO, que maneja el espejo y comprobante de Beatriz automáticamente
    await confirmarYGuardar(grupoId, datos, remitente, archivoExcel)
    return
  }

  // ── Verificar aprendizaje previo ──────────────────────────
  const categoriaAprendida = buscarEnAprendizaje(datos.descripcion)
  if (categoriaAprendida) {
    // No dejar que el aprendizaje anule a la IA cuando hay señal explícita de categoría en el texto
    const textoN2 = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const haySeñalHijos = /\b(hijos?|salvador|violeta|los\s*ninos|los\s*dos|ambos)\b/.test(textoN2)
    const haySeñalOcio  = /\b(restaurante|resto|bar|cine|viaje|rumba|gym|gimnasio)\b/.test(textoN2)
    const categoriaProtegida = (haySeñalHijos && datos.categoria === 'Hijos')
                             || (haySeñalOcio  && datos.categoria === 'Ocio')
    if (!categoriaProtegida) {
      datos.categoria = categoriaAprendida
      console.log(`[APRENDIZAJE] Usando categoría aprendida: "${datos.descripcion}" → ${categoriaAprendida}`)
    } else {
      console.log(`[APRENDIZAJE] Señal explícita en texto protege categoría: "${datos.descripcion}" → ${datos.categoria} (aprendizaje decía ${categoriaAprendida})`)
    }
  }

  // ── Pagos a Aura → siempre Hogar (tiene prioridad sobre aprendizaje) ──
  if (/\baura\b/i.test(texto) || /\baura\b/i.test(datos.descripcion)) {
    datos.categoria = 'Hogar'
  }

  // ── Obtener remitente (una sola vez) ──────────────────────
  let remitente = msg.author ? msg.author.replace('@c.us', '') : 'Desconocido'
  try {
    const contact = await msg.getContact()
    remitente = contact.pushname || contact.name || remitente
  } catch { /* fallback */ }

  // ── Comida ambigua: preguntar ¿Hogar o Ocio? ─────────────
  // Siempre pregunta para gastos de alimentación (Hogar u Ocio)
  if (esComidaAmbigua(datos.descripcion)
      && (datos.categoria === 'Hogar' || datos.categoria === 'Ocio')) {
    setPendiente(grupoId, datos, remitente, archivoExcel, 'hogar_ocio')
    await client.sendMessage(grupoId,
      `🍽️ ¿Este gasto va en *Hogar* o en *Ocio*?\n\n` +
      `_${datos.descripcion} — $${Math.abs(datos.monto).toLocaleString('es-CO')}_\n\n` +
      `1️⃣ Hogar _(domicilio, comida en casa)_\n` +
      `2️⃣ Ocio _(restaurante, salida a comer)_`
    )
    return
  }

  // ── Si categoría es "Otros" → preguntar al usuario ────────
  if (datos.categoria === 'Otros') {
    setPendiente(grupoId, datos, remitente, archivoExcel)
    await client.sendMessage(grupoId,
      `${CATEGORIA_MENU}\n\n_"${datos.descripcion} — $${Math.abs(datos.monto).toLocaleString('es-CO')}"_`
    )
    return
  }

  // ── Guardar normalmente ───────────────────────────────────
  await confirmarYGuardar(grupoId, datos, remitente, archivoExcel)
}

// ─── (cliente ya definido arriba con Evolution API) ──────────

console.log('=========================================')
console.log('  BOT PERSONAL')
console.log('  Motor: Groq (Llama 3.1 + Whisper)')
console.log('  Categorías: Hogar (incluye transporte) | Hijos | Ocio')
console.log('  Grupos gastos:')
for (const nombre of Object.keys(GRUPOS_GASTOS)) console.log(`    - "${nombre}"`)
console.log('  Grupos asistente:')
for (const nombre of GRUPOS_ASISTENTE) console.log(`    - "${nombre}"`)
console.log('  Grupos Camila (marketing):')
for (const nombre of GRUPOS_CAMILA) console.log(`    - "${nombre}"`)
console.log('  Iniciando...')
console.log('=========================================')

// QR handler movido a inicializarEvolution()

// ID del grupo Gastos — se llena al arrancar para notificaciones de chats directos
let idGrupoNotificaciones = null

// ─── ROUTER GENERAL ──────────────────────────────────────────
async function routearMensaje(msg, chat) {
  const nombre = chat.name.toLowerCase()
  // Grupos de gastos
  const entradaGrupo = Object.entries(GRUPOS_GASTOS).find(([n]) => nombre === n)
  if (entradaGrupo) { await procesarGasto(msg, chat, entradaGrupo[1]); return }
  // Chats directos de gastos
  const entradaDirecta = Object.entries(CHATS_DIRECTOS_GASTOS).find(([n]) => nombre === n)
  if (entradaDirecta) { await procesarGasto(msg, chat, entradaDirecta[1]); return }
  // Asistente
  if (GRUPOS_ASISTENTE.includes(nombre)) { await procesarAsistente(msg, chat); return }
  // Camila (marketing Priority)
  if (GRUPOS_CAMILA.includes(nombre)) { await procesarCamila(msg, chat); return }
}

// ─── HANDLER DE MENSAJES (whatsapp-web.js) ───────────────────
client.on('message_create', async (msg) => {
  try {
    const chat = await msg.getChat()
    const chatId = chat.id._serialized
    if (!chatId) return
    if (chatId === 'status@broadcast' || chatId.includes('broadcast')) return

    const isGroup  = chat.isGroup
    const chatName = (chat.name || '').toLowerCase()
    const fromMe   = msg.fromMe
    const bodyText = msg.body || ''

    // Cachear nombre de grupo
    if (isGroup && chatName) grupoJids[chatId] = chatName

    const chatObj = { id: { _serialized: chatId }, name: chatName, isGroup }

    const EMOJIS_BOT = ['💸','💰','❓','📊','❌','✅','⚠','🔔','📅','🗑️','✏️','🎙️','📂','📌','🍽️','📋','🚀','⏳','💡','⏱️','🔴','🟢','🟠','🔵','🔍','🔎']
    const esRespuestaBot = EMOJIS_BOT.some(e => bodyText.startsWith(e))

    if (!fromMe && isGroup) {
      // Mensajes de otros en grupos
      if (GRUPOS_SOLO_DUENO.includes(chatName)) {
        const txt = bodyText.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        if (/^enviar\s+resumen$|^\/resumen$/.test(txt)) await routearMensaje(msg, chatObj)
        return
      }
      await routearMensaje(msg, chatObj)
    } else if (fromMe && isGroup && !esRespuestaBot) {
      console.log(`[BOT] Dueño en grupo "${chatName}": ${bodyText}`)
      await routearMensaje(msg, chatObj)
    } else if (fromMe && !isGroup && !esRespuestaBot) {
      // Mensajes del dueño en chats directos
      if (chatId === NUMERO_AURA + '@c.us') {
        chatObj.name = 'aura casa ai'
        console.log(`[BOT] Dueño en chat Aura: ${bodyText}`)
        await routearMensaje(msg, chatObj)
      } else if (chatId === NUMERO_CHILA + '@c.us') {
        chatObj.name = 'chila pagos ai'
        console.log(`[BOT] Dueño en chat Chila: ${bodyText}`)
        await routearMensaje(msg, chatObj)
      } else if (Object.keys(CHATS_DIRECTOS_GASTOS).some(n => chatName === n)) {
        console.log(`[BOT] Dueño en chat directo "${chatName}": ${bodyText}`)
        await routearMensaje(msg, chatObj)
      } else {
        console.log(`[WH] fromMe chat directo sin handler: chatName="${chatName}"`)
      }
    } else if (!fromMe && !isGroup && chatId === DUENO_JID && !esRespuestaBot) {
      // Dueño le escribe al bot directo
      console.log(`[BOT] Dueño → bot directo: "${bodyText}"`)
      chatObj.name = 'mi asistente'
      await routearMensaje(msg, chatObj)
    } else {
      console.log(`[WH] ignorado: fromMe=${fromMe} isGroup=${isGroup} chatId=${chatId}`)
    }
  } catch (err) {
    console.error('[MSG] Error:', err.message, '\n', err.stack)
  }
})

// ═══════════════════════════════════════════════════════════
// ─── MÓDULO ASISTENTE PERSONAL ───────────────────────────────
// ═══════════════════════════════════════════════════════════

function cargarRecordatorios() {
  try { return JSON.parse(fs.readFileSync(RECORDATORIOS_FILE, 'utf-8')) }
  catch { return [] }
}

function parsearFiltroFechaAgenda(txLow) {
  const ahora = new Date()
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  const finDia = (d) => { const f = new Date(d); f.setHours(23,59,59,999); return f }

  if (/\bpasado\s+manana\b/.test(txLow)) {
    const ini = new Date(hoy); ini.setDate(ini.getDate()+2)
    return { inicio: ini, fin: finDia(ini), label: 'pasado mañana' }
  }
  if (/\bmanana\b/.test(txLow)) {
    const ini = new Date(hoy); ini.setDate(ini.getDate()+1)
    return { inicio: ini, fin: finDia(ini), label: 'mañana' }
  }
  if (/\bhoy\b/.test(txLow)) {
    return { inicio: hoy, fin: finDia(hoy), label: 'hoy' }
  }
  if (/\besta\s+semana\b/.test(txLow)) {
    const diaSem = hoy.getDay()
    const restan = diaSem === 0 ? 0 : 7 - diaSem
    const fin = new Date(hoy); fin.setDate(fin.getDate()+restan)
    return { inicio: hoy, fin: finDia(fin), label: 'esta semana' }
  }
  if (/\b(proxima|otra|siguiente)\s+semana\b/.test(txLow)) {
    const diaSem = hoy.getDay()
    const hastaLunes = diaSem === 0 ? 1 : (8 - diaSem)
    const ini = new Date(hoy); ini.setDate(ini.getDate()+hastaLunes)
    const fin = new Date(ini); fin.setDate(fin.getDate()+6)
    return { inicio: ini, fin: finDia(fin), label: 'próxima semana' }
  }
  if (/\beste\s+mes\b/.test(txLow)) {
    const fin = new Date(hoy.getFullYear(), hoy.getMonth()+1, 0, 23, 59, 59, 999)
    return { inicio: hoy, fin, label: 'este mes' }
  }

  const diasMap = { domingo:0, lunes:1, martes:2, miercoles:3, jueves:4, viernes:5, sabado:6 }
  for (const [nombre, num] of Object.entries(diasMap)) {
    if (new RegExp(`\\b${nombre}\\b`).test(txLow)) {
      const diaHoy = hoy.getDay()
      let diff = num - diaHoy
      if (diff <= 0) diff += 7
      const ini = new Date(hoy); ini.setDate(ini.getDate()+diff)
      return { inicio: ini, fin: finDia(ini), label: nombre }
    }
  }

  const mesMap = { enero:0, febrero:1, marzo:2, abril:3, mayo:4, junio:5, julio:6, agosto:7, septiembre:8, octubre:9, noviembre:10, diciembre:11 }
  const mFecha = txLow.match(/\bel\s+(\d{1,2})(?:\s+de\s+(\w+))?/)
  if (mFecha) {
    const dia = parseInt(mFecha[1])
    const mes = mFecha[2] !== undefined && mesMap[mFecha[2]] !== undefined ? mesMap[mFecha[2]] : hoy.getMonth()
    if (dia >= 1 && dia <= 31) {
      const ini = new Date(hoy.getFullYear(), mes, dia)
      if (ini < hoy) ini.setFullYear(ini.getFullYear() + 1)
      return { inicio: ini, fin: finDia(ini), label: ini.toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' }) }
    }
  }

  return null
}

function guardarRecordatorios(lista) {
  if (!fs.existsSync(ASISTENTE_DIR)) fs.mkdirSync(ASISTENTE_DIR, { recursive: true })
  fs.writeFileSync(RECORDATORIOS_FILE, JSON.stringify(lista, null, 2))
}

async function parsearRecordatorio(texto) {
  const ahora = new Date()
  const messages = [{
    role: 'user',
    content: `Hoy es ${ahora.toLocaleDateString('es-CO', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}, hora actual: ${ahora.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })}.

Extrae el recordatorio del siguiente mensaje y devuelve JSON.

REGLAS:
- "titulo": descripción del evento (qué es)
- "fechaEvento": fecha y hora del evento en formato ISO8601 (YYYY-MM-DDTHH:MM:00)
- "anticipacion": minutos de anticipación. SOLO si el usuario dice "avísame X antes", "recuérdame X antes", etc. Si NO dice anticipación, usar 0
- "fechaRecordatorio": fechaEvento menos anticipacion minutos (también en ISO8601)
- Si dice "mañana" usa la fecha de mañana
- Si dice "el sábado" o "el lunes" usa el próximo día de esa semana
- Si no menciona hora del evento, pon null en fechaEvento
- Si no es un recordatorio/agenda, responde: {"error":"no_es_recordatorio"}

EJEMPLOS:
- "reunión el sábado 26 a las 9:40, avísame 2 horas antes" → {"titulo":"Reunión","fechaEvento":"2026-04-26T09:40:00","anticipacion":120,"fechaRecordatorio":"2026-04-26T07:40:00"}
- "cita médica mañana 3pm" → {"titulo":"Cita médica","fechaEvento":"2026-04-16T15:00:00","anticipacion":0,"fechaRecordatorio":"2026-04-16T15:00:00"}
- "cumpleaños de mamá el 30" → {"titulo":"Cumpleaños mamá","fechaEvento":"2026-04-30T09:00:00","anticipacion":0,"fechaRecordatorio":"2026-04-30T09:00:00"}
- "partido de fútbol el domingo 8am, avísame 30 minutos antes" → {"titulo":"Partido de fútbol","fechaEvento":"2026-04-19T08:00:00","anticipacion":30,"fechaRecordatorio":"2026-04-19T07:30:00"}

Mensaje: "${texto.replace(/"/g, "'")}"

Responde SOLO con JSON válido:`
  }]

  try {
    const resultado = await llamarGroq(messages)
    if (!resultado) return null
    const respuesta = resultado?.data?.choices?.[0]?.message?.content || ''
    const json = respuesta.replace(/```json\n?|\n?```/g, '').trim()
    return JSON.parse(json)
  } catch { return null }
}

// ─── MÓDULO PROYECTOS / PENDIENTES / IDEAS ───────────────────

function cargarProyectos() {
  try {
    const raw = fs.readFileSync(PROYECTOS_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      console.warn('[PROYECTOS] Archivo no es array, reseteando. Tipo:', typeof parsed, '| Inicio:', raw.substring(0, 80))
      return []
    }
    return parsed
  } catch { return [] }
}

function guardarProyectos(lista) {
  if (!fs.existsSync(GASTOS_DIR)) fs.mkdirSync(GASTOS_DIR, { recursive: true })
  fs.writeFileSync(PROYECTOS_FILE, JSON.stringify(lista, null, 2))
}

async function parsearProyecto(texto) {
  const messages = [{
    role: 'user',
    content: `Clasifica el siguiente mensaje como una entrada de lista personal.

TIPOS:
- "Proyecto": algo a desarrollar, construir, implementar o crear. Ej: "hacer el bot de ventas", "implementar análisis de bolos"
- "Pendiente": algo por hacer, resolver o conseguir pronto. Ej: "conseguir SIM para el bot", "comprar el mini PC", "llamar al contador"
- "Idea": una ocurrencia, propuesta o concepto a explorar. Ej: "usar IA para analizar fotos", "qué tal si hacemos X"

EXTRAE:
- "tipo": "Proyecto" | "Pendiente" | "Idea"
- "titulo": frase corta descriptiva (máx 10 palabras, sin artículos innecesarios). NUNCA incluir verbos introductores como poner, agregar, anotar, crear, guardar, registrar, meter, apuntar, añadir — esos son instrucciones del usuario, no parte del título
- "descripcion": detalle adicional si lo hay, si no null

Si el mensaje NO es claramente un proyecto/pendiente/idea (ej: es un saludo, una pregunta genérica, etc.) → {"error":"no_es_proyecto"}

EJEMPLOS:
- "tengo esta idea: analizar bolos de poliuretano con el bot" → {"tipo":"Idea","titulo":"Analizar bolos de poliuretano con IA","descripcion":"Bot que analiza fotos de muestras en el grupo de producción"}
- "pendiente: conseguir SIM prepago para bot Terrano" → {"tipo":"Pendiente","titulo":"Conseguir SIM prepago para bot Terrano","descripcion":null}
- "quiero desarrollar el bot de ventas para calzado terrano" → {"tipo":"Proyecto","titulo":"Bot de ventas Calzado Terrano","descripcion":null}
- "idea: conectar el asistente al grupo de producción" → {"tipo":"Idea","titulo":"Conectar asistente al grupo de producción","descripcion":null}
- "me queda pendiente llamar al contador mañana" → {"tipo":"Pendiente","titulo":"Llamar al contador","descripcion":null}
- "proyecto: crear plantilla de cotización PDF para Terrano" → {"tipo":"Proyecto","titulo":"Plantilla cotización PDF Terrano","descripcion":null}
- "poner pendiente bicicleta" → {"tipo":"Pendiente","titulo":"Bicicleta","descripcion":null}
- "agrega pendiente llamar al banco" → {"tipo":"Pendiente","titulo":"Llamar al banco","descripcion":null}
- "anota esto: revisar el contrato" → {"tipo":"Pendiente","titulo":"Revisar el contrato","descripcion":null}

Mensaje: "${texto.replace(/"/g, "'")}"

Responde SOLO con JSON válido:`
  }]

  try {
    const resultado = await llamarGroq(messages)
    if (!resultado) return null
    const respuesta = resultado?.data?.choices?.[0]?.message?.content || ''
    const json = respuesta.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(json)
    // Limpiar verbos introductores del título por si la IA los incluyó
    if (parsed?.titulo) {
      parsed.titulo = parsed.titulo
        .replace(/^(poner|agregar|añadir|anotar|crear|guardar|registrar|recordar|meter|incluir|apuntar)\s+/i, '')
        .replace(/\s+(como|de)\s+(pendiente|proyecto|idea|tarea)$/i, '')
        .trim()
      parsed.titulo = parsed.titulo.charAt(0).toUpperCase() + parsed.titulo.slice(1)
    }
    return parsed
  } catch { return null }
}

function formatearPendientesCategorias(lista) {
  const DIVISOR  = '─────────────\n'
  const SEPARADOR = '━━━━━━━━━━━━━━━━━━━━━\n'
  const pendientes = lista.filter(p => p.tipo === 'Pendiente')

  if (pendientes.length === 0) return `⏳ *Pendientes (0)*\n\n_No hay pendientes registrados todavía._`

  const personales = pendientes.filter(p => !p.categoria || p.categoria === 'Personal')
  const terrano    = pendientes.filter(p => p.categoria === 'Terrano')

  let msg = ''

  // ── Personales ──
  msg += `⏳ *Pendientes personales (${personales.length})*\n\n`
  if (personales.length === 0) {
    msg += `_Sin pendientes personales._\n`
  } else {
    personales.forEach((p, i) => {
      msg += `*#${p.numero}* ${p.titulo}\n`
      if (p.descripcion) msg += `_${p.descripcion}_\n`
      if (i < personales.length - 1) msg += DIVISOR
    })
  }

  // ── Separador ──
  msg += `\n${SEPARADOR}`

  // ── Terrano ──
  msg += `⏳ *Pendientes Terrano (${terrano.length})*\n\n`
  if (terrano.length === 0) {
    msg += `_Sin pendientes Terrano._\n`
  } else {
    terrano.forEach((p, i) => {
      msg += `*#${p.numero}* ${p.titulo}\n`
      if (p.descripcion) msg += `_${p.descripcion}_\n`
      if (i < terrano.length - 1) msg += DIVISOR
    })
  }

  return msg.trim()
}

function formatearListaProyectos(lista, filtroTipo = null) {
  const EMOJI = { 'Proyecto': '🚀', 'Pendiente': '⏳', 'Idea': '💡' }
  const items = filtroTipo ? lista.filter(p => p.tipo === filtroTipo) : lista

  if (items.length === 0) {
    const nombre = filtroTipo ? filtroTipo.toLowerCase() + 's' : 'entradas'
    return `📋 No hay ${nombre} registrados todavía.`
  }

  // Siempre mostrar agrupado por tipo, con descripción completa
  let msg = filtroTipo
    ? `${EMOJI[filtroTipo] || '📌'} *${filtroTipo}s (${items.length})*\n\n`
    : `📋 *Proyectos, pendientes e ideas (${items.length})*\n\n`

  const DIVISOR = '─────────────\n'
  const tipos = filtroTipo ? [filtroTipo] : ['Proyecto', 'Pendiente', 'Idea']
  for (const tipo of tipos) {
    const grupo = lista.filter(p => p.tipo === tipo)
    if (grupo.length === 0) continue
    if (!filtroTipo) msg += `${EMOJI[tipo]} *${tipo}s*\n\n`
    grupo.forEach((p, i) => {
      msg += `*#${p.numero}* ${p.titulo}\n`
      if (p.descripcion) msg += `_${p.descripcion}_\n`
      if (i < grupo.length - 1) msg += DIVISOR
      else msg += '\n'
    })
  }
  return msg.trim()
}

// ─── MÓDULO TIEMPO POR PROYECTO ──────────────────────────────

function cargarTiempos() {
  try { return JSON.parse(fs.readFileSync(TIEMPOS_FILE, 'utf-8')) } catch { return [] }
}
function guardarTiempos(lista) {
  fs.writeFileSync(TIEMPOS_FILE, JSON.stringify(lista, null, 2))
}
function cargarTimer() {
  try { return JSON.parse(fs.readFileSync(TIMER_FILE, 'utf-8')) } catch { return null }
}
function guardarTimer(t) {
  if (t) fs.writeFileSync(TIMER_FILE, JSON.stringify(t, null, 2))
  else { try { fs.unlinkSync(TIMER_FILE) } catch {} }
}

async function regenerarExcelTiempos() {
  const tiempos   = cargarTiempos()
  const proyectos = cargarProyectos()
  const wb        = new ExcelJS.Workbook()

  // ── Hoja Resumen ───────────────────────────────────────────
  const wsRes = wb.addWorksheet('Resumen')
  wsRes.columns = [
    { key: 'num',    width: 5  },
    { key: 'titulo', width: 36 },
    { key: 'horas',  width: 12 },
    { key: 'ses',    width: 10 },
    { key: 'ultima', width: 14 },
  ]
  const hdrRes = wsRes.addRow(['#', 'Proyecto', 'Total horas', 'Sesiones', 'Última sesión'])
  hdrRes.eachCell(c => {
    c.font      = { bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }
    c.alignment = { horizontal: 'center', vertical: 'middle' }
  })
  hdrRes.height = 20

  let totalGeneral = 0
  for (const p of proyectos) {
    const sesiones = tiempos.filter(t => t.proyectoId === p.id)
    const totalH   = sesiones.reduce((s, t) => s + (t.horas || 0), 0)
    const ultima   = sesiones.length > 0 ? sesiones[sesiones.length - 1].fecha : '—'
    totalGeneral  += totalH
    const row = wsRes.addRow([p.numero, p.titulo, totalH, sesiones.length, ultima])
    row.getCell(3).numFmt    = '0.00" h"'
    row.getCell(3).font      = { color: { argb: totalH > 0 ? 'FF375623' : 'FF9E9E9E' } }
    row.getCell(1).alignment = { horizontal: 'center' }
    row.getCell(3).alignment = { horizontal: 'center' }
    row.getCell(4).alignment = { horizontal: 'center' }
    row.getCell(5).alignment = { horizontal: 'center' }
  }
  // Fila total
  const totRow = wsRes.addRow(['', 'TOTAL', totalGeneral, '', ''])
  totRow.getCell(2).font  = { bold: true }
  totRow.getCell(3).font  = { bold: true }
  totRow.getCell(3).numFmt = '0.00" h"'
  totRow.getCell(3).border = { top: { style: 'medium' } }
  ;[2,3].forEach(i => totRow.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } })

  // ── Una hoja por proyecto ──────────────────────────────────
  for (const p of proyectos) {
    const sesiones = tiempos.filter(t => t.proyectoId === p.id)
    // Nombre de pestaña: máx 31 chars
    const nombreTab = `P${p.numero} ${p.titulo}`.substring(0, 31)
    const ws = wb.addWorksheet(nombreTab)
    ws.columns = [
      { key: 'num',   width: 5  },
      { key: 'fecha', width: 12 },
      { key: 'horas', width: 10 },
      { key: 'desc',  width: 40 },
    ]
    // Título del proyecto
    ws.mergeCells('A1:D1')
    const titRow = ws.getRow(1)
    titRow.getCell(1).value     = `#${p.numero} — ${p.titulo}`
    titRow.getCell(1).font      = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
    titRow.getCell(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }
    titRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    titRow.height = 22

    const hdr = ws.addRow(['#', 'Fecha', 'Horas', 'Descripción'])
    hdr.eachCell(c => {
      c.font      = { bold: true, color: { argb: 'FFFFFFFF' } }
      c.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } }
      c.alignment = { horizontal: 'center' }
    })

    let totalP = 0
    sesiones.forEach((s, i) => {
      const row = ws.addRow([i + 1, s.fecha, s.horas, s.descripcion || ''])
      row.getCell(1).alignment = { horizontal: 'center' }
      row.getCell(1).font      = { color: { argb: 'FF9E9E9E' }, size: 9 }
      row.getCell(2).alignment = { horizontal: 'center' }
      row.getCell(3).numFmt    = '0.00" h"'
      row.getCell(3).alignment = { horizontal: 'center' }
      row.getCell(3).font      = { color: { argb: 'FF375623' } }
      row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } } })
      totalP += s.horas || 0
    })

    if (sesiones.length > 0) {
      const totP = ws.addRow(['', 'TOTAL', totalP, ''])
      totP.getCell(2).font  = { bold: true }
      totP.getCell(3).font  = { bold: true }
      totP.getCell(3).numFmt = '0.00" h"'
      totP.getCell(3).border = { top: { style: 'medium' } }
      ;[2,3].forEach(i => totP.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } })
    } else {
      ws.addRow(['', 'Sin sesiones registradas', '', ''])
        .getCell(2).font = { italic: true, color: { argb: 'FF9E9E9E' } }
    }
  }

  try {
    await wb.xlsx.writeFile(TIEMPOS_EXCEL)
  } catch (err) {
    if (err.code === 'EBUSY') throw new Error('EXCEL_ABIERTO')
    throw err
  }
}

// ─────────────────────────────────────────────────────────────

async function regenerarExcelProyectos() {
  const lista = cargarProyectos()
  const wb    = new ExcelJS.Workbook()
  const ws    = wb.addWorksheet('Proyectos')

  ws.columns = [
    { key: 'num',   width: 5  },
    { key: 'tipo',  width: 12 },
    { key: 'titulo',width: 36 },
    { key: 'desc',  width: 40 },
    { key: 'fecha', width: 12 },
    { key: 'estado',width: 12 },
  ]

  // Header
  const hdr = ws.addRow(['#', 'Tipo', 'Título', 'Descripción', 'Fecha', 'Estado'])
  hdr.eachCell(c => {
    c.font      = { bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }
    c.alignment = { horizontal: 'center', vertical: 'middle' }
    c.border    = { bottom: { style: 'thin', color: { argb: 'FF2E75B6' } } }
  })
  hdr.height = 20

  // Colores de fondo por tipo
  const COLOR_TIPO = {
    'Proyecto': 'FFD6E4F0',  // azul claro
    'Pendiente':'FFFCE4D6',  // salmón / naranja claro
    'Idea':     'FFE2EFDA',  // verde claro
  }
  const COLOR_TIPO_TEXTO = {
    'Proyecto': 'FF1F4E79',
    'Pendiente':'FFBE4B03',
    'Idea':     'FF375623',
  }

  for (const tipo of ['Proyecto', 'Pendiente', 'Idea']) {
    const grupo = lista.filter(p => p.tipo === tipo)
    if (grupo.length === 0) continue

    for (const p of grupo) {
      const row = ws.addRow([p.numero, p.tipo, p.titulo, p.descripcion || '', p.fecha, p.estado || 'Activo'])
      const fgColor = COLOR_TIPO[p.tipo] || 'FFFFFFFF'
      row.eachCell(c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fgColor } }
        c.alignment = { wrapText: true, vertical: 'top' }
      })
      row.getCell(1).font      = { color: { argb: 'FF9E9E9E' }, size: 9 }
      row.getCell(1).alignment = { horizontal: 'center' }
      row.getCell(2).font      = { bold: true, color: { argb: COLOR_TIPO_TEXTO[p.tipo] || 'FF000000' } }
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'top' }
      row.getCell(3).font      = { bold: false }
    }

    // Fila separadora entre tipos
    const sep = ws.addRow(['', '', '', '', '', ''])
    sep.height = 4
    sep.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } } })
  }

  try {
    await wb.xlsx.writeFile(PROYECTOS_EXCEL)
  } catch (err) {
    if (err.code === 'EBUSY') throw new Error('EXCEL_ABIERTO')
    throw err
  }
}

// ─────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════
//  CAMILA — Bot de marketing de Priority Leather
//  Modo: LOCAL — spawn Python directo (requiere bot corriendo en PC)
// ═══════════════════════════════════════════════════════════════

// Cache de última imagen enviada a Camila por grupo (para replicar/analizar después)
// { [grupoId]: { path: '...', recibida_en: timestamp } }
const ultimaImagenCamila = {}
const CAMILA_IMAGEN_TTL_MIN = 30

// Triggers de productos reconocidos (paralelos al MAPEO en replicar_anuncio.py)
const CAMILA_PRODUCTOS_TRIGGERS = {
  'bolso_tote':        ['tote', 'bolso tote', 'shopping'],
  'bolso_media_luna':  ['media luna', 'half moon', 'crossbody', 'bandolera'],
  'bolso_baul':        ['baul', 'bauleta', 'trunk'],
  'maletin':           ['maletin', 'briefcase', 'ejecutivo', 'morral'],
  'maleta':            ['maleta', 'suitcase', 'viaje', 'luggage'],
  'delantal':          ['delantal', 'mandil', 'apron', 'bbq', 'barbero', 'tatuador', 'chef'],
  'portapasaportes':   ['portapasaporte', 'porta pasaporte', 'pasaporte', 'passport'],
  'billetera':         ['billetera', 'wallet'],
  'estuche_cuchillos': ['cuchillo', 'knife'],
}
const CAMILA_PRODUCTOS_NOMBRES = {
  'bolso_tote': 'Bolso Tote',
  'bolso_media_luna': 'Bolso Media Luna',
  'bolso_baul': 'Bolso Baúl',
  'maletin': 'Maletín',
  'maleta': 'Maleta',
  'delantal': 'Delantal',
  'portapasaportes': 'Porta Pasaportes',
  'billetera': 'Billetera',
  'estuche_cuchillos': 'Estuche para Cuchillos',
}

function camilaDetectarProducto(txLow) {
  for (const [key, triggers] of Object.entries(CAMILA_PRODUCTOS_TRIGGERS)) {
    for (const t of triggers) {
      if (new RegExp(`\\b${t}\\b`).test(txLow)) return key
    }
  }
  return null
}

function camilaDetectarCantidad(txLow) {
  const numerales = { 'una': 1, 'un': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5, 'seis': 6 }
  const m = txLow.match(/(\d+)\s*(?:copia|variante|version|replica)/)
  if (m) return Math.min(6, Math.max(1, parseInt(m[1])))
  for (const [palabra, n] of Object.entries(numerales)) {
    if (new RegExp(`\\b${palabra}\\s+(copia|variante|version|replica)s?\\b`).test(txLow)) return n
  }
  return 1
}

async function procesarCamila(msg, chat) {
  const grupoId = chat.id._serialized
  let texto = msg.body || ''

  // Transcribir audio si viene como nota de voz
  if (msg.hasMedia && (msg.type === 'ptt' || msg.type === 'audio')) {
    const media = await msg.downloadMedia()
    texto = await transcribirAudio(media)
    if (!texto) {
      await client.sendMessage(grupoId, '❌ No pude escuchar el audio.')
      return
    }
  }

  // ── Si llega una IMAGEN: guardarla en memoria y pedir instrucciones ──
  if (msg.hasMedia && (msg.type === 'image' || msg.type === 'sticker')) {
    try {
      const media = await msg.downloadMedia()
      if (!media?.data) return

      const fs_ = require('fs')
      const path_ = require('path')
      const tmpDir = path_.join(CAMILA_BASE_DIR, 'imagenes', 'recibidas')
      fs_.mkdirSync(tmpDir, { recursive: true })
      const ext = (media.mimetype || 'image/jpeg').includes('png') ? 'png' : 'jpg'
      const fname = `recibida_${grupoId.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.${ext}`
      const fpath = path_.join(tmpDir, fname)
      fs_.writeFileSync(fpath, Buffer.from(media.data, 'base64'))

      ultimaImagenCamila[grupoId] = { path: fpath, recibida_en: Date.now() }

      // Si el caption ya trae una orden, procesarla directo en lugar de preguntar
      const caption = (msg.body || '').trim()
      if (caption) {
        texto = caption  // caer al handler de texto más abajo
      } else {
        await client.sendMessage(grupoId,
          '📸 *Imagen recibida.*\n\nDime qué hago:\n' +
          '• *copia con el tote* — replica con ese producto\n' +
          '• *3 copias con la billetera* — varias versiones\n' +
          '• *analiza* — te digo qué producto, estilo y público vende\n' +
          '• *pautas de esta empresa* — detecto la marca y busco sus anuncios activos en Meta Ad Library\n\n' +
          '_(la imagen queda guardada 30 min)_')
        return
      }
    } catch (e) {
      await client.sendMessage(grupoId, `❌ No pude guardar la imagen: ${e.message}`)
      return
    }
  }

  if (!texto.trim()) return

  const txLow = texto.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.!?,;]+$/, '')

  // ── Helper: verificar imagen reciente disponible ──
  function hayImagenReciente() {
    const reg = ultimaImagenCamila[grupoId]
    if (!reg) return false
    if (Date.now() - reg.recibida_en > CAMILA_IMAGEN_TTL_MIN * 60 * 1000) {
      delete ultimaImagenCamila[grupoId]
      return false
    }
    return true
  }

  // ── Comando: REPLICAR (copia/copias/replica/variante/fusila) ──
  const esReplicar = /\b(copia|copias|replicar?|replica|replicas|fusil(a|ar)|variantes?|versiones?|versi[oó]n)\b/.test(txLow)
  if (esReplicar) {
    if (!hayImagenReciente()) {
      await client.sendMessage(grupoId, '⚠️ No tengo imagen reciente. Mándame primero el screenshot del anuncio que quieres replicar.')
      return
    }
    const productoKey = camilaDetectarProducto(txLow)
    if (!productoKey) {
      await client.sendMessage(grupoId,
        '🤔 *¿Con cuál producto?* Dime uno:\n' +
        '• tote | media luna | baúl\n' +
        '• maletín | maleta\n' +
        '• delantal | porta pasaportes\n' +
        '• billetera | cuchillos\n\n' +
        '_Ej: "2 copias con el tote"_')
      return
    }
    const cantidad = camilaDetectarCantidad(txLow)
    const imgPath = ultimaImagenCamila[grupoId].path
    const nombreProd = CAMILA_PRODUCTOS_NOMBRES[productoKey]
    await client.sendMessage(grupoId,
      `🎨 Generando ${cantidad} ${cantidad === 1 ? 'copia' : 'copias'} con *${nombreProd}*...\n` +
      `(~${cantidad * 30}s aprox)`)

    const { spawn } = require('child_process')
    const path_ = require('path')
    const script = path_.join(CAMILA_BASE_DIR, 'replicar_anuncio.py')
    const proc = spawn(CAMILA_PYTHON_EXE, [
      '-u', script, imgPath,
      '--producto', productoKey,
      '--copias', String(cantidad),
      '--caption', texto.trim().slice(0, 200),
    ], { shell: false })

    let salida = ''
    proc.stdout.on('data', d => { salida += d.toString() })
    proc.stderr.on('data', d => { salida += d.toString() })
    proc.on('close', async (code) => {
      const fsm = require('fs')
      const m = salida.match(/RESULTADO_JSON:(\{.*\})/)
      if (!m) {
        await client.sendMessage(grupoId, `❌ Falló la generación.\n\`\`\`\n${salida.slice(-600)}\n\`\`\``)
        return
      }
      let res
      try { res = JSON.parse(m[1]) } catch (e) {
        await client.sendMessage(grupoId, `❌ No pude parsear la respuesta.`)
        return
      }
      if (!res.ok) {
        await client.sendMessage(grupoId, `❌ ${res.error || 'error desconocido'}`)
        return
      }
      const ana = res.analisis || {}
      const resumen = `✅ *${res.copias_generadas}/${res.copias_solicitadas} copias con ${res.producto_priority}*\n\n` +
        `*Análisis del original:*\n` +
        `• Producto: ${ana.producto || '?'}\n` +
        `• Estilo: ${ana.estilo || '?'}\n` +
        `• Emoción: ${ana.emocion || '?'}\n` +
        `• Audiencia: ${ana.audiencia || '?'}`
      await client.sendMessage(grupoId, resumen)
      // Enviar cada imagen generada
      for (const salidaPath of (res.salidas || [])) {
        try {
          if (fsm.existsSync(salidaPath)) {
            const media_ = MessageMedia.fromFilePath(salidaPath)
            await client.sendMessage(grupoId, media_)
          }
        } catch (e) {
          console.error('[CAMILA] Error enviando imagen:', e.message)
        }
      }
    })
    return
  }

  // ── Declarar flags de intención ANTES de los handlers ──
  // Verbos/nouns de acción de auditoría (MUY amplio para cubrir sinónimos)
  const ACCION_AUDITORIA = /\b(audit[oa]r?|auditori[ao]|analiz[oa]r?|analisis|analic[ea]|analizame|dato[s]?\s+(?:de|sobre)?|data\b|metrica[s]?|kpi[s]?|reporte|informe|revis[oa]r?|mir[oa]r?|examin[oa]r?|estudi[oa]r?|historial|history|performance|desempe[nñ]o|estado\s+de|como\s+va|rendimiento|numeros|cifras|resultados)\b/
  const TARGET_PAUTA = /\b(pauta[s]?|anuncio[s]?|creativo[s]?|campa[nñ]a[s]?|ads|meta\s*ads|historico)\b/
  const CONTEXTO_PROPIO = /\b(nuestra[s]?|nuestro[s]?|propia[s]?|propio[s]?|mi[s]?|priority|mia[s]?|mio[s]?)\b/

  const esAuditoria =
       (ACCION_AUDITORIA.test(txLow) && TARGET_PAUTA.test(txLow))
    || (TARGET_PAUTA.test(txLow) && CONTEXTO_PROPIO.test(txLow))
    || /\b(audita|analiza)\s+(?:la\s+)?pauta/.test(txLow)
    || /\b(data|datos)\s+(?:de\s+)?(?:la\s+)?(pauta|ads|meta|anuncios?)/.test(txLow)

  const esPautasComp = !esAuditoria
    && TARGET_PAUTA.test(txLow)
    && /\b(de|del)\s+/.test(txLow)
    && !CONTEXTO_PROPIO.test(txLow)

  const esPautasPropias = esAuditoria

  // ── Comando: ANALIZAR imagen (Gemini Vision sobre imagen reciente) ──
  // Solo dispara si hay imagen reciente Y el texto NO es una petición de auditoría de pauta propia
  const esAnalizarImagen = !esAuditoria
    && !esPautasComp
    && /\b(analiza|analizame|analiza me|analisis|describe|descr[ií]beme|mira|vee|ve[aá]lo|describe|qu[eé]\s+ves)\b/.test(txLow)
    && !/\b(ig|instagram|post|publicacion|cuenta)\b/.test(txLow)
    && hayImagenReciente()
  if (esAnalizarImagen) {
    if (!hayImagenReciente()) {
      await client.sendMessage(grupoId, '⚠️ No tengo imagen reciente. Mándame primero el screenshot.')
      return
    }
    await client.sendMessage(grupoId, '🔍 Analizando imagen con Gemini Vision...')
    const { spawn } = require('child_process')
    const path_ = require('path')
    const script = path_.join(CAMILA_BASE_DIR, 'replicar_anuncio.py')
    const imgPath = ultimaImagenCamila[grupoId].path
    const proc = spawn(CAMILA_PYTHON_EXE, ['-u', script, imgPath, '--solo-analisis'], { shell: false })
    let salida = ''
    proc.stdout.on('data', d => { salida += d.toString() })
    proc.stderr.on('data', d => { salida += d.toString() })
    proc.on('close', async () => {
      const m = salida.match(/RESULTADO_JSON:(\{.*\})/)
      if (!m) { await client.sendMessage(grupoId, `❌ Falló el análisis.\n\`\`\`${salida.slice(-500)}\`\`\``); return }
      try {
        const res = JSON.parse(m[1])
        const ana = res.analisis || {}
        let msgOut = `🔍 *Análisis de la imagen*\n\n`
        if (ana.marca_visible) msgOut += `• *Marca:* ${ana.marca_visible}\n`
        msgOut += `• *Producto:* ${ana.producto || '?'}\n`
        msgOut += `• *Estilo visual:* ${ana.estilo || '?'}\n`
        msgOut += `• *Paleta:* ${ana.paleta || '?'}\n`
        msgOut += `• *Emoción:* ${ana.emocion || '?'}\n`
        msgOut += `• *Público objetivo:* ${ana.audiencia || '?'}\n`
        if (ana.copy_titular) msgOut += `\n💬 *Titular:* ${ana.copy_titular}\n`
        if (ana.copy_texto)   msgOut += `📝 *Texto:* ${ana.copy_texto}\n`
        if (ana.cta)          msgOut += `👉 *CTA:* ${ana.cta}\n`
        msgOut += `\n_Si quieres replicarlo con un producto Priority, dime: "copia con el [tote/maletín/etc]"_`
        await client.sendMessage(grupoId, msgOut)
      } catch (e) {
        await client.sendMessage(grupoId, `❌ Error parseando: ${e.message}`)
      }
    })
    return
  }

  if (esPautasPropias) {
    // Verificar si el token está configurado
    const envToken = process.env.META_ACCESS_TOKEN || ''
    const envAcct  = process.env.META_AD_ACCOUNT_ID || ''
    if (!envToken || envToken === 'PEGUE_AQUI_SU_TOKEN' || !envAcct || envAcct === 'act_1234567890') {
      await client.sendMessage(grupoId,
        '⚠️ *Aún no tengo acceso a tu cuenta Meta Ads.*\n\n' +
        'Para leer las métricas necesito:\n' +
        '1. Un *System User access token* (scopes: ads_read + read_insights + business_management)\n' +
        '2. El *Ad Account ID* (formato act_XXXXXXX)\n\n' +
        'Paso a paso en: *bot-marketing-priority-ai/INSTRUCCIONES_META_TOKEN.md*\n\n' +
        'Cuando los tengas, editas *ARRANCAR_BOT_PERSONAL.bat* y agregas:\n' +
        '```\nset META_ACCESS_TOKEN=EAAxxx...\nset META_AD_ACCOUNT_ID=act_xxx\n```\n\n' +
        'Reinicias el bot y me escribes *audita pauta*.')
      return
    }
    await client.sendMessage(grupoId,
      '🔍 *Iniciando auditoría Meta Ads*\n\n' +
      'Bajando 24 meses de insights (puede tardar 5-15 min).\n' +
      'Te mando el Excel cuando termine.')

    const { spawn } = require('child_process')
    const path_ = require('path')
    const script = path_.join(CAMILA_BASE_DIR, 'meta_ads_auditor.py')
    const proc = spawn(CAMILA_PYTHON_EXE, ['-u', script, '--meses', '24'], {
      shell: false,
      env: { ...process.env },
    })
    let salida = ''
    proc.stdout.on('data', d => { salida += d.toString() })
    proc.stderr.on('data', d => { salida += d.toString() })
    proc.on('close', async (code) => {
      const mr = salida.match(/RESULTADO_JSON:(\{[\s\S]*\})/)
      if (!mr) {
        await client.sendMessage(grupoId, `❌ La auditoría falló (code ${code}).\n\`\`\`${salida.slice(-800)}\`\`\``)
        return
      }
      let res
      try { res = JSON.parse(mr[1]) } catch { await client.sendMessage(grupoId, '❌ No pude parsear resultado.'); return }
      if (!res.ok) { await client.sendMessage(grupoId, `❌ ${res.error || 'error'}`); return }

      const fsm = require('fs')
      let msg_ = `✅ *Auditoría Meta Ads completa*\n\n` +
        `• Filas (ads-mes): ${res.filas}\n` +
        `• Spend acumulado: ${res.spend?.toLocaleString('es-CO', { maximumFractionDigits: 0 })}\n` +
        `• Revenue: ${res.revenue?.toLocaleString('es-CO', { maximumFractionDigits: 0 })}\n` +
        `• *ROAS global: ${res.roas_global}*\n\n` +
        `Excel: ${path_.basename(res.excel)}\n\n` +
        `_Ahora corro el análisis (Fase 2). Dame 30s..._`
      await client.sendMessage(grupoId, msg_)

      // Enviar el Excel
      try {
        if (fsm.existsSync(res.excel)) {
          await client.sendMessage(grupoId, MessageMedia.fromFilePath(res.excel),
            { caption: '📊 Auditoría completa — Ads mensual, Top 20 por ROAS, Losers, Breakdowns' })
        }
      } catch (e) { console.error('[CAMILA] Error enviando Excel auditoría:', e.message) }
    })
    return
  }

  if (esPautasComp) {
    // Extraer marca: lo que venga después de "de"
    let marca = ''
    const m = texto.match(/\b(?:de|del)\s+(?:la\s+|el\s+|los\s+|las\s+)?([A-Za-zÁ-Úá-ú0-9 &._-]{2,40})/i)
    if (m) marca = m[1].trim().replace(/\s+(empresa|marca|pauta|pautas|anuncios?|en\s+meta)\b.*$/i, '').trim()

    // Si usuario solo dijo "mejores pautas" y hay imagen → detectar marca en imagen
    const usarImagen = !marca && hayImagenReciente() && /\b(esta|este)\b/.test(txLow)

    if (!marca && !usarImagen) {
      await client.sendMessage(grupoId,
        '🤔 ¿De qué marca? Ej:\n' +
        '• *pautas de Vélez*\n' +
        '• *mejores anuncios de Dalius*\n\n' +
        'O mándame screenshot de un anuncio y escribe *pautas de esta empresa* — yo detecto la marca.')
      return
    }

    await client.sendMessage(grupoId,
      usarImagen
        ? '🔍 Detectando marca en la imagen + buscando sus pautas activas en Meta Ad Library...'
        : `🔍 Buscando pautas activas de *${marca}* en Meta Ad Library... (abro Chrome, ~30-60s)`)

    const { spawn } = require('child_process')
    const path_ = require('path')
    const script = path_.join(CAMILA_BASE_DIR, 'analizar_pauta_competencia.py')
    const spawnArgs = usarImagen
      ? ['-u', script, '--desde-imagen', ultimaImagenCamila[grupoId].path]
      : ['-u', script, marca, '--max', '15']

    const proc = spawn(CAMILA_PYTHON_EXE, spawnArgs, { shell: false })
    let salida = ''
    proc.stdout.on('data', d => { salida += d.toString() })
    proc.stderr.on('data', d => { salida += d.toString() })
    proc.on('close', async () => {
      const fsm = require('fs')
      const mr = salida.match(/RESULTADO_JSON:(\{[\s\S]*\})/)
      if (!mr) {
        await client.sendMessage(grupoId, `❌ Falló la búsqueda.\n\`\`\`${salida.slice(-600)}\`\`\``)
        return
      }
      let res
      try { res = JSON.parse(mr[1]) } catch { await client.sendMessage(grupoId, '❌ No pude parsear la respuesta.'); return }
      if (!res.ok) {
        await client.sendMessage(grupoId, `❌ ${res.error || 'error'}`)
        return
      }
      let out = `📊 *Pautas activas de ${res.marca}* (${res.pais})\n\n`
      out += `Total encontrado: ${res.total}\n\n`
      if (res.total === 0) {
        out += '_No tiene anuncios activos en Meta ahora mismo (o la marca no es scrappeable por este nombre)._'
      } else {
        out += `*Muestra:*\n`
        for (const a of (res.anuncios || []).slice(0, 5)) {
          const txt = (a.texto || '').replace(/\n+/g, ' ').slice(0, 150)
          out += `• ${a.pagina || '(sin nombre)'}\n  _${txt}..._\n\n`
        }
      }
      out += `\nDatos completos: ${path_.basename(res.json || '')}`
      await client.sendMessage(grupoId, out)
      // Enviar screenshot si existe
      if (res.screenshot && fsm.existsSync(res.screenshot)) {
        try {
          await client.sendMessage(grupoId, MessageMedia.fromFilePath(res.screenshot), { caption: '📸 Overview Meta Ad Library' })
        } catch (e) { console.error('[CAMILA] Error enviando screenshot pauta:', e.message) }
      }
    })
    return
  }

  // ── Comando: analiza ig ──────────────────────────────────────
  if (/\b(analiza|analizar|analisis)\b.*\b(ig|instagram)\b/.test(txLow) || txLow === 'ig' || txLow === 'instagram') {
    await client.sendMessage(grupoId, '🔍 Analizando @priorityleather... puede tardar 1-2 min. Abro Chrome aquí en el PC.')
    const { spawn } = require('child_process')
    const path = require('path')
    const script = path.join(CAMILA_BASE_DIR, 'analizar_instagram.py')
    const proc = spawn(CAMILA_PYTHON_EXE, ['-u', script], { shell: false })
    let salida = ''
    proc.stdout.on('data', d => { salida += d.toString() })
    proc.stderr.on('data', d => { salida += d.toString() })
    proc.on('close', async (code) => {
      if (code !== 0) {
        await client.sendMessage(grupoId, `❌ El análisis falló (código ${code}).\nÚltimas líneas:\n\`\`\`\n${salida.slice(-800)}\n\`\`\``)
        return
      }
      // Extraer datos del output
      const lineas = salida.split('\n')
      const seg  = lineas.find(l => l.includes('Seguidores:'))
      const pubs = lineas.find(l => l.includes('Publicaciones:'))
      const idxTop = lineas.findIndex(l => l.includes('TOP 10'))
      let msgOut = `✅ *Análisis Instagram @priorityleather*\n\n`
      if (seg)  msgOut += seg.trim() + '\n'
      if (pubs) msgOut += pubs.trim() + '\n'
      msgOut += '\n*Top posts (por likes):*\n'
      if (idxTop >= 0) {
        const top = lineas.slice(idxTop + 1, idxTop + 12).filter(l => l.includes('likes')).slice(0, 5)
        msgOut += top.map(l => '• ' + l.trim()).join('\n')
      }
      msgOut += '\n\nDatos completos en bot-marketing-priority-ai/instagram_data/'
      await client.sendMessage(grupoId, msgOut)
    })
    return
  }

  // ── Comando: resumen ig (lee el último JSON guardado) ──
  if (/\b(resumen|ultimo)\b.*\b(ig|instagram)\b/.test(txLow)) {
    const fs = require('fs')
    const path = require('path')
    const dataDir = path.join(CAMILA_BASE_DIR, 'instagram_data')
    try {
      if (!fs.existsSync(dataDir)) {
        await client.sendMessage(grupoId, '❌ Aún no hay análisis previos. Escribe *analiza ig* para generar uno.')
        return
      }
      const archivos = fs.readdirSync(dataDir).filter(f => f.startsWith('analisis_') && f.endsWith('.json'))
      if (archivos.length === 0) {
        await client.sendMessage(grupoId, '❌ No hay análisis previos.')
        return
      }
      archivos.sort().reverse()
      const data = JSON.parse(fs.readFileSync(path.join(dataDir, archivos[0]), 'utf-8'))
      const posts = (data.posts || []).filter(p => p.likes).sort((a, b) => b.likes - a.likes).slice(0, 5)
      let msgOut = `📊 *Último análisis Instagram*\n(archivo: ${archivos[0]})\n\n`
      msgOut += `Seguidores: ${data.perfil?.seguidores_texto || '?'} | Posts: ${data.total_posts_analizados || data.posts?.length}\n\n*Top 5:*\n`
      for (const p of posts) msgOut += `• ${p.likes} likes | ${(p.fecha || '').slice(0, 10)}\n`
      await client.sendMessage(grupoId, msgOut)
    } catch (e) {
      await client.sendMessage(grupoId, `❌ ${e.message}`)
    }
    return
  }

  // ── Comando: resumen / estado (campaña general) ──────────────
  if (/\b(resumen|estado|status)\b/.test(txLow)) {
    const fs = require('fs')
    const path = require('path')
    const anunciosDir = path.join(CAMILA_BASE_DIR, 'anuncios', 'finales')
    let totalAnuncios = 0
    try {
      if (fs.existsSync(anunciosDir)) totalAnuncios = fs.readdirSync(anunciosDir).filter(f => f.endsWith('.png')).length
    } catch (_) {}
    await client.sendMessage(grupoId,
      `📊 *Estado campaña Priority*\n\n` +
      `• Presupuesto pauta: $3.000 USD / $12M COP\n` +
      `• Duración: 1 mes\n` +
      `• Anuncios listos: ${totalAnuncios}\n` +
      `• Publicados en Meta: 0\n` +
      `• Instagram: 56K seguidores\n\n` +
      `Comandos: *analiza ig* | *resumen ig* | *ayuda*`)
    return
  }

  // ── Comando: ayuda ───────────────────────────────────────────
  if (/\b(ayuda|help|comandos)\b/.test(txLow)) {
    await client.sendMessage(grupoId,
      `👋 Hola, soy *Camila*, marketing de Priority.\n\n*Instagram:*\n` +
      `📱 *analiza ig* — análisis nuevo (1-2 min)\n` +
      `📋 *resumen ig* — último análisis guardado\n\n` +
      `*Competencia — espiar pautas activas:*\n` +
      `• *pautas de Vélez* / *mejores anuncios de Dalius* — scrapea Meta Ad Library\n` +
      `• 📸 [manda screenshot] + *pautas de esta empresa* — detecto la marca sola\n\n` +
      `*Replicar anuncios de competencia:*\n` +
      `📸 mándame screenshot → luego dime:\n` +
      `• *copia con el tote* / *2 copias con la billetera* / *3 variantes con el maletín*\n` +
      `• *analiza* — te digo qué producto, estilo y público vende\n\n` +
      `*Productos que sé replicar:* tote, media luna, baúl, maletín, maleta, delantal, porta pasaportes, billetera, cuchillos\n\n` +
      `📊 *resumen* — estado general de la campaña\n` +
      `📈 *audita pauta* / *pautas nuestras* — descarga 24 meses de insights de Meta Ads y devuelve Excel con Top ROAS, Losers, breakdowns (requiere META_ACCESS_TOKEN en .bat — ver INSTRUCCIONES_META_TOKEN.md)\n\n` +
      `_Puedes escribir o mandar nota de voz._`)
    return
  }

  // Default
  await client.sendMessage(grupoId,
    `No entendí. Comandos: *analiza ig* | *resumen ig* | *resumen* | *ayuda*`)
}

// ─────────────────────────────────────────────────────────────

async function procesarAsistente(msg, chat) {
  const grupoId = chat.id._serialized
  let texto = msg.body || ''

  // Transcribir audio
  if (msg.hasMedia && (msg.type === 'ptt' || msg.type === 'audio')) {
    const media = await msg.downloadMedia()
    texto = await transcribirAudio(media)
    if (!texto) {
      await client.sendMessage(grupoId, '❌ No pude escuchar el audio.')
      return
    }
  }

  if (!texto.trim()) return

  // ── Normalizar para detección de comandos ──
  const txLow = texto.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.!?,;]+$/, '')

  // ── Confirmar borrado pendiente ──────────────────────────────
  const accionPend = getPendienteAccion(grupoId + '_asistente')
  if (accionPend) {
    const resp = txLow
    const confirma = /^(si|s|yes|dale|claro|listo|ok|va|eso|1)$/.test(resp)
    const cancela  = /^(no|cancel|para|2)$/.test(resp)
    if (confirma || cancela) {
      borrarPendienteAccion(grupoId + '_asistente')
      if (confirma) {
        if (accionPend.tipo === 'borrar_proyecto') {
          const proyectos = cargarProyectos()
          const idx = proyectos.findIndex(p => p.id === accionPend.itemId)
          if (idx >= 0) {
            const borrado = proyectos.splice(idx, 1)[0]
            guardarProyectos(proyectos)
            regenerarExcelProyectos().catch(() => {})
            const emoji = { 'Proyecto':'🚀', 'Pendiente':'⏳', 'Idea':'💡' }[borrado.tipo] || '📌'
            await client.sendMessage(grupoId, `✅ ${emoji} Borrado: *${borrado.titulo}*`)
          }
        } else if (accionPend.tipo === 'borrar_recordatorio') {
          const listaRec = cargarRecordatorios()
          const idx = listaRec.findIndex(r => r.id === accionPend.itemId)
          if (idx >= 0) {
            const borrado = listaRec.splice(idx, 1)[0]
            guardarRecordatorios(listaRec)
            await client.sendMessage(grupoId, `✅ Recordatorio borrado: *${borrado.titulo}*`)
          }
        }
      } else {
        await client.sendMessage(grupoId, '❌ Cancelado.')
      }
      return
    }
    // Nota a sesión recién parada
    if (accionPend.tipo === 'desc_sesion') {
      borrarPendienteAccion(grupoId + '_asistente')
      const tiempos = cargarTiempos()
      const idx = tiempos.findIndex(t => t.id === accionPend.sesionId)
      if (idx >= 0 && txLow !== 'no' && txLow !== 'n') {
        tiempos[idx].descripcion = texto.trim()
        guardarTiempos(tiempos)
        regenerarExcelTiempos().catch(() => {})
        await client.sendMessage(grupoId, `📝 Nota guardada: _${texto.trim()}_`)
      }
      return
    }
    // Si dijo otra cosa, cancela silenciosamente y procesa normal
    borrarPendienteAccion(grupoId + '_asistente')
  }

  // (El handler de ver agenda está unificado con esVerAgenda más abajo)

  // ── Comandos: ver lista de proyectos/pendientes/ideas/agenda ──
  const _verbo = /(ver|muest|mostr|lista|cual|que\s+(hay|tengo)|dame|quiero|tien|envi|mand|pas[ae]me|pasa|comp[aá]rt|sube|dime|digame|dígame)/
  const esVerAll  = txLow === '/todo'
    || /^todo$/.test(txLow)
    || /\blista\s+completa\b/.test(txLow)
    || (/\btodo\b/.test(txLow) && _verbo.test(txLow))
  const esVerProy = !esVerAll && (
    txLow === '/proyectos'
    || /^proyectos?$/.test(txLow)
    || (/\bproyecto(s)?\b/.test(txLow) && _verbo.test(txLow))
  )
  const esVerPend = !esVerAll && (
    txLow === '/pendientes'
    || /^pendientes?$/.test(txLow)
    || (/\bpendientes?\b/.test(txLow) && _verbo.test(txLow))
  )
  const esVerIdea = !esVerAll && (
    txLow === '/ideas'
    || /^ideas?$/.test(txLow)
    || (/\bideas?\b/.test(txLow) && _verbo.test(txLow))
  )
  const esVerAgenda = !esVerAll && (
    txLow === '/agenda'
    || /^agenda(\s+personal)?$/.test(txLow)
    || (/\bagenda\b/.test(txLow) && _verbo.test(txLow))
    || (/\brecordatorios?\b/.test(txLow) && _verbo.test(txLow))
  )

  if (esVerAll) {
    const proyectos = cargarProyectos()
    const recordatorios = cargarRecordatorios().filter(r => !r.enviado)

    // WhatsApp 1: Pendientes (primero — actividades a desarrollar)
    const tienePend = proyectos.some(p => p.tipo === 'Pendiente')
    if (tienePend) await client.sendMessage(grupoId, formatearPendientesCategorias(proyectos))

    // WhatsApp 2: Proyectos
    const tieneProy = proyectos.some(p => p.tipo === 'Proyecto')
    if (tieneProy) await client.sendMessage(grupoId, formatearListaProyectos(proyectos, 'Proyecto'))

    // WhatsApp 3: Ideas
    const tieneIdea = proyectos.some(p => p.tipo === 'Idea')
    if (tieneIdea) await client.sendMessage(grupoId, formatearListaProyectos(proyectos, 'Idea'))

    // WhatsApp 4: Agenda personal (recordatorios)
    if (recordatorios.length > 0) {
      const DIVISOR = '─────────────\n'
      let msgRec = `📅 *Agenda personal (${recordatorios.length})*\n\n`
      const ordenados = recordatorios.slice().sort((a, b) => new Date(a.fechaEvento) - new Date(b.fechaEvento))
      ordenados.forEach((r, i) => {
        const fe = new Date(r.fechaEvento)
        msgRec += r.numero ? `*#${r.numero}* ${r.titulo}\n` : `• *${r.titulo}*\n`
        msgRec += `  🗓 ${fe.toLocaleDateString('es-CO', { weekday:'short', day:'numeric', month:'short' })} a las ${fe.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })}\n`
        if (i < ordenados.length - 1) msgRec += DIVISOR
      })
      await client.sendMessage(grupoId, msgRec.trim())
    } else {
      await client.sendMessage(grupoId, `📅 *Agenda personal (0)*\n\n_No hay eventos pendientes._`)
    }

    // WhatsApp 5: Ayudas (último)
    await client.sendMessage(grupoId,
      `📋 *Ayudas*\n\n` +
      `Para agregar a la lista:\n` +
      `_"proyecto: ..."_  ·  _"pendiente: ..."_  ·  _"idea: ..."_\n` +
      `_"recuérdame mañana a las 3pm ..."_\n\n` +
      `Para ver el Excel, pídalo con sus palabras.\n` +
      `Para borrar, diga qué quiere borrar y le pregunto antes.`
    )
    return
  }

  if (esVerProy || esVerPend || esVerIdea) {
    const proyectos = cargarProyectos()
    if (esVerPend) {
      await client.sendMessage(grupoId, formatearPendientesCategorias(proyectos))
    } else {
      const filtro = esVerProy ? 'Proyecto' : 'Idea'
      await client.sendMessage(grupoId, formatearListaProyectos(proyectos, filtro))
    }
    return
  }

  if (esVerAgenda) {
    const filtro = parsearFiltroFechaAgenda(txLow)
    let recordatorios = cargarRecordatorios().filter(r => !r.enviado)
    if (filtro) {
      recordatorios = recordatorios.filter(r => {
        const fe = new Date(r.fechaEvento)
        return fe >= filtro.inicio && fe <= filtro.fin
      })
    }
    const titulo = filtro
      ? `📅 *Agenda — ${filtro.label} (${recordatorios.length})*`
      : `📅 *Agenda personal (${recordatorios.length})*`
    if (recordatorios.length === 0) {
      const vacio = filtro
        ? `${titulo}\n\n_No hay eventos para ${filtro.label}._`
        : `${titulo}\n\n_No hay eventos pendientes._`
      await client.sendMessage(grupoId, vacio)
      return
    }
    const DIVISOR = '─────────────\n'
    let msgRec = `${titulo}\n\n`
    const ordenados = recordatorios.slice().sort((a, b) => new Date(a.fechaEvento) - new Date(b.fechaEvento))
    ordenados.forEach((r, i) => {
      const fe = new Date(r.fechaEvento)
      const fr = new Date(r.fechaRecordatorio)
      msgRec += r.numero ? `*#${r.numero}* ${r.titulo}\n` : `• *${r.titulo}*\n`
      msgRec += `  🗓 ${fe.toLocaleDateString('es-CO', { weekday:'short', day:'numeric', month:'short' })} a las ${fe.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })}\n`
      msgRec += `  🔔 Aviso: ${fr.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })}\n`
      if (i < ordenados.length - 1) msgRec += DIVISOR
    })
    await client.sendMessage(grupoId, msgRec.trim())
    return
  }

  // ── Comando: enviar Excel de proyectos ───────────────────────
  const _txExcel = txLow.replace(/[aeiouáéíóú]/g, a => a)  // solo para limpiar
  const esEnviarExcel = /\bexcel\b/.test(txLow)
    || /\b(planilla|archivo|documento|tabla)\b/.test(txLow)
    || txLow === '/excel'
  const tieneVerbo = /(envi|manda|pasa|mand|env|compart|sube)/.test(txLow)

  if (esEnviarExcel && (tieneVerbo || txLow === '/excel')) {
    try {
      await regenerarExcelProyectos()
      const media = MessageMedia.fromFilePath(PROYECTOS_EXCEL)
      await client.sendMessage(grupoId, media, { caption: '📋 Lista de proyectos, pendientes e ideas' })
    } catch (err) {
      if (err.message === 'EXCEL_ABIERTO') {
        await client.sendMessage(grupoId, '⚠️ El archivo Excel está abierto. Ciérralo e intenta de nuevo.')
      } else {
        await client.sendMessage(grupoId, '❌ No pude generar el Excel.')
        console.error('[ASISTENTE] Error Excel proyectos:', err.message)
      }
    }
    return
  }

  // ── Comandos de tiempo ───────────────────────────────────────

  // Ver resumen de tiempos o enviar Excel de tiempos
  const esVerTiempo = /\b(tiempo|horas?|cuanto\s+llevo|cuantas\s+horas|resumen\s+tiempo|registro\s+tiempo)\b/.test(txLow)
  const esExcelTiempo = esEnviarExcel && /\btiemp/.test(txLow)
  const esSoloTiempo  = esVerTiempo && !esEnviarExcel

  if (esExcelTiempo || (esEnviarExcel && tieneVerbo && esVerTiempo)) {
    try {
      await regenerarExcelTiempos()
      const media = MessageMedia.fromFilePath(TIEMPOS_EXCEL)
      await client.sendMessage(grupoId, media, { caption: '⏱️ Registro de tiempo por proyecto' })
    } catch (err) {
      await client.sendMessage(grupoId, err.message === 'EXCEL_ABIERTO' ? '⚠️ El archivo Excel está abierto.' : '❌ No pude generar el Excel de tiempos.')
    }
    return
  }

  if (esSoloTiempo) {
    const tiempos   = cargarTiempos()
    const proyectos = cargarProyectos()
    const timer     = cargarTimer()
    let msg = `⏱️ *Tiempo por proyecto*\n\n`
    for (const p of proyectos) {
      const sesiones = tiempos.filter(t => t.proyectoId === p.id)
      const totalH   = sesiones.reduce((s, t) => s + (t.horas || 0), 0)
      const activo   = timer && timer.proyectoId === p.id ? ' 🔴 _en curso_' : ''
      if (totalH > 0 || activo) {
        msg += `*#${p.numero}* ${p.titulo}\n`
        msg += `  ${totalH.toFixed(1)} h · ${sesiones.length} sesion${sesiones.length !== 1 ? 'es' : ''}${activo}\n\n`
      }
    }
    if (timer) {
      const inicio = new Date(timer.inicio)
      const mins   = Math.round((Date.now() - inicio) / 60000)
      msg += `🔴 *Timer activo:* #${timer.proyectoNumero} ${timer.proyectoTitulo}\n`
      msg += `  Lleva ${mins} min desde las ${inicio.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })}`
    }
    await client.sendMessage(grupoId, msg.trim() || '⏱️ Aún no hay tiempo registrado.')
    return
  }

  // Iniciar timer: "iniciar #3", "empezar proyecto 2", "arranco el #1"
  const mIniciar = txLow.match(/\b(inici|empez|arran|comenz|start)\S*\b.*?#?(\d+)/)
    || txLow.match(/#?(\d+).*\b(inici|empez|arran|comenz|start)\S*\b/)
  if (mIniciar) {
    const numP = parseInt(mIniciar[2] || mIniciar[1])
    const proyectos = cargarProyectos()
    const p = proyectos.find(x => x.numero === numP)
    if (!p) { await client.sendMessage(grupoId, `❌ No encontré el proyecto #${numP}`); return }
    const timerActivo = cargarTimer()
    if (timerActivo) {
      await client.sendMessage(grupoId, `⚠️ Ya hay un timer activo en #${timerActivo.proyectoNumero} ${timerActivo.proyectoTitulo}.\nDiga _"parar"_ primero.`)
      return
    }
    guardarTimer({ proyectoId: p.id, proyectoNumero: p.numero, proyectoTitulo: p.titulo, inicio: new Date().toISOString() })
    await client.sendMessage(grupoId, `🟢 *Timer iniciado*\n\n#${p.numero} ${p.titulo}\n⏰ ${new Date().toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })}`)
    return
  }

  // Parar timer: "parar", "detener", "fin", "stop", "pare"
  const esPararTimer = /^(par[ao]|detuv|deten|fin|stop|termin[ée]|pause|paus[ée])/.test(txLow)
  if (esPararTimer) {
    const timer = cargarTimer()
    if (!timer) { await client.sendMessage(grupoId, '⚠️ No hay ningún timer activo.'); return }
    const inicio = new Date(timer.inicio)
    const horasFin = (Date.now() - inicio) / 3600000
    const horasRed = Math.round(horasFin * 4) / 4  // redondear a cuartos de hora
    guardarTimer(null)
    // Guardar sesión
    const tiempos = cargarTiempos()
    const nuevaSesion = {
      id: Date.now().toString(),
      numero: Math.max(0, ...tiempos.map(t => t.numero || 0)) + 1,
      proyectoId: timer.proyectoId,
      proyectoNumero: timer.proyectoNumero,
      proyectoTitulo: timer.proyectoTitulo,
      fecha: new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' }),
      horas: horasRed,
      descripcion: '',
    }
    tiempos.push(nuevaSesion)
    guardarTiempos(tiempos)
    regenerarExcelTiempos().catch(() => {})
    const totalAcum = tiempos.filter(t => t.proyectoId === timer.proyectoId).reduce((s, t) => s + t.horas, 0)
    await client.sendMessage(grupoId,
      `🔴 *Timer detenido*\n\n#${timer.proyectoNumero} ${timer.proyectoTitulo}\n` +
      `⏱️ Sesión: *${horasRed.toFixed(2)} h* (${Math.round(horasFin * 60)} min)\n` +
      `📊 Total acumulado: *${totalAcum.toFixed(2)} h*\n\n` +
      `_Si quiere agregar una nota a esta sesión, dígala ahora._`
    )
    // Guardar id de sesión pendiente de descripción
    setPendienteAccion(grupoId + '_asistente', { tipo: 'desc_sesion', sesionId: nuevaSesion.id })
    return
  }

  // Registrar tiempo manual: "trabajé 2h en el #3 revisando código"
  const mManual = txLow.match(/\b(\d+[\.,]?\d*)\s*(h\b|hora|horas|min|minuto)\b/)
  const mProy   = txLow.match(/#(\d+)/)
  if (mManual && mProy) {
    let horas = parseFloat(mManual[1].replace(',', '.'))
    if (/min/.test(mManual[2])) horas = horas / 60
    const proyectos = cargarProyectos()
    const p = proyectos.find(x => x.numero === parseInt(mProy[1]))
    if (!p) { await client.sendMessage(grupoId, `❌ No encontré el proyecto #${mProy[1]}`); return }
    // Descripción = lo que reste después de quitar números y palabras clave
    const desc = texto.replace(/\d+[\.,]?\d*\s*(h\b|hora|horas?|min|minutos?)/i, '').replace(/#\d+/g, '')
      .replace(/\b(trabaj[eé]|dediq[ué]|invert[ií]|estuve|estive|le met[ií]|registrar?|en\s+el|en\s+la|en|el|la)\b/gi, '')
      .replace(/\s+/g, ' ').trim()
    const tiempos = cargarTiempos()
    tiempos.push({
      id: Date.now().toString(),
      numero: Math.max(0, ...tiempos.map(t => t.numero || 0)) + 1,
      proyectoId: p.id,
      proyectoNumero: p.numero,
      proyectoTitulo: p.titulo,
      fecha: new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' }),
      horas: Math.round(horas * 100) / 100,
      descripcion: desc,
    })
    guardarTiempos(tiempos)
    regenerarExcelTiempos().catch(() => {})
    const totalAcum = tiempos.filter(t => t.proyectoId === p.id).reduce((s, t) => s + t.horas, 0)
    await client.sendMessage(grupoId,
      `✅ *Tiempo registrado*\n\n#${p.numero} ${p.titulo}\n` +
      `⏱️ ${horas.toFixed(2)} h${desc ? `\n_${desc}_` : ''}\n` +
      `📊 Total acumulado: *${totalAcum.toFixed(2)} h*`
    )
    return
  }

  // Nota a sesión recién detenida
  if (accionPend && accionPend.tipo === 'desc_sesion') {
    // ya se manejó arriba en el bloque de confirmación, pero si llegó aquí es texto libre
  }

  // ── Comando: borrar ──────────────────────────────────────────
  // REGLA: para borrar SIEMPRE se necesita #N y la categoría.
  //   "borrar agenda #2", "borrar proyecto #5", "borrar pendiente #10", "borrar idea #3"
  const matchBorrar = texto.match(/\b(borrar|eliminar|quitar|borra|elimina)\b\s+(.+)/i)
  if (matchBorrar) {
    const termino = matchBorrar[2].trim()
    const termLow = termino.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

    const esAgenda = /\b(agenda|recordatorio(s)?|evento(s)?|cita(s)?|alarm[ae](s)?)\b/.test(termLow)
    const esTipoProyecto = /\b(proyecto(s)?|pendiente(s)?|idea(s)?)\b/.test(termLow)
    const mNum = termino.match(/#?(\d+)/)

    // Falta categoría
    if (!esAgenda && !esTipoProyecto) {
      await client.sendMessage(grupoId,
        `❓ *¿De qué categoría?*\n\nDígame con el número. Ej:\n` +
        `• _"borrar agenda #2"_\n` +
        `• _"borrar proyecto #5"_\n` +
        `• _"borrar pendiente #10"_\n` +
        `• _"borrar idea #3"_`)
      return
    }

    // Falta número
    if (!mNum) {
      const cat = esAgenda ? 'agenda' : /pendiente/.test(termLow) ? 'pendiente' : /idea/.test(termLow) ? 'idea' : 'proyecto'
      await client.sendMessage(grupoId,
        `❓ *¿Cuál número?*\n\nPara borrar un ${cat} dígame el *#N*. Ej:\n_"borrar ${cat} #3"_`)
      return
    }

    const numero = parseInt(mNum[1])

    // Agenda
    if (esAgenda) {
      const listaRec = cargarRecordatorios().filter(r => !r.enviado)
      const idxRec = listaRec.findIndex(r => r.numero === numero)
      if (idxRec >= 0) {
        const item = listaRec[idxRec]
        setPendienteAccion(grupoId + '_asistente', { tipo: 'borrar_recordatorio', itemId: item.id })
        await client.sendMessage(grupoId,
          `🗑️ *¿Confirmas borrar de la agenda?*\n\n📅 *#${item.numero}* ${item.titulo}\n\n1️⃣ Sí\n2️⃣ No`)
      } else {
        await client.sendMessage(grupoId, `❌ No encontré agenda #${numero}`)
      }
      return
    }

    // Proyecto / Pendiente / Idea
    const proyectos = cargarProyectos()
    const idx = proyectos.findIndex(p => p.numero === numero)
    if (idx < 0) {
      await client.sendMessage(grupoId, `❌ No encontré #${numero} en proyectos/pendientes/ideas`)
      return
    }
    const item = proyectos[idx]

    // Si pidió una categoría específica y no coincide con el tipo del item
    const catPedida = /pendiente/.test(termLow) ? 'Pendiente' : /idea/.test(termLow) ? 'Idea' : /proyecto/.test(termLow) ? 'Proyecto' : null
    if (catPedida && catPedida !== item.tipo) {
      await client.sendMessage(grupoId,
        `⚠️ El #${numero} es un *${item.tipo}*, no un *${catPedida}*.\n\n¿Se refiere a éste?\n*#${item.numero}* ${item.titulo}\n\n` +
        `Si sí, dígame: _"borrar ${item.tipo.toLowerCase()} #${numero}"_`)
      return
    }

    const emoji = { 'Proyecto':'🚀', 'Pendiente':'⏳', 'Idea':'💡' }[item.tipo] || '📌'
    setPendienteAccion(grupoId + '_asistente', { tipo: 'borrar_proyecto', itemId: item.id })
    await client.sendMessage(grupoId,
      `🗑️ *¿Confirmas borrar de ${item.tipo.toLowerCase()}s?*\n\n${emoji} *#${item.numero}* ${item.titulo}\n\n1️⃣ Sí\n2️⃣ No`)
    return
  }

  // ── Intentar parsear como recordatorio ──────────────────────
  console.log(`[ASISTENTE] Procesando: ${texto}`)
  const datosRec = await parsearRecordatorio(texto)

  if (datosRec && !datosRec.error) {
    const lista = cargarRecordatorios()
    const numero = Math.max(0, ...lista.map(r => r.numero || 0)) + 1
    const nuevo = {
      id: Date.now().toString(),
      numero,
      titulo: datosRec.titulo,
      fechaEvento: datosRec.fechaEvento,
      fechaRecordatorio: datosRec.fechaRecordatorio,
      anticipacion: datosRec.anticipacion,
      grupoId,
      enviado: false,
    }
    lista.push(nuevo)
    guardarRecordatorios(lista)

    const fechaEvento = new Date(datosRec.fechaEvento)
    const fechaRecord = new Date(datosRec.fechaRecordatorio)
    const avisoTexto = datosRec.anticipacion > 0
      ? `🔔 Te aviso a las ${fechaRecord.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })} (${datosRec.anticipacion} min antes)`
      : `🔔 Te aviso a las ${fechaRecord.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })}`

    await client.sendMessage(grupoId,
      `📅 *Guardado*\n\n` +
      `📌 ${datosRec.titulo}\n` +
      `🗓 ${fechaEvento.toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' })} a las ${fechaEvento.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })}\n` +
      avisoTexto
    )
    return
  }

  // ── Intentar parsear como proyecto/pendiente/idea ────────────
  const datosProy = await parsearProyecto(texto)

  if (datosProy && !datosProy.error) {
    const proyectos = cargarProyectos()
    const maxNum = proyectos.length > 0 ? Math.max(...proyectos.map(p => p.numero || 0)) : 0
    const nuevo = {
      id: Date.now().toString(),
      numero: maxNum + 1,
      tipo: datosProy.tipo,
      titulo: datosProy.titulo,
      descripcion: datosProy.descripcion || null,
      fecha: new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' }),
      estado: 'Activo',
      // Categoría para Pendientes: 'Personal' por defecto, 'Terrano' si menciona la empresa
      categoria: (datosProy.tipo === 'Pendiente')
        ? (/terrano/i.test(texto) ? 'Terrano' : 'Personal')
        : undefined,
    }
    proyectos.push(nuevo)
    guardarProyectos(proyectos)
    regenerarExcelProyectos().catch(() => {})

    const EMOJI = { 'Proyecto':'🚀', 'Pendiente':'⏳', 'Idea':'💡' }
    const emoji = EMOJI[nuevo.tipo] || '📌'
    const etiquetaCat = nuevo.tipo === 'Pendiente' ? ` _(${nuevo.categoria})_` : ''
    let confirmacion = `${emoji} *${nuevo.tipo} agregado*${etiquetaCat}\n\n`
    confirmacion += `*#${nuevo.numero}* ${nuevo.titulo}\n`
    if (nuevo.descripcion) confirmacion += `_${nuevo.descripcion}_\n`
    confirmacion += `\n📋 Di _"ver ${nuevo.tipo.toLowerCase()}s"_ para ver la lista completa`
    await client.sendMessage(grupoId, confirmacion)
    return
  }

  // ── No entendí el mensaje ────────────────────────────────────
  await client.sendMessage(grupoId,
    `📅 *Agenda Personal*\n\n` +
    `Para agenda/recordatorios, dígame la fecha y hora:\n` +
    `_"reunión el lunes 28 a las 10am, avísame 1 hora antes"_\n\n` +
    `Para agregar a la lista:\n` +
    `_"idea: ..."_ · _"pendiente: ..."_ · _"proyecto: ..."_\n\n` +
    `Para ver la lista o el Excel, pídalos con sus palabras.\n` +
    `Para borrar, diga qué quiere borrar y le pregunto antes de hacerlo.`
  )
}

// ─── REVISOR DE RECORDATORIOS (cada minuto) ──────────────────
setInterval(async () => {
  const lista = cargarRecordatorios()
  const ahora = new Date()
  let hubocambios = false

  for (const r of lista) {
    if (r.enviado) continue
    const fechaRecord = new Date(r.fechaRecordatorio)
    if (ahora >= fechaRecord) {
      r.enviado = true
      hubocambios = true
      const fechaEvento = new Date(r.fechaEvento)
      const horaEvento  = fechaEvento.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })
      const fechaStr    = fechaEvento.toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' })
      const anticipoTexto = r.anticipacion > 0
        ? ` _(en ${r.anticipacion} min)_`
        : ''
      const mensaje = `🔔 *Recordatorio*\n\n📌 *${r.titulo}*\n🗓 ${fechaStr} a las *${horaEvento}*${anticipoTexto}`
      try {
        await client.sendMessage(r.grupoId, mensaje)
        console.log(`[ASISTENTE] Recordatorio enviado: ${r.titulo}`)
      } catch (err) {
        console.error(`[ASISTENTE] Error enviando recordatorio:`, err.message)
      }
    }
  }

  if (hubocambios) guardarRecordatorios(lista)
}, 60 * 1000)

// ════════════════════════════════════════════════════════════
// ─── VERIFICACIÓN DE PAGOS POR COMPROBANTE (Jorge - Verificacion Pagos AI)
// ════════════════════════════════════════════════════════════
//
// Cuando llega una imagen al grupo "Jorge - Verificacion Pagos AI":
//   1. Gemini Vision extrae monto/fecha/tipo/referencia del comprobante
//   2. Se busca en Gmail de sbgcorporation1 correos de Bancolombia / Nequi / Daviplata
//      con ese monto en las últimas 24h
//   3. Si match → registra en Excel y confirma con ✅
//   4. Si no → reintenta 2 veces más, cada 5 min. Si nunca aparece → ⚠️

// Modelos de visión en orden de preferencia. Si uno falla, se prueba el siguiente.
// gemini-3-pro-image-preview es el que mejor lee comprobantes (usado por bot Sandra)
const MODELOS_VISION = [
  'gemini-3-pro-image-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
]

async function extraerDatosComprobante(mediaData, mimetype) {
  if (!GEMINI_KEY) { console.error('[VERIF] Falta GEMINI_KEY'); return null }

  const prompt = `Esta imagen es una captura de pantalla de un comprobante de transacción bancaria o de billetera digital (Bancolombia, Nequi, Daviplata, PSE, transferencia, consignación, etc). Los colores pueden variar — fondo oscuro o claro.

Tu tarea: extrae los datos y responde ÚNICAMENTE con un JSON válido (sin markdown, sin explicaciones).

Estructura:
{
  "monto": <número entero, sin puntos ni símbolos. Ejemplo: si dice "$ 2.500.000" devuelve 2500000>,
  "fecha": "<DD/MM/YYYY si se lee, o null>",
  "tipo": "<bancolombia | nequi | daviplata | transferencia | pse | consignacion | otro>",
  "referencia": "<número de comprobante/aprobación/referencia, o null>",
  "remitente": "<nombre de quien envía, o null>",
  "destinatario": "<nombre o cuenta de quien recibe, o null>"
}

Si la imagen claramente NO contiene datos de una transacción de dinero (foto personal, meme, captura de otra app), responde: {"error":"no es comprobante"}

Si hay ALGUNA cifra de dinero visible, intenta extraerla. Mejor extraer lo que se pueda que rechazar.`

  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimetype || 'image/jpeg', data: mediaData } }
      ]
    }]
  }

  for (const modelo of MODELOS_VISION) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${GEMINI_KEY}`
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const json = await resp.json()
      // Si el modelo no existe o falla, probar el siguiente
      if (json.error) {
        console.log(`[VERIF] ${modelo} no disponible (${json.error.code || ''}): ${(json.error.message || '').slice(0, 100)}`)
        continue
      }
      const txt  = json.candidates?.[0]?.content?.parts?.[0]?.text || ''
      console.log(`[VERIF] ${modelo} respondió: ${txt.slice(0, 300)}`)
      // Quitar markdown ```json ... ``` si lo hay
      const limpio = txt.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
      const match = limpio.match(/\{[\s\S]*\}/)
      if (!match) { console.error(`[VERIF] ${modelo} no devolvió JSON parseable`); continue }
      try {
        return JSON.parse(match[0])
      } catch (parseErr) {
        console.error(`[VERIF] ${modelo} JSON inválido:`, parseErr.message)
        continue
      }
    } catch (err) {
      console.error(`[VERIF] Error con ${modelo}:`, err.message)
      continue
    }
  }
  return null
}

// Remitentes que el bot consulta para verificar pagos
// Cada proveedor puede buscarse por remitente (from) o por asunto (subject)
// Nequi personal y Daviplata no envían correos — se reenvían los SMS con
// la app SMS Forwarder al Gmail, y el bot los busca por asunto:
//   SMS 85954 (Nequi)                        → asunto "Nequi SMS"
//   SMS 85888 / 87718 / 89899 (Daviplata)    → asunto "Daviplata SMS"
const REMITENTES_PAGO = [
  { nombre: 'Bancolombia', tipo: 'from',    valor: 'bancolombia'   },
  { nombre: 'Nequi',       tipo: 'subject', valor: 'Nequi SMS'     },
  { nombre: 'Daviplata',   tipo: 'subject', valor: 'Daviplata SMS' },
]

async function buscarPagoEnCorreo(montoBuscado) {
  if (!GMAIL_USER || !GMAIL_APP_PASS) {
    console.error('[VERIF] Falta GMAIL_USER o GMAIL_APP_PASSWORD')
    return null
  }
  const imap = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASS },
    logger: false,
  })
  try {
    await imap.connect()
    const lock = await imap.getMailboxLock('INBOX')
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

      const montoFmt = montoBuscado.toLocaleString('es-CO')  // "1.250.000"
      const montoRaw = String(montoBuscado)                   // "1250000"
      // Patrones: $1.250.000 / $1250000 / por 1.250.000
      const patrones = [
        new RegExp('\\$\\s*' + montoFmt.replace(/\./g, '\\.') + '\\b'),
        new RegExp('\\$\\s*' + montoRaw + '\\b'),
        new RegExp('por\\s+\\$?\\s*' + montoFmt.replace(/\./g, '\\.'), 'i'),
        new RegExp('valor\\s+de\\s+\\$?\\s*' + montoFmt.replace(/\./g, '\\.'), 'i'),
      ]

      // Revisar cada proveedor en orden — el primer match gana
      for (const { nombre, tipo, valor } of REMITENTES_PAGO) {
        const criterio = tipo === 'subject'
          ? { subject: valor, since }
          : { from: valor, since }
        const uids = await imap.search(criterio)
        console.log(`[VERIF] Correos ${nombre} últimas 24h: ${uids.length}`)
        if (!uids.length) continue

        const recientes = uids.slice(-20).reverse()
        for (const uid of recientes) {
          const m = await imap.fetchOne(uid, { source: true, envelope: true })
          const raw = m.source.toString('utf8')
          if (patrones.some(p => p.test(raw))) {
            return {
              proveedor: nombre,
              fecha:     m.envelope.date,
              asunto:    m.envelope.subject,
              uid,
            }
          }
        }
      }
      return null
    } finally {
      lock.release()
    }
  } catch (err) {
    console.error('[VERIF] Error IMAP:', err.message)
    return null
  } finally {
    try { await imap.logout() } catch {}
  }
}

async function verificarPagoDesdeImagen(msg, chat, archivoExcel) {
  const grupoId = chat.id._serialized
  let remitente = 'Dueño'
  try {
    const contact = await msg.getContact()
    remitente = contact.pushname || contact.name || remitente
  } catch {}

  await client.sendMessage(grupoId, '🔍 Leyendo el comprobante...')
  const media = await msg.downloadMedia()
  if (!media?.data) {
    await client.sendMessage(grupoId, '⚠️ No pude descargar la imagen. Reenvíala.')
    return
  }

  const datos = await extraerDatosComprobante(media.data, media.mimetype)
  if (!datos || datos.error || !datos.monto) {
    await client.sendMessage(grupoId,
      '⚠️ No pude leer esto como comprobante de pago.\n\n' +
      'Reenvía una captura más clara o escribe el monto manualmente.'
    )
    return
  }

  const montoNum = parseInt(datos.monto)
  const descBase = (datos.tipo ? datos.tipo.charAt(0).toUpperCase() + datos.tipo.slice(1) : 'Pago')
    + (datos.remitente ? ` - ${datos.remitente}` : '')
    + (datos.referencia ? ` · Ref ${datos.referencia}` : '')

  // 3 intentos, cada uno separado por 5 min
  for (let intento = 1; intento <= 3; intento++) {
    if (intento === 1) {
      await client.sendMessage(grupoId,
        `🔎 Buscando *$${montoNum.toLocaleString('es-CO')}* en correos de Bancolombia, Nequi y Daviplata...`
      )
    } else {
      await client.sendMessage(grupoId,
        `⏳ Aún no aparece. Reintentando en 5 min... (${intento}/3)`
      )
      await new Promise(r => setTimeout(r, 5 * 60 * 1000))
    }

    const match = await buscarPagoEnCorreo(montoNum)
    if (match) {
      // Si Gemini no sacó fecha del comprobante, usar la del correo del banco
      let fechaFinal = datos.fecha
      if (!fechaFinal && match.fecha) {
        const d = new Date(match.fecha)
        fechaFinal = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
      }
      const registro = {
        tipo:         'ingreso',
        monto:        montoNum,
        descripcion:  descBase,
        categoria:    'Pagos',
        subcategoria: null,
        fechaAbono:   fechaFinal || null,
      }
      try {
        await guardarEnExcel(registro, remitente, archivoExcel)
      } catch (err) {
        if (err.message === 'EXCEL_ABIERTO') {
          await client.sendMessage(grupoId, '⚠️ El Excel está abierto. Ciérralo y reenvía la captura.')
        } else {
          await client.sendMessage(grupoId, '⚠️ Error guardando el pago verificado.')
          console.error('[VERIF] Error guardando:', err.message)
        }
        return
      }
      const numTag   = registro._numero ? `#${registro._numero}` : ''
      const fechaTag = fechaFinal ? `📂 ${fechaFinal} · ${numTag}` : `📂 ${numTag}`
      const provTag  = match.proveedor ? `✓ Confirmado en ${match.proveedor}\n\n` : ''
      await client.sendMessage(grupoId,
        `✅ *Pago verificado*\n\n` +
        `$${montoNum.toLocaleString('es-CO')} — ${descBase}\n\n` +
        `${provTag}${fechaTag}`
      )
      return
    }
  }

  // Después de 3 intentos sin éxito
  await client.sendMessage(grupoId,
    `⚠️ *No verificado*\n\n` +
    `No encontré el pago de $${montoNum.toLocaleString('es-CO')} en correos de Bancolombia, Nequi ni Daviplata de las últimas 24h.\n\n` +
    `Revisa manualmente. El comprobante dice:\n` +
    `• Tipo: ${datos.tipo || 'N/A'}\n` +
    (datos.referencia ? `• Ref: ${datos.referencia}\n` : '') +
    (datos.fecha ? `• Fecha: ${datos.fecha}\n` : '')
  )
}

// ════════════════════════════════════════════════════════════

// ─── INICIALIZACIÓN ───────────────────────────────────────────
// ─── ARRANQUE whatsapp-web.js ────────────────────────────────
client.on('qr', (qr) => {
  console.log('\n[QR] Escanee este código con WhatsApp:\n')
  qrcode.generate(qr, { small: true })
  console.log('\n[QR] (si prefiere imagen, copie el texto QR y péguelo en https://qrfy.com)')
})

client.on('authenticated', () => {
  console.log('[WA] ✅ Sesión autenticada')
})

client.on('auth_failure', (m) => {
  console.error('[WA] ❌ Falló autenticación:', m)
})

client.on('disconnected', (reason) => {
  console.log('[WA] ⚠️ Desconectado:', reason)
})

client.on('ready', async () => {
  console.log('\n=========================================')
  console.log('  BOT PERSONAL LISTO')
  console.log('=========================================\n')

  // Cargar JIDs de grupos en caché
  try {
    const chats = await client.getChats()
    const grupos = chats.filter(c => c.isGroup)
    for (const g of grupos) {
      grupoJids[g.id._serialized] = (g.name || '').toLowerCase()
    }
    console.log(`[WA] ${grupos.length} grupos cargados en caché`)

    // Grupo notificaciones
    const grupoGastos = chats.find(c => (c.name || '').toLowerCase() === 'gastos')
    if (grupoGastos) {
      idGrupoNotificaciones = grupoGastos.id._serialized
      console.log(`[BOT] Grupo notificaciones: "${grupoGastos.name}"`)
    }
  } catch (err) {
    console.error('[WA] Error cargando grupos:', err.message)
  }

  // Verificar Groq
  try {
    const resultado = await llamarGroq([{ role: 'user', content: 'Di solo: OK' }])
    if (resultado?.res?.ok) console.log('[Groq] ✅ Conexión OK')
    else console.log(`[Groq] ❌ Error: ${resultado?.data?.error?.message || 'sin respuesta'}`)
  } catch (err) {
    console.log('[Groq] ❌ Error:', err.message)
  }

  // ===== COLA DE ENVÍOS (para asesores Claude) =====
  // Cada asesor (Carlos, Camila, Sandra, etc.) deja en cola_envios/<nombre>/
  // un archivo + un <archivo>.meta.json con { grupo, caption, as_document }
  // y el bot lo envía al grupo. Los mueve a cola_envios/enviados/<asesor>/
  // Usa PROYECTO_DIR (H:\...) no __dirname (C:\bot-personal\) — el bot se copia a C: al arrancar
  const COLA_ENVIOS_DIR = path.join(PROYECTO_DIR, 'cola_envios')
  const COLA_ENVIADOS_DIR = path.join(COLA_ENVIOS_DIR, 'enviados')
  console.log(`[COLA] 📁 vigilando: ${COLA_ENVIOS_DIR}`)

  async function procesarColaEnvios() {
    try {
      if (!fs.existsSync(COLA_ENVIOS_DIR)) return
      if (!fs.existsSync(COLA_ENVIADOS_DIR)) fs.mkdirSync(COLA_ENVIADOS_DIR, { recursive: true })

      const asesores = fs.readdirSync(COLA_ENVIOS_DIR).filter(d => {
        const full = path.join(COLA_ENVIOS_DIR, d)
        try { return fs.statSync(full).isDirectory() && d !== 'enviados' } catch { return false }
      })

      for (const asesor of asesores) {
        const dir = path.join(COLA_ENVIOS_DIR, asesor)
        const metas = fs.readdirSync(dir).filter(f => f.endsWith('.meta.json'))

        for (const metaFile of metas) {
          const metaPath = path.join(dir, metaFile)
          const baseName = metaFile.replace(/\.meta\.json$/, '')
          const archivoPath = path.join(dir, baseName)
          if (!fs.existsSync(archivoPath)) continue

          try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
            const chats = await client.getChats()
            const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
            const target = norm(meta.grupo)
            // Intenta match exacto primero, luego includes (mas tolerante)
            let grupo = chats.find(c => c.isGroup && norm(c.name) === target)
            if (!grupo) grupo = chats.find(c => c.isGroup && norm(c.name).includes(target))

            if (!grupo) {
              const gruposDisponibles = chats.filter(c => c.isGroup).map(c => c.name).slice(0, 20)
              console.log(`[COLA] ⚠️ grupo no encontrado: "${meta.grupo}" (${asesor}/${baseName})`)
              console.log(`[COLA]   grupos disponibles: ${JSON.stringify(gruposDisponibles)}`)
              continue
            }

            const media = MessageMedia.fromFilePath(archivoPath)
            await client.sendMessage(grupo.id._serialized, media, {
              caption: meta.caption || '',
              sendMediaAsDocument: meta.as_document !== false
            })
            console.log(`[COLA] ✅ ${asesor}/${baseName} -> "${meta.grupo}"`)

            const destDir = path.join(COLA_ENVIADOS_DIR, asesor)
            if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
            const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
            fs.renameSync(archivoPath, path.join(destDir, `${ts}_${baseName}`))
            fs.renameSync(metaPath, path.join(destDir, `${ts}_${metaFile}`))
          } catch (err) {
            console.error(`[COLA] ❌ error enviando ${asesor}/${baseName}:`, err.message)
          }
        }
      }
    } catch (err) {
      console.error('[COLA] error general:', err.message)
    }
  }

  setInterval(procesarColaEnvios, 10000)
  console.log('[COLA] 📬 Monitor de cola_envios activo (cada 10s)')
})

// ─── SERVIDOR HTTP (restauración de datos) ───────────────────
const RESTORE_TOKEN = process.env.RESTORE_TOKEN || 'sbg-restore-2026'
const httpServer = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/restaurar-datos') {
    const auth = req.headers['x-token']
    if (auth !== RESTORE_TOKEN) {
      res.writeHead(403); res.end('Forbidden'); return
    }
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try {
        const datos = JSON.parse(body)
        if (!Array.isArray(datos)) throw new Error('Debe ser array')
        guardarDatos(datos, GASTOS_EXCEL)
        console.log(`[RESTORE] gastos_personales_data.json restaurado con ${datos.length} entradas`)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, entradas: datos.length }))
      } catch (e) {
        res.writeHead(400); res.end(e.message)
      }
    })
  } else if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200); res.end('ok')
  } else {
    res.writeHead(404); res.end('Not found')
  }
})
const PORT = parseInt(process.env.PORT || '3000')
httpServer.listen(PORT, () => console.log(`[HTTP] Servidor en puerto ${PORT}`))
// ─────────────────────────────────────────────────────────────

client.initialize()
