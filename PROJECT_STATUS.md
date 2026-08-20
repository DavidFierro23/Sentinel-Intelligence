# Sentinel Intelligence Platform

## Release Alpha

---

## Estructura oficial del repositorio

> **Ruta oficial única del frontend: `apps/web`.**
> No existe `apps/frontend`. Era un directorio vacío del andamiaje inicial —
> nunca contuvo ficheros ni estuvo en Git— y se eliminó el 2026-08-20 tras la
> auditoría del Bloque 1. Toda referencia al frontend apunta a `apps/web`.

```
Sentinel-Intelligence/
├── apps/
│   ├── backend/                    Node + Express · puerto 3001
│   │   ├── server.js
│   │   ├── routes/osint.js         /api/osint
│   │   └── services/
│   │       ├── avatar/             Avatar Intelligence Engine
│   │       ├── knowledgeLake/      memoria permanente append-only
│   │       ├── social/             Social Intelligence Layer
│   │       ├── providers/          proveedores de búsqueda web
│   │       ├── fusionSearchEngine.js
│   │       ├── searchProviderLayer.js
│   │       ├── referenceProfileService.js
│   │       └── osintEngine.js      orquestador investigarObjetivo()
│   │
│   └── web/                        ★ FRONTEND OFICIAL · Vite + React 19
│       ├── package.json            vite ^8.2.0
│       ├── vite.config.js
│       └── src/
│           ├── App.jsx
│           ├── components/         OSINT · KnowledgeGraph · paneles
│           └── services/
│
├── packages/
│   ├── sentinel-core/              Observe → Understand → Explain (esqueleto)
│   ├── sentinel-ai/                reservado
│   ├── sentinel-analytics/         reservado
│   ├── sentinel-ui/                reservado
│   └── shared/                     reservado
│
├── docs/
│   ├── constitution/               Foundation v1.0 — fuente oficial
│   ├── architecture/               ARQ-SIL-001 · UX-WR-001 · ARQ-SDI-000
│   ├── adr/                        ADR-000-01
│   └── manuals/
│
└── infrastructure/
```

**Workspaces npm:** `apps/*` y `packages/*` (declarados en el `package.json` raíz).
`apps/web` se resuelve automáticamente; no requiere ninguna ruta llamada `frontend`.

---

## Cómo arrancar

| Servicio | Comando | Puerto |
|---|---|---|
| Backend | `cd apps/backend && npm run dev` | 3001 |
| Frontend | `cd apps/web && npm run dev` | 5173 (Vite) |

---

## Milestone 1 — Entorno

- [x] Git
- [x] Python
- [x] Node.js
- [x] npm
- [x] VS Code
- [x] Repositorio inicial
- [x] **Frontend Base** — `apps/web`, Vite + React 19, operativo
- [x] **Backend Base** — `apps/backend`, Express, operativo
- [x] Sentinel Core Bootstrap — esqueleto en `packages/sentinel-core` (aún no conectado al backend)
- [ ] Docker
- [ ] GitHub Desktop

---

## Avance por sprints

| Sprint | Alcance | Estado |
|---|---|---|
| 1 | Perfil de Referencia | ✅ Cerrado |
| 2 | Fusion Search Engine | ✅ Cerrado |
| 2.5 | Search Provider Layer | ✅ Cerrado |
| 3 | Social Intelligence Layer (arquitectura) | ✅ Cerrado |
| UX-1 | War Room Operacional (diseño) | ✅ **Congelado** — UX-WR-001 v2.0 |
| 3.1 | Social Intelligence Layer (núcleo funcional) | ✅ Cerrado |
| 4 | Knowledge Lake | ✅ Cerrado |
| 4A · Bloque 1 | Avatar Intelligence Engine | 🚧 **En QA-1** — pendiente de pruebas de navegador |

---

## Constitución

Documento fuente oficial en `docs/constitution/` (ADR-000-01).
Bloques I y II aprobados en v1.0; Bloque III en desarrollo (Cap. 11–13 aprobados).

---

*Actualizado: 2026-08-20.*
