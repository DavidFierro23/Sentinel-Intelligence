# Solicitud de acceso: Facebook Pages públicas de terceros

Preparado en `P-CAND-SOCIAL-COVERAGE-01` · 2026-08-30

Documento de trabajo para el envío a App Review. **No se ha enviado nada.**

---

## 1 · Qué falta exactamente

Meta lo dijo con precisión en el error de `META-THIRD-PARTY-REAL-02`
(HTTP 400, code 100), nombrando tres alternativas. Consultada la documentación
oficial, **solo una sigue siendo una vía real**:

| Alternativa que Meta nombra | Estado real |
|---|---|
| permiso `pages_read_engagement` | **no aplica a terceros.** Es un permiso sobre Páginas donde tenemos un rol. Un candidato no nos va a dar rol de administrador |
| feature **Page Public Metadata Access** | **sustituida.** La propia documentación dice que PPCA la reemplaza y que *no se puede solicitar* si el envío incluye PPCA |
| feature **Page Public Content Access** (PPCA) | **la vía** |

Así que el error parecía ofrecer tres caminos y ofrece uno.

### Requisitos de PPCA, verbatim de la documentación

> «Este permiso o función requiere que se complete correctamente el proceso de
> revisión de la app.»

> «Es necesario completar la verificación del negocio para acceder a este
> permiso o función.»

| | ¿Requerido? | Fuente |
|---|---|---|
| **App Review** | **Sí** | doc. de PPCA |
| **Business Verification** | **Sí** | doc. de PPCA |
| Advanced Access | no se menciona explícitamente en PPCA | — |
| Permiso adicional | **no**: PPCA sustituye a `pages_read_engagement` y `pages_read_user_content` | doc. de PPCA |

### Qué se puede probar antes de la revisión

> «solo puedes acceder a contenido en una página en la que se cumpla lo
> siguiente: la persona que tiene el rol de administrador de la página también
> tiene un rol de administrador, desarrollador o evaluador en la app.»

Eso explica exactamente lo medido: la Página que administramos devolvió 200 y la
de otro candidato devolvió 400. **No hay ningún cambio de configuración que
abra Páginas de terceros sin revisión.**

---

## 2 · Qué habilita PPCA

Endpoints: `/page/feed` · `/page-post` · `/page-post/comments`

Datos: metadatos públicos de la Página, publicaciones y **comentarios
públicos**.

Ese último punto importa más de lo que parece: Instagram **no** entrega texto de
comentarios por `business_discovery` —medido, HTTP 400 code 100—. **La vía de
Facebook es la única oficial que lo entregaría.** PPCA no es solo «también
Facebook»: es la condición para que Comments Intelligence tenga fuente.

---

## 3 · Caso de uso a declarar

Meta lista como admitido: *«Analiza o muestra las publicaciones y la interacción
en las páginas»*. Es literalmente lo que hace Sentinel.

**Sentinel Intelligence** es una plataforma de inteligencia electoral para
Ecuador. El módulo *Candidate Intelligence* mantiene un expediente longitudinal
de la presencia digital **pública** de candidatos a un cargo de elección
popular, y lo usan analistas de campaña y medios.

### Qué leeremos

- identidad pública de la Página: `id`, `name`, `username`, `link`
- `fan_count` / `followers_count`
- publicaciones públicas: `id`, `permalink_url`, `created_time`, `message`, tipo
- comentarios públicos de esas publicaciones: texto y `created_time`

### Qué NO leeremos

- perfiles personales
- mensajería o Messenger
- contenido no público, ni nada que exija sesión de usuario
- datos de anuncios
- información de identidad de los autores de comentarios más allá de lo que la
  API pública entregue

### Qué NO haremos

- publicar, comentar ni interactuar: **solo lectura**
- administrar Páginas de terceros
- reconocimiento facial ni biometría
- inferir atributos sensibles de personas
- perfilar usuarios individuales que comentan

---

## 4 · Cómo lo presenta Sentinel

Tres reglas que ya están en el producto y conviene enseñar al revisor, porque
son lo que distingue esto de un raspador:

1. **La ausencia no se rellena.** Una métrica que la API no devuelve queda
   `NO_DISPONIBLE`, nunca `0`.
2. **La procedencia viaja con el dato.** Cada cifra lleva su proveedor, su
   `observedAt` y su URL canónica reencontrable.
3. **Observado ≠ total.** La interfaz dice «presencia digital observada», no
   «popularidad», y declara explícitamente que no es intención de voto.

---

## 5 · Reproducción para el revisor

1. Abrir Sentinel → módulo **Proyectos** → «Elecciones Alcaldía Cuenca 2027».
2. Elegir un candidato → **Candidate Intelligence**.
3. Pestaña **Identidad**: se ven sus activos por plataforma, con el tipo de cada
   uno y su procedencia.
4. Pestaña **Actividad**: publicaciones observadas con su URL canónica y sus
   métricas, cada una con fecha de observación.
5. Pestaña **Evidencias**: de cada cifra se puede abrir la publicación original.

Pantalla a mostrar en el vídeo: **Candidate Intelligence → Actividad**, donde se
ve una publicación pública con su permalink y su recuento de interacción.

---

## 6 · Pendientes antes de enviar

Esto **no** está listo para enviar. Falta:

- [ ] **Business Verification** de la empresa: es requisito y no está hecha
- [ ] Política de privacidad publicada en una URL estable
- [ ] Condiciones de uso publicadas
- [ ] URL de eliminación de datos de usuario
- [ ] Vídeo de reproducción (pantalla del punto 5)
- [ ] Icono y datos básicos de la app completos
- [ ] Decidir la titularidad del token: hoy el token de Meta administra la
      Página de uno de los candidatos del proyecto, y eso debería ser una
      elección explícita antes de declarar nada a Meta

El último punto es el más importante y no es un trámite: es una cuestión de
gobernanza del dato.

---

## 7 · Coste de esperar

**Bajo.** X, YouTube e Instagram ya sostienen el benchmark. Lo que se pierde
mientras PPCA no esté:

- Facebook de terceros, entero
- **texto de comentarios en cualquier plataforma** — y eso sí bloquea Comments
  Intelligence
