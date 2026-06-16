require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const {
  TRELLO_KEY,
  TRELLO_TOKEN,
  TRELLO_BOARD_ID,
  ANTHROPIC_API_KEY,
  PORT = 3000
} = process.env;

// ─── TRELLO: traer todas las tarjetas activas ────────────────────────────────
app.get('/api/trello/cards', async (req, res) => {
  try {
    const url = `https://api.trello.com/1/boards/${TRELLO_BOARD_ID}/cards` +
      `?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}` +
      `&fields=name,desc,labels,dateLastActivity,shortUrl,idList` +
      `&limit=1000`;

    const r = await fetch(url);
    if (!r.ok) {
      const txt = await r.text();
      return res.status(r.status).json({ error: txt });
    }

    const cards = await r.json();
    const today = new Date();

    const processed = cards.map(c => {
      const last = new Date(c.dateLastActivity);
      const diasSinUpdate = Math.floor((today - last) / (1000 * 60 * 60 * 24));
      const labels = (c.labels || []).map(l => l.name);
      const esCerrada = labels.some(l =>
        /cerrada|archivada|finalizada/i.test(l)
      );
      return {
        id: c.id,
        nombre: c.name,
        descripcion: c.desc || '',
        labels,
        diasSinUpdate,
        ultimaActividad: last.toLocaleDateString('es-AR'),
        url: c.shortUrl,
        esCerrada
      };
    });

    const activas = processed.filter(c => !c.esCerrada);
    const demoradas = activas
      .filter(c => c.diasSinUpdate > 20)
      .sort((a, b) => b.diasSinUpdate - a.diasSinUpdate);

    res.json({
      total: processed.length,
      activas: activas.length,
      demoradas: demoradas.length,
      cards: processed,
      resumen: buildResumen(activas, demoradas)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── TRELLO: tarjetas de una lista específica ────────────────────────────────
app.get('/api/trello/cards/:listId', async (req, res) => {
  try {
    const url = `https://api.trello.com/1/lists/${req.params.listId}/cards` +
      `?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}&fields=name,desc,labels,dateLastActivity,shortUrl`;
    const r = await fetch(url);
    const cards = await r.json();
    res.json(cards);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── CHAT con Claude ─────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { messages, trelloContext, driveContext } = req.body;

  const systemPrompt = `Sos el agente SGI de Metalcris S.A., asistente de Gabriel (Asistente SGI).
Tenés acceso en tiempo real al tablero de Trello "Gestión de NC y OM" y a la planilla de seguimiento de Google Drive.

DATOS ACTUALES DEL TABLERO TRELLO:
${trelloContext || 'No disponible.'}

DATOS DE LA PLANILLA DE DRIVE (hoja Seguimiento):
${driveContext || 'No disponible.'}

REGLAS DE ANÁLISIS:
- Tarjetas con >20 días sin actividad requieren atención urgente.
- Prioridad: NC Crítica > NC Mayor > NC Menor > OM.
- Estado "En proceso demorado" es alerta roja.
- La planilla de Drive debe ser un espejo de Trello: si Trello tiene info nueva que Drive no refleja, marcalo.
- Si alguien hizo una reunión y tomó acciones en Trello pero Drive no lo dice, hay desincronización.
- Gabriel trabaja bajo ISO 9001/14001/45001 en Metalcris S.A., Bernal, Buenos Aires.

Respondé en español rioplatense, directo y sin vueltas. Cuando listés tarjetas, ordenalas por urgencia. Usá emojis solo para indicar estado (🔴 urgente, 🟡 atención, 🟢 ok).`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages.slice(-12)
      })
    });

    const data = await r.json();
    if (data.error) return res.status(400).json({ error: data.error.message });

    const reply = data.content?.[0]?.text || 'Sin respuesta.';
    res.json({ reply });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ─── Servir frontend ─────────────────────────────────────────────────────────
app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Agente SGI corriendo en http://localhost:${PORT}`);
});

// ─── helpers ─────────────────────────────────────────────────────────────────
function buildResumen(activas, demoradas) {
  const top = demoradas.slice(0, 10).map(c =>
    `[${c.diasSinUpdate}d sin update] ${c.nombre} | ${c.labels.join(', ') || 'sin etiqueta'}`
  ).join('\n');

  return `Total tarjetas activas: ${activas.length}
Tarjetas que requieren atención (>20d sin update): ${demoradas.length}

Top más demoradas:
${top || 'Ninguna.'}

Lista completa de activas:
${activas.map(c =>
    `• [${c.diasSinUpdate}d] ${c.nombre} | ${c.labels.join(', ') || 'sin etiqueta'} | Última: ${c.ultimaActividad}`
  ).join('\n')}`;
}
