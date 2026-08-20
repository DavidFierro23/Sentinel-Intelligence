# Sentinel Intelligence Platform

**Founder:** Patricio David Fierro
**Estado:** Release Alpha

Sentinel Intelligence es una plataforma modular de inteligencia artificial diseñada para análisis político, empresarial, gubernamental y de seguridad, construida sobre Sentinel Core.

---

## Estructura

| Ruta | Contenido |
|---|---|
| **`apps/web`** | **Frontend oficial** — Vite + React 19 |
| `apps/backend` | Backend — Node + Express, API `/api/osint` |
| `packages/` | Paquetes compartidos (`sentinel-core` y reservados) |
| `docs/constitution/` | Constitución — documento fuente oficial del proyecto |
| `docs/architecture/` | Arquitectura y diseño (SIL, War Room, SDI) |
| `docs/adr/` | Architecture Decision Records |

> **`apps/web` es la única ruta del frontend.** No existe `apps/frontend`:
> era un directorio vacío del andamiaje inicial, nunca versionado, eliminado
> el 2026-08-20. Consulte `PROJECT_STATUS.md` para la estructura completa.

---

## Arranque

```bash
# Backend — puerto 3001
cd apps/backend && npm run dev

# Frontend — puerto 5173
cd apps/web && npm run dev
```

El frontend consulta el backend en `http://localhost:3001`.

### Configuración opcional

`apps/backend/.env`:

```
BRAVE_API_KEY=            # activa Brave como proveedor de búsqueda principal
SENTINEL_LAKE_ADAPTER=    # memoria | fichero (por omisión: fichero)
```

Sin `BRAVE_API_KEY`, la búsqueda web recae en DuckDuckGo, que limita la tasa de
peticiones y reduce la cobertura. El estado real de cada proveedor se declara en
cada respuesta de la API.

---

## Documentación

La **Constitución** (`docs/constitution/`) es el documento fuente oficial: recoge
principios, decisiones de arquitectura y modelo de negocio. Se versiona con un
commit por capítulo y ninguna decisión aprobada se modifica salvo mediante un
nuevo ADR que la supersede.

---

*CONFIDENCIAL — Uso interno.*
