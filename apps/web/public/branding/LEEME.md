# Sentinel Logo v1.0 — CONGELADO

Origen: archivo entregado por el Founder (`C:\Users\David\Downloads\original.png`),
integrado en el sprint UX-BRAND-002.

| Archivo | Qué es |
|---|---|
| `owl-original.png` | **El archivo original, sin tocar.** 1254×1029, incluye las palabras SENTINEL e INTELLIGENCE. Referencia congelada; la interfaz NO lo carga. |
| `owl-isotipo.png` | Isotipo maestro: solo el búho, 953×773, fondo transparente. Recortado del original (x 150–1102, y 37–809). |
| `owl-320.png` | El isotipo a 320 px de ancho. **Es el que usa la interfaz** (Sidebar, Header, pantalla de carga). |
| `favicon.ico` | 256/64/48/32/16 embebidos. |
| `favicon-32x32.png`, `favicon-16x16.png` | Favicons PNG. |
| `apple-touch-icon.png` | 180×180. |

## Reglas congeladas

- No redibujar ni reinterpretar el búho.
- No alterar ojos, cejas ni colores. Los derivados **no modifican
  ningún color**: solo se calcula el canal alfa.
- Las palabras SENTINEL e INTELLIGENCE del original **no se usan**.
  El recorte las excluye por completo: el texto empieza en la fila
  823 y el recorte termina en la 809.
- Mantener la proporción original. En la interfaz se declara solo la
  altura, con `width: auto`, para que el navegador nunca deforme el
  isotipo.

## Cómo se generaron los derivados

El entorno no tiene ImageMagick, rsvg, sharp ni Pillow. Los archivos
se produjeron con un decodificador/codificador PNG escrito con la
librería estándar (`zlib` + `struct`), remuestreo por promedio de área
y transparencia por umbral sobre el color de fondo medido `(0, 6, 22)`:
por debajo de 12 de exceso es ruido del original y se corta; entre 12 y
30 hay rampa; por encima, opaco. Los cuadrados se rellenan con
transparencia, nunca estirando.
