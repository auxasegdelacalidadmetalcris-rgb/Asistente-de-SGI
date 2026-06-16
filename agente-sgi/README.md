# Agente SGI Metalcris

Asistente de seguimiento de NCs y OMs. Conecta Trello + Google Drive + Claude.

## Deploy en Render

### 1. Subir a GitHub
```bash
git init
git add .
git commit -m "agente sgi metalcris v1"
git remote add origin https://github.com/TU_USUARIO/agente-sgi-metalcris.git
git push -u origin main
```

### 2. Crear servicio en Render
- Ir a https://render.com → New → Web Service
- Conectar el repo
- Configuración:
  - **Build Command:** `npm install`
  - **Start Command:** `npm start`
  - **Plan:** Free

### 3. Variables de entorno en Render
Agregar en el panel de Render → Environment:

| Variable | Valor |
|---|---|
| `TRELLO_KEY` | `57ec6548d6fc08599649dc67d940699b` |
| `TRELLO_TOKEN` | `ATTAc89b7d3e2e245276fa99dc75c7e2a6837a680bedb711e0a2c698cd90997246ed08150AB1` |
| `TRELLO_BOARD_ID` | `E04frr6V` |
| `ANTHROPIC_API_KEY` | tu key de Anthropic |

### 4. Obtener API Key de Anthropic
- Ir a https://console.anthropic.com
- API Keys → Create Key
- Copiá y pegá en Render

## Uso local
```bash
cp .env.example .env
# Editar .env con tu ANTHROPIC_API_KEY
npm install
npm start
# Abrir http://localhost:3000
```
