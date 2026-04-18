import express from 'express'
import QRCode from 'qrcode'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import ExcelJS from 'exceljs'
import { ImapFlow } from 'imapflow'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── CONFIGURACION ───────────────────────────────────────────
// strip() elimina comillas que Railway a veces incluye en los valores
const strip = v => (v || '').replace(/^["']|["']$/g, '').trim()
const GROQ_API_KEY     = strip(process.env.GROQ_API_KEY)
const GEMINI_KEY       = strip(process.env.GEMINI_KEY)
const GMAIL_USER       = strip(process.env.GMAIL_USER)
const GMAIL_APP_PASS   = strip(process.env.GMAIL_APP_PASSWORD).replace(/\s+/g, '')

// Grupos donde al llegar una imagen, el bot la interpreta como comprobante
// de pago y verifica en el correo de Bancolombia antes de registrar.
const GRUPOS_VERIFICACION_PAGO = ['finanzas priority ai']

// En Railway: PROYECTO_DIR=/app  (variable de entorno)
// En Windows local: apunta a la carpeta del Drive
const PROYECTO_DIR        = strip(process.env.PROYECTO_DIR) || '/app'
const GASTOS_DIR          = path.join(PROYECTO_DIR, 'datos')
const ASISTENTE_DIR       = GASTOS_DIR   // en Railway todo va en la misma carpeta
const APRENDIZAJE_FILE    = path.join(GASTOS_DIR, 'aprendizaje.json')
const PENDIENTE_FILE      = path.join(GASTOS_DIR, 'pendiente.json')
const RECORDATORIOS_FILE  = path.join(ASISTENTE_DIR, 'recordatorios.json')
const PROYECTOS_FILE      = path.join(GASTOS_DIR, 'proyectos.json')
const PROYECTOS_EXCEL     = path.join(GASTOS_DIR, 'proyectos.xlsx')
const TIEMPOS_FILE        = path.join(GASTOS_DIR, 'tiempos.json')
const TIMER_FILE          = path.join(GASTOS_DIR, 'timer_activo.json')
const TIEMPOS_EXCEL       = path.join(GASTOS_DIR, 'tiempos.xlsx')

const GRUPOS_GASTOS = {
  'gastos':                     path.join(PROYECTO_DIR, 'datos', 'gastos_personales.xlsx'),
  'gastos personales':          path.join(PROYECTO_DIR, 'datos', 'gastos_personales.xlsx'),
  'gastos personales ai':       path.join(PROYECTO_DIR, 'datos', 'gastos_personales.xlsx'),
  'gastos empresa':             path.join(PROYECTO_DIR, 'datos', 'gastos_empresa.xlsx'),
  'gastos empresa ai':          path.join(PROYECTO_DIR, 'datos', 'gastos_empresa.xlsx'),
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
  'finanzas priority ai':       path.join(PROYECTO_DIR, 'datos', 'finanzas_priority.xlsx'),
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
  'finanzas priority ai',
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
  'finanzas priority ai':      'Pagos',
}

const GRUPOS_ASISTENTE = ['mi asistente', 'mi asistente ai']

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
console.log('RAILWAY_ENV:', process.env.RAILWAY_ENVIRONMENT || '(no definida)')
console.log('ALL_KEYS_COUNT:', Object.keys(process.env).length)
console.log('ALL_KEYS:', Object.keys(process.env).sort().join(', '))
console.log('NODE_ENV:', process.env.NODE_ENV || '(no definida)')
console.log('=====================')

if (!GROQ_API_KEY) {
  console.log('ADVERTENCIA: Falta GROQ_API_KEY — funciones de IA desactivadas, pero el bot continúa')
}

// ─── EVOLUTION API ────────────────────────────────────────────
const EVOLUTION_URL  = strip(process.env.EVOLUTION_URL)  || 'https://poetic-enthusiasm-production.up.railway.app'
const EVOLUTION_KEY  = strip(process.env.EVOLUTION_KEY)  || 'Terrano2024SecretKey'
const INSTANCE_NAME  = strip(process.env.INSTANCE_NAME)  || 'bot-personal'
const WEBHOOK_URL    = strip(process.env.WEBHOOK_URL)    || ''
const BOT_PORT       = process.env.PORT                  || 3000
// Número personal del dueño — el bot responde cuando le escriben directamente
const NUMERO_DUENO   = strip(process.env.NUMERO_DUENO)   || '573117647723'
const DUENO_JID      = NUMERO_DUENO + '@s.whatsapp.net'

// Caché de JID de grupo → nombre en minúsculas
const grupoJids = {}

async function evGet(ruta) {
  const r = await fetch(`${EVOLUTION_URL}${ruta}`, {
    headers: { 'apikey': EVOLUTION_KEY },
  })
  return r.json()
}

async function evPost(ruta, body) {
  const r = await fetch(`${EVOLUTION_URL}${ruta}`, {
    method: 'POST',
    headers: { 'apikey': EVOLUTION_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return r.json()
}

// Evolution API acepta JIDs @g.us para grupos, pero para chats directos
// prefiere el número limpio sin @s.whatsapp.net
function normalizarChatId(chatId) {
  if (chatId && chatId.endsWith('@s.whatsapp.net')) {
    return chatId.replace('@s.whatsapp.net', '')
  }
  return chatId
}

async function enviarTexto(chatId, texto) {
  try {
    const number = normalizarChatId(chatId)
    await evPost(`/message/sendText/${INSTANCE_NAME}`, { number, text: texto })
  } catch (err) { console.error('[EVO] enviarTexto:', err.message) }
}

async function enviarArchivo(chatId, filePath, caption) {
  try {
    const number    = normalizarChatId(chatId)
    const base64    = fs.readFileSync(filePath).toString('base64')
    const fileName  = path.basename(filePath)
    const mimetype  = fileName.endsWith('.xlsx')
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/octet-stream'
    await evPost(`/message/sendMedia/${INSTANCE_NAME}`, {
      number, mediatype: 'document', mimetype,
      media: base64, fileName, caption: caption || fileName,
    })
  } catch (err) { console.error('[EVO] enviarArchivo:', err.message) }
}

// Objeto "client" compatible — reemplaza whatsapp-web.js sin tocar el resto del código
const client = {
  sendMessage: async (chatId, textOrMedia, options) => {
    if (typeof textOrMedia === 'string') {
      await enviarTexto(chatId, textOrMedia)
    } else if (textOrMedia?._filePath) {
      await enviarArchivo(chatId, textOrMedia._filePath, options?.caption)
    }
  },
  getChats: async () => {
    try {
      const grupos = await evGet(`/group/fetchAllGroups/${INSTANCE_NAME}?getParticipants=false`)
      return (Array.isArray(grupos) ? grupos : []).map(g => ({
        id: { _serialized: g.id },
        name: g.subject || '',
        isGroup: true,
      }))
    } catch { return [] }
  },
}

// Reemplazo de MessageMedia.fromFilePath — devuelve objeto con _filePath
const MessageMedia = {
  fromFilePath: (filePath) => ({ _filePath: filePath }),
}

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
  const desc = descripcion.toLowerCase()
  for (const [clave, categoria] of Object.entries(aprendizaje)) {
    if (desc.includes(clave.toLowerCase())) return categoria
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

MONTOS — entiende todas las formas colombianas:
- "lucas" = miles (5 lucas = 5000, 20 lucas = 20000)
- "un palo" = 1.000.000, "dos palos" = 2.000.000
- "medio" solo = 500, pero "medio millón" = 500000
- "luca" = 1000
- "pesos" se ignora
- "como", "unos", "más o menos" antes del monto = aproximado, usar igual
- "mil" al final: 15mil = 15000, 2mil = 2000
- "millón y medio" = 1500000, "dos millones" = 2000000
- Números 1-99 solos: asumir miles (21 = 21000, 34 = 34000, 80 = 80000)
- Números 100-499 solos: asumir miles también (150 = 150000, 300 = 300000)
- Números 500+ solos: usar tal cual (800 = 800, pero si hay contexto de gasto real, también × 1000)
- OJO transcripción de voz — números hablados a veces quedan con un cero extra: "veintiuno" → "210", "treinta y cuatro" → "340". Si ves un número entre 100-490 que termina en 0 y NO hay "mil", "lucas" ni "palo", probablemente es el número real × 10 por error. Ejemplo: 210 → probablemente era 21 → 21000. 340 → probablemente era 34 → 34000. Aplica criterio: ¿tiene sentido ese gasto en pesos colombianos? Un almuerzo de $210.000 no tiene sentido, $21.000 sí.

CATEGORÍAS:
- Hogar: mercado, domicilios de comida, arriendo, servicios (agua/luz/gas/internet), salud prepagada, farmacia, médico, aseo, limpieza, gasolina, taxi, Uber, bus, parqueadero, peaje, SOAT, taller
- Hijos: colegio, guardería, útiles, Salvador, Violeta, pediatra, ropa niños, juguetes
  → subcategoria "Salvador": si menciona solo a Salvador (bicicleta salvador, tenis salvador, cuadernos salvador)
  → subcategoria "Violeta": si menciona solo a Violeta (ropa violeta, zapatos violeta, violeta necesitaba)
  → subcategoria "Ambos": si menciona ambos nombres, o dice "los niños", "los hijos", "los dos", "ambos", o es un gasto sin nombre específico como "colegio niños", "uniforme", "matrícula"
- Ocio: restaurante, almuerzo/cena fuera, bar, café, trago, cerveza, cine, viaje, hotel, peluquería, motilada, deporte, pádel, rumba, gym, gimnasio, entretenimiento
- Otros: si no encaja claramente en ninguna

DESCRIPCIÓN: escribe algo natural y descriptivo, no solo la palabra clave. Ej: "Almuerzo en el centro", "Gasolina full tank", "Cerveza con amigos"

TIPO: "gasto" por defecto. "ingreso" solo si claramente recibió plata (le pagaron, consignaron, etc.)

Si el mensaje es una instrucción para borrar, corregir o modificar algo (borra, elimina, era X no Y, estaba mal, cambia, etc.) → {"error":"no_entendido"}
Si NO hay ninguna referencia a dinero o monto → {"error":"no_entendido"}

EJEMPLOS:
- "almorcé en el centro, pagué como 15 lucas" → {"tipo":"gasto","monto":15000,"categoria":"Ocio","subcategoria":null,"descripcion":"Almuerzo en el centro"}
- "fui al gym hoy, 80" → {"tipo":"gasto","monto":80000,"categoria":"Ocio","subcategoria":null,"descripcion":"Gimnasio"}
- "se me fue un palo en el mercado" → {"tipo":"gasto","monto":1000000,"categoria":"Hogar","subcategoria":null,"descripcion":"Mercado"}
- "pagué el arriendo, 2 millones y medio" → {"tipo":"gasto","monto":2500000,"categoria":"Hogar","subcategoria":null,"descripcion":"Arriendo"}
- "tomé unas cervezas con los parceros anoche, como 35 lucas" → {"tipo":"gasto","monto":35000,"categoria":"Ocio","subcategoria":null,"descripcion":"Cervezas con amigos"}
- "le compré útiles a salvador, 45000" → {"tipo":"gasto","monto":45000,"categoria":"Hijos","subcategoria":"Salvador","descripcion":"Útiles escolares Salvador"}
- "me consignaron el arriendo del local, 800" → {"tipo":"ingreso","monto":800000,"categoria":"Otros","subcategoria":null,"descripcion":"Arriendo local recibido"}
- "violeta necesitaba zapatos pa el colegio, 120" → {"tipo":"gasto","monto":120000,"categoria":"Hijos","subcategoria":"Violeta","descripcion":"Zapatos colegio Violeta"}
- "tanqueé, 180 lucas" → {"tipo":"gasto","monto":180000,"categoria":"Hogar","subcategoria":null,"descripcion":"Gasolina"}
- "colegio de los niños, 800" → {"tipo":"gasto","monto":800000,"categoria":"Hijos","subcategoria":"Ambos","descripcion":"Colegio niños"}
- "matricula, 2 palos" → {"tipo":"gasto","monto":2000000,"categoria":"Hijos","subcategoria":"Ambos","descripcion":"Matrícula"}

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
        || archivoExcel.includes('stella') || archivoExcel.includes('juancho') || archivoExcel.includes('finanzas_priority')

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
  lista.push({
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
  })
  guardarDatos(lista, archivoExcel)
  await regenerarExcel(archivoExcel)

  datos._numero = numero  // pasar el número al confirmar
  console.log(`[GASTOS] ✅ #${numero} ${datos.tipo} $${Math.abs(datos.monto).toLocaleString('es-CO')} — ${datos.descripcion} [${datos.categoria}]`)
}

// ─── CONFIRMAR Y GUARDAR ─────────────────────────────────────
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
  // Mensaje especial para grupos de abono
  if (datos.categoria === 'Abono') {
    const numTag    = datos._numero ? `#${datos._numero}` : ''
    const fechaTag  = datos.fechaAbono ? `📂 ${datos.fechaAbono} · ${numTag}` : `📂 ${numTag}`
    await client.sendMessage(grupoId,
      `💸 *Abono registrado*\n\n` +
      `$${Math.abs(datos.monto).toLocaleString('es-CO')} — ${datos.descripcion}\n\n` +
      `${fechaTag}`
    )
    return
  }

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

  // ── BORRAR / CORREGIR por número: "borra el #5", "eliminar gasto numero 1", "el #8 era 32 no 320" ─
  const mNumRef = t.match(/#(\d+)/)
    || t.match(/\b(?:numero|gasto)\b\s+(?:numero\s+)?#?(\d+)/)
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
    idx = lista.findLastIndex(e => e.numero === num)
    if (idx < 0) {
      await client.sendMessage(grupoId, `❌ No encontré el gasto *#${num}*`)
      return true
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
    await client.sendMessage(grupoId,
      `✅ *Corregido*\n_${descAnterior}_ → *${entrada.descripcion}*`
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
      await client.sendMessage(grupoId,
        `✅ *Corregido*\n_${entrada.descripcion}_\n$${Math.abs(anterior).toLocaleString('es-CO')} → *$${Math.abs(entrada.monto).toLocaleString('es-CO')}*`)
    } else if (accion === 'corregir_categoria') {
      entrada.categoria = valorNuevo
      guardarDatos(lista, archivoExcel)
      await regenerarExcel(archivoExcel)
      aprenderCategoria(entrada.descripcion, valorNuevo)
      await client.sendMessage(grupoId,
        `✅ *Corregido*\n_${entrada.descripcion}_\n${catAnterior} → *${entrada.categoria}*`)
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

  // ── Imagen en grupo de verificación (Finanzas Priority AI) ──
  if (msg.hasMedia && msg.type === 'image' && GRUPOS_VERIFICACION_PAGO.includes(chat.name.toLowerCase())) {
    await verificarPagoDesdeImagen(msg, chat, archivoExcel)
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

  // ── Enviar Excel ─────────────────────────────────────────
  const _t = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const _tieneArchivo = /\b(excel|archivo|planilla|hoja)\b/.test(_t)
  const _tieneVerbo   = /\benv[ií]|envi[aeo]|mand[aeo]|pas[ao]|comparte|adjunta|necesito|quiero|dame|muestrame|ver\b/.test(_t)
  const esEnviarExcel = (_tieneArchivo && _tieneVerbo)
    || /^\/excel$/i.test(texto.trim())
    || /\b(excel|archivo).*(actualizado|al\s+día|por\s+favor|porfavor)/i.test(texto)
    || texto.trim().toLowerCase() === '/excel'
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
    // "mover X a Y" / "moverlo a Y"
    const m1c = texto.match(new RegExp(`(?:mover?|pasarlo?|llevarlo?)(?:\\s+.+?)?\\s+a\\s+${CATS_RE}`, 'i'))
    if (m1c) {
      // Si dice "moverlo" sin descripción, usar el último gasto
      descCorr = 'ultimo'
      catCorr  = m1c[1]
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
    const mNumCorr = descLimpia.match(/(?:gasto\s+(?:numero\s+)?#?|#)(\d+)$/)
      || descLimpia.match(/^#?(\d{1,4})$/)
    if (descCorr === 'ultimo') {
      entrada = lista[lista.length - 1]
    } else if (mNumCorr) {
      const num = parseInt(mNumCorr[1])
      entrada = lista.slice().reverse().find(e => e.numero === num)
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
    const idx = lista.findLastIndex(e => e.numero === num)
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
    const idx      = lista.findLastIndex(e => e.numero === numIdx)
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
  const palabrasEdicion = /\b(borra(?:r[eé]?|me)?|borre|elimina(?:r[eé]?)?|elimine|quita(?:r[eé]?|me)?|quite|correg|modifica|estaba\s+mal|no\s+era|ese\s+era|eso\s+era)\b|#\d+/i
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
    await client.sendMessage(grupoId,
      `💸 No registré ningún gasto — faltó el monto.\n\n` +
      `Dime cuánto fue, por ejemplo:\n` +
      `• _"almuerzo 15000"_\n` +
      `• _"taxi 8 lucas"_\n` +
      `• _"gasté 50 en gasolina"_`
    )
    return
  }

  // ── Categoría fija por grupo (ej: Abono en Pago Stella/Juancho) ──
  const categoriaFija = GRUPOS_CATEGORIA_FIJA[chat.name.toLowerCase()]
  if (categoriaFija) {
    datos.categoria = categoriaFija
    let remitente = msg.author ? msg.author.replace('@c.us', '') : 'Desconocido'
    try { const contact = await msg.getContact(); remitente = contact.pushname || contact.name || remitente } catch {}

    // ¿Menciona a Beatriz? → guardar también en su Excel y notificarle
    const mencionaBeatriz = /beatriz/i.test(datos.descripcion) || /beatriz/i.test(texto)
    const excelBeatriz = path.join(PROYECTO_DIR, 'datos', 'pagos_beatriz.xlsx')
    if (mencionaBeatriz && archivoExcel !== excelBeatriz) {
      // 1. Confirmar en el grupo de Juancho
      await confirmarYGuardar(grupoId, datos, remitente, archivoExcel)
      // 2. Guardar en Excel de Beatriz y notificarle en su chat
      try {
        await guardarEnExcel(datos, remitente, excelBeatriz)
        console.log(`[ABONO] Copiado al Excel de Beatriz: ${datos.descripcion}`)
        // Buscar el chat de Beatriz y enviarle la misma confirmación
        const chats = await client.getChats()
        const chatBeatriz = chats.find(c => {
          const n = c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          return Object.keys(CHATS_DIRECTOS_GASTOS).some(k => n === k)
        })
        if (chatBeatriz) {
          const numTag   = datos._numero ? `#${datos._numero}` : ''
          const fechaTag = datos.fechaAbono ? `📂 ${datos.fechaAbono} · ${numTag}` : `📂 ${numTag}`
          await client.sendMessage(chatBeatriz.id._serialized,
            `💸 *Abono registrado*\n\n` +
            `$${Math.abs(datos.monto).toLocaleString('es-CO')} — ${datos.descripcion}\n\n` +
            `${fechaTag}`
          )
        }
      } catch (err) {
        console.error('[ABONO] Error copiando a Beatriz:', err.message)
      }
    } else {
      await confirmarYGuardar(grupoId, datos, remitente, archivoExcel)
    }
    return
  }

  // ── Verificar aprendizaje previo ──────────────────────────
  const categoriaAprendida = buscarEnAprendizaje(datos.descripcion)
  if (categoriaAprendida) {
    datos.categoria = categoriaAprendida
    console.log(`[APRENDIZAJE] Usando categoría aprendida: "${datos.descripcion}" → ${categoriaAprendida}`)
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
}

// ─── OBTENER NOMBRE DE GRUPO POR JID ─────────────────────────
async function obtenerNombreGrupo(jid) {
  if (grupoJids[jid]) return grupoJids[jid]
  try {
    const info = await evGet(`/group/findGroupInfos/${INSTANCE_NAME}?groupJid=${encodeURIComponent(jid)}`)
    const nombre = (info?.subject || '').toLowerCase()
    if (nombre) grupoJids[jid] = nombre
    return nombre
  } catch { return '' }
}

// ─── EXPRESS WEBHOOK SERVER ───────────────────────────────────
const app = express()
app.use(express.json({ limit: '50mb' }))

app.get('/', (_req, res) => res.send('Bot Personal OK ✅'))

// Evolution API puede enviar a /webhook o a /webhook/messages-upsert
async function manejarWebhook(req, res) {
  res.sendStatus(200)  // responder rápido a Evolution API
  try {
    const payload = req.body
    const evento = payload.event || req.params?.evento?.replace(/-/g, '.') || ''
    if (evento && evento !== 'messages.upsert') return
    const data = payload.data
    if (!data?.key) return

    const { key, message, messageType, pushName } = data
    const chatId  = key.remoteJid
    const fromMe  = key.fromMe === true
    const isGroup = chatId?.endsWith('@g.us')

    if (!chatId) return
    if (chatId === 'status@broadcast') return
    if (chatId.includes('broadcast')) return

    // Resolver nombre del chat
    let chatName = ''
    if (isGroup) {
      chatName = await obtenerNombreGrupo(chatId)
    } else {
      // Chat directo: buscar en caché por JID o usar pushName
      chatName = grupoJids[chatId] || (pushName || '').toLowerCase()
    }

    // Texto del mensaje
    const bodyText = message?.conversation
      || message?.extendedTextMessage?.text
      || ''

    // Tipo de media
    const esAudio  = messageType === 'audioMessage' || messageType === 'pttMessage'
    const esImagen = messageType === 'imageMessage'
    const tieneMedia = esAudio || esImagen || messageType === 'documentMessage'

    // Objeto compatible con el código existente
    const msgObj = {
      body:    bodyText,
      fromMe,
      from:    chatId,
      to:      fromMe ? chatId : null,
      author:  key.participant || key.remoteJid,
      hasMedia: tieneMedia,
      type:    messageType === 'pttMessage' ? 'ptt'
             : messageType === 'audioMessage' ? 'audio'
             : messageType === 'imageMessage' ? 'image' : 'chat',
      async downloadMedia() {
        const r = await evPost(`/chat/getBase64FromMediaMessage/${INSTANCE_NAME}`, { message: data })
        return { data: r.base64, mimetype: r.mimetype || 'audio/ogg' }
      },
      async getContact() { return { pushname: pushName, name: pushName } },
      async getChat()    { return chatObj },
    }
    const chatObj = {
      id:      { _serialized: chatId },
      name:    chatName,
      isGroup,
    }

    const EMOJIS_BOT = ['💸','💰','❓','📊','❌','✅','⚠','🔔','📅','🗑️','✏️','🎙️','📂','📌','🍽️','📋','🚀','⏳','💡','⏱️','🔴','🟢','🟠','🔵','🔍','🔎']
    const esRespuestaBot = EMOJIS_BOT.some(e => bodyText.startsWith(e))

    if (!fromMe && isGroup) {
      // Mensajes de otros en grupos
      if (GRUPOS_SOLO_DUENO.includes(chatName)) {
        const txt = bodyText.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        if (/^enviar\s+resumen$|^\/resumen$/.test(txt)) await routearMensaje(msgObj, chatObj)
        return
      }
      await routearMensaje(msgObj, chatObj)
    } else if (fromMe && isGroup && !esRespuestaBot) {
      // Mensajes del dueño en grupos
      console.log(`[BOT] Dueño en grupo "${chatName}": ${bodyText}`)
      await routearMensaje(msgObj, chatObj)
    } else if (fromMe && !isGroup && !esRespuestaBot) {
      // Mensajes del dueño en chats directos (el bot escribe desde su propio número)
      if (Object.keys(CHATS_DIRECTOS_GASTOS).some(n => chatName === n)) {
        console.log(`[BOT] Dueño en chat directo "${chatName}": ${bodyText}`)
        await routearMensaje(msgObj, chatObj)
      } else {
        console.log(`[WH] fromMe chat directo sin handler: chatName="${chatName}"`)
      }
    } else if (!fromMe && !isGroup && chatId === DUENO_JID && !esRespuestaBot) {
      // Dueño le escribe al bot desde su número personal (chat directo inverso)
      console.log(`[BOT] Dueño → bot directo: "${bodyText}"`)
      chatObj.name = 'mi asistente'
      await routearMensaje(msgObj, chatObj)
    } else {
      console.log(`[WH] ignorado: fromMe=${fromMe} isGroup=${isGroup} chatId=${chatId}`)
    }
  } catch (err) {
    console.error('[WEBHOOK] Error:', err.message, '\n', err.stack)
  }
}

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
- "titulo": frase corta descriptiva (máx 10 palabras, sin artículos innecesarios)
- "descripcion": detalle adicional si lo hay, si no null

Si el mensaje NO es claramente un proyecto/pendiente/idea (ej: es un saludo, una pregunta genérica, etc.) → {"error":"no_es_proyecto"}

EJEMPLOS:
- "tengo esta idea: analizar bolos de poliuretano con el bot" → {"tipo":"Idea","titulo":"Analizar bolos de poliuretano con IA","descripcion":"Bot que analiza fotos de muestras en el grupo de producción"}
- "pendiente: conseguir SIM prepago para bot Terrano" → {"tipo":"Pendiente","titulo":"Conseguir SIM prepago para bot Terrano","descripcion":null}
- "quiero desarrollar el bot de ventas para calzado terrano" → {"tipo":"Proyecto","titulo":"Bot de ventas Calzado Terrano","descripcion":null}
- "idea: conectar el asistente al grupo de producción" → {"tipo":"Idea","titulo":"Conectar asistente al grupo de producción","descripcion":null}
- "me queda pendiente llamar al contador mañana" → {"tipo":"Pendiente","titulo":"Llamar al contador","descripcion":null}
- "proyecto: crear plantilla de cotización PDF para Terrano" → {"tipo":"Proyecto","titulo":"Plantilla cotización PDF Terrano","descripcion":null}

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
  const _verbo = /(ver|muest|lista|cual|que\s+(hay|tengo)|dame|quiero|tien|envi|mand|pas[ae]me|pasa|comp[aá]rt|sube)/
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
// ─── VERIFICACIÓN DE PAGOS POR COMPROBANTE (Finanzas Priority AI)
// ════════════════════════════════════════════════════════════
//
// Cuando llega una imagen al grupo "Finanzas Priority AI":
//   1. Gemini Vision extrae monto/fecha/tipo/referencia del comprobante
//   2. Se busca en Gmail de sbgcorporation1 correos de Bancolombia
//      con ese monto en las últimas 24h
//   3. Si match → registra en Excel y confirma con ✅
//   4. Si no → reintenta 2 veces más, cada 5 min. Si nunca aparece → ⚠️

async function extraerDatosComprobante(mediaData, mimetype) {
  if (!GEMINI_KEY) { console.error('[VERIF] Falta GEMINI_KEY'); return null }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`
  const prompt = `Esta es la captura de un comprobante de pago (transferencia bancaria, Nequi, Daviplata, PSE, consignación, etc).

Extrae los siguientes datos. Responde SOLO con JSON válido, sin texto extra:

{
  "monto": <número entero sin puntos ni símbolos, ejemplo: 250000>,
  "fecha": "DD/MM/YYYY" si se ve claramente, o null,
  "tipo": "nequi" | "daviplata" | "transferencia" | "pse" | "consignacion" | "otro",
  "referencia": "<número de aprobación o referencia>" o null,
  "remitente": "<nombre o número de quien paga>" o null,
  "destinatario": "<nombre o cuenta destino>" o null
}

Si la imagen NO es un comprobante de pago, responde exactamente:
{"error":"no es comprobante"}`

  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimetype || 'image/jpeg', data: mediaData } }
      ]
    }]
  }
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const json = await resp.json()
    const txt  = json.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const match = txt.match(/\{[\s\S]*\}/)
    if (!match) { console.error('[VERIF] Gemini no devolvió JSON:', txt.slice(0, 200)); return null }
    return JSON.parse(match[0])
  } catch (err) {
    console.error('[VERIF] Error Gemini Vision:', err.message)
    return null
  }
}

async function buscarPagoEnBancolombia(montoBuscado) {
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
      // Buscar correos de Bancolombia en las últimas 24h
      const uids = await imap.search({ from: 'bancolombia', since })
      console.log(`[VERIF] Correos Bancolombia últimas 24h: ${uids.length}`)
      if (!uids.length) return null

      const montoFmt = montoBuscado.toLocaleString('es-CO')  // "1.250.000"
      const montoRaw = String(montoBuscado)                   // "1250000"
      // Patrones: $1.250.000 / $1250000 / por 1.250.000
      const patrones = [
        new RegExp('\\$\\s*' + montoFmt.replace(/\./g, '\\.') + '\\b'),
        new RegExp('\\$\\s*' + montoRaw + '\\b'),
        new RegExp('por\\s+\\$?\\s*' + montoFmt.replace(/\./g, '\\.'), 'i'),
        new RegExp('valor\\s+de\\s+\\$?\\s*' + montoFmt.replace(/\./g, '\\.'), 'i'),
      ]

      // Revisar los 20 más recientes
      const recientes = uids.slice(-20).reverse()
      for (const uid of recientes) {
        const m = await imap.fetchOne(uid, { source: true, envelope: true })
        const raw = m.source.toString('utf8')
        if (patrones.some(p => p.test(raw))) {
          return {
            fecha:   m.envelope.date,
            asunto:  m.envelope.subject,
            uid,
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
        `🔎 Buscando *$${montoNum.toLocaleString('es-CO')}* en correos de Bancolombia...`
      )
    } else {
      await client.sendMessage(grupoId,
        `⏳ Aún no aparece. Reintentando en 5 min... (${intento}/3)`
      )
      await new Promise(r => setTimeout(r, 5 * 60 * 1000))
    }

    const match = await buscarPagoEnBancolombia(montoNum)
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
      await client.sendMessage(grupoId,
        `✅ *Pago verificado*\n\n` +
        `$${montoNum.toLocaleString('es-CO')} — ${descBase}\n\n` +
        `${fechaTag}`
      )
      return
    }
  }

  // Después de 3 intentos sin éxito
  await client.sendMessage(grupoId,
    `⚠️ *No verificado*\n\n` +
    `No encontré el pago de $${montoNum.toLocaleString('es-CO')} en los correos de Bancolombia de las últimas 24h.\n\n` +
    `Revisa manualmente. El comprobante dice:\n` +
    `• Tipo: ${datos.tipo || 'N/A'}\n` +
    (datos.referencia ? `• Ref: ${datos.referencia}\n` : '') +
    (datos.fecha ? `• Fecha: ${datos.fecha}\n` : '')
  )
}

// ════════════════════════════════════════════════════════════

// ─── INICIALIZACIÓN ───────────────────────────────────────────
async function inicializarEvolution() {
  // 1. Crear instancia si no existe
  try {
    const estado = await evGet(`/instance/connectionState/${INSTANCE_NAME}`)
    if (estado?.instance?.state === 'open') {
      console.log('[EVO] ✅ Instancia ya conectada')
    } else {
      // Intentar crear
      try {
        await evPost('/instance/create', {
          instanceName: INSTANCE_NAME,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        })
        console.log('[EVO] Instancia creada:', INSTANCE_NAME)
      } catch {
        console.log('[EVO] La instancia ya existe, continuando...')
      }

      // Esperar QR y escanearlo
      console.log('\n[QR] Esperando QR de WhatsApp...')
      let intentosQR = 0
      while (intentosQR < 40) {
        await new Promise(r => setTimeout(r, 3000))
        intentosQR++
        try {
          // Verificar estado primero
          const nuevoEstado = await evGet(`/instance/connectionState/${INSTANCE_NAME}`)
          if (nuevoEstado?.instance?.state === 'open') {
            console.log('[EVO] ✅ WhatsApp conectado!')
            break
          }

          // Pedir QR
          const conexion = await evGet(`/instance/connect/${INSTANCE_NAME}`)
          console.log(`[QR] Respuesta Evolution: ${JSON.stringify(conexion).substring(0, 100)}`)

          // Buscar QR en cualquier campo posible
          const qrBase64 = conexion?.base64 || conexion?.qrcode?.base64 || conexion?.qr?.base64
          const qrCode   = conexion?.code   || conexion?.qrcode?.code   || conexion?.qr?.code

          if (qrBase64) {
            const dataUrl = qrBase64.startsWith('data:') ? qrBase64 : `data:image/png;base64,${qrBase64}`
            fs.writeFileSync(path.join(GASTOS_DIR, 'qr_url.txt'), dataUrl)
            console.log('[QR] ✅ QR guardado en datos/qr_url.txt — escanéelo con WhatsApp')
          } else if (qrCode) {
            try {
              const dataUrl = await QRCode.toDataURL(qrCode, { width: 400 })
              fs.writeFileSync(path.join(GASTOS_DIR, 'qr_url.txt'), dataUrl)
              console.log('[QR] ✅ QR generado — escanéelo con WhatsApp')
            } catch {}
          } else {
            console.log(`[QR] Espera... (intento ${intentosQR})`)
          }
        } catch (err) {
          console.log(`[QR] Error intento ${intentosQR}: ${err.message}`)
        }
      }
    }
  } catch (err) {
    console.error('[EVO] Error en inicialización:', err.message)
  }

  // 2. Configurar webhook si hay URL definida
  if (WEBHOOK_URL) {
    try {
      await evPost(`/webhook/set/${INSTANCE_NAME}`, {
        webhook: {
          enabled: true,
          url: `${WEBHOOK_URL}/webhook`,
          byEvents: true,
          base64: false,
          events: ['MESSAGES_UPSERT'],
        },
      })
      console.log(`[EVO] Webhook configurado → ${WEBHOOK_URL}/webhook`)
    } catch (err) {
      console.error('[EVO] Error configurando webhook:', err.message)
    }
  } else {
    console.log('[EVO] ⚠️  WEBHOOK_URL no definida — configure el webhook manualmente en Evolution API')
  }

  // 3. Cargar JIDs de grupos
  try {
    const grupos = await evGet(`/group/fetchAllGroups/${INSTANCE_NAME}?getParticipants=false`)
    if (Array.isArray(grupos)) {
      for (const g of grupos) {
        grupoJids[g.id] = (g.subject || '').toLowerCase()
      }
      console.log(`[EVO] ${grupos.length} grupos cargados en caché`)
    }
  } catch (err) {
    console.log('[EVO] No se pudo cargar lista de grupos (normal si aún no está conectado)')
  }

  // 4. Verificar Groq
  const resultado = await llamarGroq([{ role: 'user', content: 'Di solo: OK' }])
  if (resultado?.res?.ok) console.log('[Groq] ✅ Conexión OK')
  else console.log(`[Groq] ❌ Error: ${resultado?.data?.error?.message || 'sin respuesta'}`)

  // 5. Grupo notificaciones
  try {
    const chats = await client.getChats()
    const grupoGastos = chats.find(c => c.name.toLowerCase() === 'gastos')
    if (grupoGastos) {
      idGrupoNotificaciones = grupoGastos.id._serialized
      console.log(`[BOT] Grupo notificaciones: "${grupoGastos.name}"`)
    }
  } catch {}
}

// Evolution API puede enviar a /webhook o /webhook/messages-upsert (o cualquier subruta)
app.post('/webhook', manejarWebhook)
app.post('/webhook/:evento', manejarWebhook)

// ─── ARRANQUE ─────────────────────────────────────────────────
app.listen(BOT_PORT, async () => {
  console.log(`\n[BOT] Webhook server en puerto ${BOT_PORT}`)
  await inicializarEvolution()
  console.log('\n=========================================')
  console.log('  BOT PERSONAL LISTO')
  console.log('=========================================\n')
})
