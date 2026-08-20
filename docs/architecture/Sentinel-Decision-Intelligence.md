```
════════════════════════════════════════════════════════
  SENTINEL INTELLIGENCE PLATFORM — AI Intelligence Platform
  RESERVA DE MÓDULO — Sentinel Decision Intelligence (SDI)
────────────────────────────────────────────────────────
  Documento     : ARQ-SDI-000
  Versión       : v0.1 — RESERVA
  Fecha         : 2026-08-20
  Estado        : Reservado — NO implementado
  Autor         : Comité Fundador de Sentinel Intelligence
  Founder       : Patricio David Fierro (Product Owner principal)
  Confidencial. : CONFIDENCIAL — Uso interno fundacional
════════════════════════════════════════════════════════
```

# Sentinel Decision Intelligence (SDI) — Reserva oficial de módulo

> **Este documento reserva el módulo. No lo diseña ni lo implementa.**
> Su única función es fijar el nombre, el propósito, las dependencias y las restricciones que el SDI heredará, para que las capas que se construyan antes emitan los datos que necesitará.

---

## 1. Propósito

**Responder preguntas estratégicas en lenguaje natural** sobre el conjunto de inteligencia que la plataforma ya posee.

Preguntas de referencia declaradas por el Founder:

| Pregunta | Qué exige responderla |
|---|---|
| ¿Quién está creciendo más esta semana? | Series temporales por actor + ventana + normalización |
| ¿Qué narrativa domina Cuenca hoy? | Agrupación temática + resolución territorial + ventana |
| ¿Qué medio inició esta conversación? | Orden temporal de evidencias + atribución de secuencia |
| ¿Qué parroquia cambió más? | Geo Intelligence + normalización + delta entre periodos |
| ¿Qué publicación generó mayor expansión? | Timeline + propagación + corroboración multi-fuente |

**El SDI no es un chatbot.** Es un traductor entre una pregunta y una consulta auditable sobre datos con linaje. Su salida es una respuesta **con sus evidencias**, no un párrafo generado.

---

## 2. Lo que consumirá

| Fuente | Qué aporta | Estado hoy |
|---|---|---|
| **Fusion Engine** | Evidencias web deduplicadas con motor de origen y calidad | ✅ Implementado |
| **Knowledge Lake** | Histórico append-only con linaje y hash | ❌ No existe — contrato definido |
| **Geo Intelligence** | Unidades territoriales, agregación con GEO-1, anomalías | ❌ No existe — arquitectura definida (UX-WR-001) |
| **Media Intelligence** | Medios, encuadre, cobertura | ❌ No existe |
| **Public Conversation** | Volumen, temas y actores de la conversación pública | ⚠️ Parcial — vía Social Intelligence Layer |
| **Timeline Universal** | Hechos fechados y su orden | ⚠️ Parcial — el SIL ya emite evidencias con hora |

**Consecuencia:** el SDI es el **último** módulo de la cadena. Cinco de sus seis fuentes están incompletas. Intentarlo antes produciría respuestas fluidas sobre datos que no existen — el fallo más grave posible en una plataforma de inteligencia.

---

## 3. Restricciones que hereda

Estas no son negociables y provienen de decisiones ya congeladas:

| # | Restricción | Origen |
|---|---|---|
| SDI-1 | **Toda respuesta cita sus evidencias.** Sin evidencias no hay respuesta, hay opinión | IA1 · Cap. 9 |
| SDI-2 | **Nunca afirma causa.** Usa el lenguaje calibrado del panel de atribución: precede / coincide / contribuye | WR-D13 |
| SDI-3 | **Declara lo que no sabe.** Cobertura parcial, huecos de ingesta y datos sin ubicar se informan con la respuesta | WR-D14 · WR-D16 |
| SDI-4 | **Respeta GEO-1.** No responde a resolución territorial más fina que la del dato | WR-D1 |
| SDI-5 | **No confirma identidades.** Si una respuesta depende de que una cuenta pertenezca a alguien, lo declara como correspondencia probable | IA2 · tope humano |
| SDI-6 | **Agnóstico al proveedor de IA.** El modelo de lenguaje es intercambiable | IA3 |
| SDI-7 | **Trazabilidad del prompt.** Pregunta, consulta generada, datos usados y respuesta quedan registrados | IA4 |
| SDI-8 | **Human-in-the-loop en decisiones críticas.** El SDI informa; no decide | IA2 |

---

## 4. Forma prevista de la respuesta

Reservada para que las capas anteriores sepan qué deben poder entregar:

```jsonc
{
  "pregunta": "¿Quién está creciendo más esta semana?",
  "interpretacion": {
    "metrica": "menciones",
    "ventana": { "desde": "...", "hasta": "..." },
    "entidades": "candidatos en seguimiento",
    "normalizacion": "ninguna",
    "resolucionGeografica": "canton"
  },
  "respuesta": "…",
  "evidencias": ["se-…", "fx-…"],
  "confianza": { "nivel": "…", "porQue": [...] },
  "loQueNoSabemos": ["…"],
  "trazabilidad": { "consultaGenerada": "…", "modelo": "…", "fuentes": [...] }
}
```

El campo `interpretacion` es obligatorio: el usuario debe poder ver **cómo el sistema entendió su pregunta** antes de confiar en la respuesta. Una pregunta ambigua mal interpretada produce una respuesta correcta a la pregunta equivocada.

---

## 5. Qué NO se decide en este documento

Arquitectura interna, modelo de lenguaje, estrategia de recuperación, esquema de intenciones, interfaz y sprint de implementación. Todo ello queda para `ARQ-SDI-001`, que se abrirá cuando el Knowledge Lake y el Geo Intelligence Engine existan.

---

## 6. Referencias

- `docs/architecture/Social-Intelligence-Layer.md` (ARQ-SIL-001)
- `docs/architecture/War-Room-Operacional.md` (UX-WR-001, congelado)
- `docs/constitution/` — Cap. 9 (IA1–IA4), Cap. 10 (DT3–DT4). **Se aplica; no se modifica.**

---

*Fin de ARQ-SDI-000 — reserva de módulo. Estado: reservado, no implementado.*
