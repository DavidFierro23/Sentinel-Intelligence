```
════════════════════════════════════════════════════════
  SENTINEL INTELLIGENCE PLATFORM — AI Intelligence Platform
────────────────────────────────────────────────────────
  ADR           : 000-01
  Título        : Unificación de la Constitución en el repositorio Git
  Fecha         : 2026-08-17
  Estado        : Aprobada
  Decisor       : Patricio David Fierro (Founder / Product Owner)
  Ámbito        : Gobierno documental del proyecto
  Confidencial. : CONFIDENCIAL — Uso interno fundacional
════════════════════════════════════════════════════════
```

# ADR-000-01 — Unificación de la Constitución en el repositorio Git

## Contexto

La Constitución (SENTINEL INTELLIGENCE FOUNDATION) se desarrolló inicialmente en una carpeta independiente del repositorio de código:

- **Constitución:** `C:\Users\David\SentinelIntelligence\SENTINEL-INTELLIGENCE-FOUNDATION\`
- **Código:** `C:\Users\David\Desktop\Sentinel-Intelligence\` (con `docs/constitution/` vacío)

Esta separación produjo tres problemas concretos:

1. **Sin versionado.** La documentación fundacional no tenía historial: no era posible saber quién cambió qué, cuándo, ni recuperar una versión anterior.
2. **Riesgo de divergencia.** Existían dos rutas plausibles para el mismo contenido; un reinicio de sesión ya introdujo una inconsistencia real de estado (Cap. 10 marcado *Draft* mientras se le consideraba *Approved*).
3. **Desacople doctrina–implementación.** Las decisiones de arquitectura vivían fuera del repositorio donde se ejecutan, impidiendo que un cambio de código y su justificación constitucional compartieran trazabilidad.

## Decisión

**La Constitución se unifica dentro del repositorio Git y se declara documento fuente oficial del proyecto Sentinel Intelligence Platform.**

| Aspecto | Definición |
|---|---|
| **Ruta oficial única** | `Sentinel-Intelligence/docs/constitution/` |
| **Repositorio** | `github.com/DavidFierro23/Sentinel-Intelligence` |
| **Rama de trabajo documental** | `dev` |
| **Granularidad de versionado** | **Un commit por capítulo** |
| **Convención de commit** | `docs(constitution): Cap. N - Título (Bloque X, Estado vY.Z)` |
| **Ubicación anterior** | **Archivada**, sin validez normativa. No se edita. |
| **Autoridad documental** | Índice Maestro y CHANGELOG de la ruta oficial son la única fuente de verdad de estado y versión. |

**Reglas derivadas:**

1. Toda modificación de la Constitución se realiza **únicamente** en la ruta oficial.
2. Todo cambio de estado de un capítulo (Draft → Review → Approved) genera **commit propio**.
3. El `CHANGELOG.md` de la Constitución se mantiene como registro legible por humanos, **complementario** al historial de Git — no lo sustituye.
4. La copia anterior se conserva como **respaldo histórico** y queda marcada como archivada.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Mantener ambas rutas sincronizadas manualmente | Garantiza divergencia; ya ocurrió una inconsistencia real. |
| Mover el código al directorio de la Constitución | El repositorio Git y su remoto ya están establecidos y operativos. |
| Repositorio Git independiente solo para la Constitución | Reintroduce el desacople doctrina–implementación que esta decisión busca eliminar. |

## Consecuencias

**Positivas**
- Historial completo, atribuible y reversible de la documentación fundacional.
- Una única fuente de verdad: desaparece la ambigüedad de ruta.
- Doctrina y código comparten repositorio, remoto y trazabilidad.
- Respaldo remoto de la Constitución al empujar la rama.
- Posibilidad futura de revisión por Pull Request para cambios constitucionales.

**Negativas / costos asumidos**
- Editar la Constitución exige operar Git (commit disciplinado por capítulo).
- La documentación fundacional queda sujeta a la política de acceso del repositorio; su carácter **CONFIDENCIAL** obliga a mantener el repositorio privado.
- La copia archivada debe permanecer claramente marcada para evitar ediciones accidentales.

## Cumplimiento y verificación

| Verificación | Cómo se comprueba |
|---|---|
| Ruta oficial poblada y versionada | `git log --oneline -- docs/constitution/` |
| Un commit por capítulo | Historial con un commit `docs(constitution): Cap. N ...` por capítulo |
| Ubicación anterior sin ediciones | Marcador de archivo presente en la ruta antigua |
| Estado coherente | Índice Maestro y CHANGELOG concuerdan con la portada de cada capítulo |

## Referencias

- `docs/constitution/01-INDICE-MAESTRO.md` — sección *Ubicación oficial única de la Constitución*.
- `docs/constitution/CHANGELOG.md` — entrada del 2026-08-17.
- Cap. 8 — Filosofía de Ingeniería (trazabilidad y disciplina documental).

---

*ADR-000-01 — Aprobada por el Founder el 2026-08-17.*
