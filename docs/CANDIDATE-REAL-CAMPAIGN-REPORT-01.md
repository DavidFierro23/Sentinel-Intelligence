# CANDIDATE-REAL-CAMPAIGN-REPORT-01

**Primer informe real de Candidate Intelligence**
2026-09-05/06 · **0 requests externas, 0 créditos** · Base: `07fc51c`,
`e948382`, `b22853e`, `5de5703`, `524435f`, `36659c7`

---

## 1. Qué es esto

Un generador reproducible de informe (`generateCandidateIntelligenceReport`)
más dos renderizadores (Markdown, HTML) que consumen exactamente el
mismo modelo de datos. Todo se construye a partir de datos **ya
persistidos** del proyecto `alcaldia-cuenca-2027-piloto` — cero
recolección nueva.

## 2. Arquitectura reutilizada

- `contenidoDeProyecto` → universo real de 7 candidatos.
- `matrizDePlataformasDelProyecto` (T3, `candidatePlatformMatrix.js`,
  ya certificado) → 5 plataformas, multi-asset, identidad.
- `calcularIPDO`/`extraerInsumosCandidato` (`digitalPresenceIndex.js`,
  `IPDO_V1.1`, ya aprobado) → ranking, dimensiones, explicación.
- `amplificacionDeCandidato`/`separarConversacion` → señales crudas
  de conversación para el trace de Yaku.
- `evidenciasDe`/`publicacionesDe` → evidencias y publicaciones
  destacadas por candidato.

**Nada de esto se reimplementó.** El generador es una capa de
composición y presentación, no un motor nuevo.

## 3. Bug encontrado y corregido durante este gate

Al generar el primer informe real, `accountCoverage` mostraba
"7/5 plataformas" para Lloret Valdivieso — matemáticamente
imposible. Causa: `extraerInsumosCandidato` contaba **cualquier**
bloque de plataforma con activo válido en la ficha, incluyendo
bloques no canónicos de IPDO que sí existen legítimamente en la
ficha de identidad (LinkedIn, sitio web propio). **Corregido:**
el conteo ahora se filtra explícitamente a `PLATAFORMAS_IPDO` (las
5 plataformas del índice). Esto recalculó los scores de `Presence`
de los 7 candidatos (la normalización es relativa al grupo), sin
cambiar el orden del ranking. No es un cambio de metodología ni de
pesos — es una corrección de un conteo que nunca debió incluir
plataformas fuera del alcance de IPDO.

## 4. Contrato del reporte

```js
generateCandidateIntelligenceReport(projectId, options?) -> {
  ok, contractVersion, projectId, generatedAt, dataCutoff, methodVersion,
  periodo, universo, disclaimerIpdo, noSignifica, resumenEjecutivo,
  ranking, matrizPlataformas, hallazgosComparativos, historico,
  candidatosDetalle, limitacionesGlobales, aislamiento
}
```

`renderReportMarkdown(model)` y `renderReportHtml(model)` son
funciones puras del mismo modelo — verificado con test (mismo orden
de candidatos en ambos formatos).

## 5. Semántica de cobertura y período

- `PRESENCE` = `CURRENT_PROFILE_STOCK` (último snapshot real por activo).
- `INTERACTION`/`CONVERSATION` = `OBSERVATION_WINDOW` (acumulado
  hasta la fecha de corte). Declarado explícitamente: no comparten
  la misma base temporal que los seguidores.
- Cada celda de la matriz trae `PROFILE_MEASURED` (vía `medicion.estado`),
  y el detalle de activos distingue identidad de medición.

## 6. Multi-asset — sin elegir arbitrariamente

Reutiliza literalmente la etiqueta que `candidatePlatformMatrix.js`
ya certificó: *"X seguidores acumulados entre N activos observados"*.
Ejemplo real, Lloret/Instagram: **11.182 seguidores acumulados entre
2 activos observados** (360 + 10.822). Nunca "audiencia única",
"alcance" ni "personas".

## 7. Yaku Pérez — Conversation = 0/100, con caveat explícito

Se añadió una decoración de presentación (no de cálculo, no toca
`digitalPresenceIndex.js`) que detecta cuándo una dimensión
normalizada da exactamente 0 pese a tener señales crudas reales, y
adjunta una nota visible en Markdown y HTML:

> ⚠️ 0/100 es un valor RELATIVO al grupo comparado, no ausencia de
> conversación: existen 39 hechos de terceros, 12 medios distintos y
> 25 piezas de conversación pública observadas realmente — son la
> cifra más baja de los candidatos comparados, no cero absoluto.

## 8. Resultados reales (ranking, generado en runtime, no hardcodeado)

| # | Candidato | IPDO | Presence | Interaction | Conversation | Cobertura |
|---|---|---|---|---|---|---|
| 1 | Lloret Valdivieso | 80.2/100 | 73.1/100 | 67.4/100 | 100.0/100 | ALTA |
| 2 | Paúl Carrasco Carpio | 64.7/100 | 65.0/100 | 56.4/100 | 73.9/100 | ALTA |
| 3 | Yaku Pérez | 63.4/100 | 100.0/100 | 95.9/100 | 0.0/100 | ALTA |
| 4 | Pedro Palacios Ullauri | 43.0/100 | 49.4/100 | 55.9/100 | 23.7/100 | ALTA |
| 5 | Marcelo Cabrera Palacios | 32.8/100 | 47.5/100 | 30.7/100 | 24.7/100 | ALTA |
| 6 | Juan Carlos Vega | 25.1/100 | 7.6/100 | 31.5/100 | 30.2/100 | ALTA |
| 7 | Leonardo Morales | 19.1/100 | 30.1/100 | 5.8/100 | 26.6/100 | ALTA |

35/35 celdas resueltas (26 MEDIDO, 3 PARCIAL, 5 IDENTIDAD_INSUFICIENTE,
1 NO_SOPORTADO).

## 9. Cómo regenerar el informe

```
cd Sentinel-Intelligence
node apps/backend/scripts/generateCandidateReport.mjs alcaldia-cuenca-2027-piloto
```

Escribe en `reports/candidate/`: `*-latest.{json,md,html}` (siempre
se actualiza) y `*-<YYYYMMDD-HHmm>.{json,md,html}` (nunca se
sobrescribe, historial completo preservado).

## 10. Cómo abrir el informe

Abrir `reports/candidate/candidate-intelligence-alcaldia-cuenca-2027-piloto-latest.html`
directamente en cualquier navegador. Imprimible (Ctrl+P) y
convertible a PDF desde el diálogo de impresión del navegador — no
se agregó ninguna librería nueva.

## 11. Limitaciones declaradas en el propio informe

- `MEDICION_SIN_ACTIVO_ATRIBUIDO`, `AGREGACION_MULTI_ACTIVO`,
  `DISCOVERY_NO_PERSISTIDO`, `IDENTITY_EXCLUSION_PERSISTENCE_DEBT`
  (heredadas de `candidatePlatformMatrix.js`, sin cambios).
- `MOMENTUM_NO_DISPONIBLE`: histórico insuficiente, declarado sin
  ambigüedad, nunca inventado.
- `hallazgosComparativos.relacionesEntreCandidatos = "RELATIONAL_ANALYSIS_PENDING"`:
  no se infiere ninguna relación causal entre candidatos.

## 12. Checklist de calidad humana aplicado

Leído como si fuera para un director de campaña: lenguaje en
condicional relativo ("presenta la mayor Presencia Digital
Observable dentro del universo comparado", nunca "domina" o "va
ganando"); ningún score en porcentaje; disclaimer visible antes de
la tabla de ranking; el caso Yaku=0 explicado antes de que pueda
malinterpretarse; limitaciones en su propia sección, no escondidas
en notas al pie.

## 13. Tests y regresiones

`tests/candidateReportGenerator.test.mjs` — **19/19**. Regresión
completa: **63/64 archivos, 1 fallo preexistente y ajeno**
(`ingest-real.test.mjs`, Territorial, no tocado).

## 14. Requests / créditos

**0 requests externas. 0 créditos.**
