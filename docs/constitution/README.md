# SENTINEL INTELLIGENCE FOUNDATION

**Constitución oficial de Sentinel Intelligence Platform.**

> ⚠️ **Documento fuente oficial del proyecto.** Esta carpeta es la **única ubicación válida** de la Constitución (ADR-000-01, 2026-08-17). Toda otra copia es respaldo histórico sin validez normativa.
>
> 🔒 **CONFIDENCIAL — Uso interno fundacional.**

---

## Cómo se lee

| Empezar por | Documento |
|---|---|
| Decisiones inmutables | [`00-PRINCIPIOS-FUNDACIONALES.md`](00-PRINCIPIOS-FUNDACIONALES.md) |
| Mapa completo y estado por capítulo | [`01-INDICE-MAESTRO.md`](01-INDICE-MAESTRO.md) |
| Formato obligatorio de todo capítulo | [`ESTANDAR-DE-CAPITULO.md`](ESTANDAR-DE-CAPITULO.md) |
| Historial legible de cambios | [`CHANGELOG.md`](CHANGELOG.md) |

---

## Estado de los bloques

| Bloque | Nombre | Capítulos | Versión | Estado |
|---|---|---|---|---|
| I | ADN e Identidad | 1–7 | **v1.0** | ✅ Approved |
| II | Filosofía y Tecnología | 8–10 | **v1.0** | ✅ Approved |
| III | Negocio y Mercado | 11–20 | v0.3 | 🚧 En desarrollo (Cap. 11–12 Approved) |
| IV | Arquitectura y Gobierno | 21–33 | — | Pendiente |

*Un bloque se cierra en `v1.0` al aprobarse todos sus capítulos. La Constitución alcanzará `v1.0` global al completarse los cuatro bloques.*

---

## Reglas de edición

1. **Se edita únicamente aquí.** No existe otra copia normativa.
2. **Un commit por capítulo**, con la convención:
   ```
   docs(constitution): Cap. N - Título (Bloque X, Estado vY.Z)
   ```
3. **Todo capítulo sigue el estándar de 17 secciones** de `ESTANDAR-DE-CAPITULO.md`.
4. **Todo cambio de estado** (Draft → Review → Approved) se registra en el CHANGELOG **y** genera commit propio.
5. **Las decisiones aprobadas no se reescriben:** se modifican mediante un nuevo ADR que las supersede.
6. **Solo el Founder aprueba** un capítulo o un ADR.

---

## Estructura

```
docs/constitution/
├── README.md                        ← este documento
├── 00-PRINCIPIOS-FUNDACIONALES.md   ← decisiones inmutables (IA1–IA8, DT1–DT4)
├── 01-INDICE-MAESTRO.md             ← trazabilidad: archivo · versión · estado
├── ESTANDAR-DE-CAPITULO.md          ← estándar corporativo de 17 secciones
├── CHANGELOG.md                     ← registro cronológico
├── Bloque-I/    (Cap. 1–7)          ← ADN e Identidad
├── Bloque-II/   (Cap. 8–10)         ← Filosofía y Tecnología
├── Bloque-III/  (Cap. 11–20)        ← Negocio y Mercado
├── Bloque-IV/   (Cap. 21–33)        ← Arquitectura y Gobierno
└── CIERRE/                          ← decisiones aprobadas · anexos · glosario
```

**ADR fuera de capítulo:** `docs/adr/` (decisiones de gobierno documental y de arquitectura no ligadas a un capítulo).

---

*Founder / Product Owner: Patricio David Fierro · Autor: Comité Fundador de Sentinel Intelligence.*
