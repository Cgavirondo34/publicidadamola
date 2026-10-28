# AMOLA Estudio — Fase 1 (MVP funcional)

Asistente de diseño publicitario para **AMOLA · Germinados** (Tandil, Argentina).
Cualquier persona del equipo sube la foto de un producto, elige la línea, el formato y el estilo, y obtiene tres propuestas con la identidad del **Manual de Marca AMOLA**, listas para editar y descargar en PNG, JPG o WebP a la resolución exacta de cada red social.

Está construido sobre la misma base que la app de Fernando De La Fuente (motor de capas, editor, presupuestos y login), adaptada a la marca, los productos y el tono de AMOLA.

---

## 1. Qué se adaptó a AMOLA

| Tema | Cómo queda |
|---|---|
| **Paleta** | La del manual: Verde Amola `#4E8B3B`, Rojo Terracota `#8C1F14`, Azul `#4673BB`, Naranja Poroto `#BC5534`, Mostaza `#E3B84F`, Crema/Arena `#C2A182`. Está en `src/lib/brand.ts` y en `tailwind.config.js`. Todos los selectores de color muestran estas muestras. |
| **Tipografía** | Títulos en **Nunito** (sans redondeada de trazo grueso, como pide el manual) y nombres de producto en **Bree Serif** (la letra del packaging). Cuerpo en Inter. Fuentes empaquetadas: se ven igual con o sin internet. |
| **Logo** | `public/seed/amola-logo.png` (verde) y `amola-logo-blanco.png`: **recortes píxel a píxel del packaging real**, no redibujados. Reemplazarlos por el archivo vectorial oficial desde *Empresa* cuando esté disponible. |
| **Líneas de producto** | Lentejas (azul), Porotos negros (naranja), Arvejas (verde) y Harinas (arena). Cada línea tiñe la pieza con su color, como en las etiquetas. Se administran en *Líneas*. |
| **Estilos** | **Paisaje AMOLA** (como las etiquetas: fondo de color, formas orgánicas, titular en dos tipografías), **Natural cálido**, **Promo** (sellos de beneficio con hoja), **Catálogo / E-commerce** y **Redes sociales**, con 3 variantes cada uno. |
| **Tono y claims** | Titulares sugeridos del territorio de mensaje del manual y beneficios permitidos con un clic. Un **control de claims** avisa antes de publicar si un texto promete salud, certificaciones (orgánico, sin TACC…), datos nutricionales sin ficha, comparaciones ("el mejor", "3 veces más") o exageraciones. No bloquea: pide revisar. |
| **Fotos de estudio** | Si la foto tiene fondo liso (blanco de estudio), el motor extiende ese mismo color alrededor y el producto queda entero y limpio. Las fotos de escena usan un fondo difuminado de la misma foto. La foto nunca se altera. |

### Datos precargados
- Empresa: AMOLA Germinados · Tandil, Buenos Aires · `@amola.germinados` · www.amola.com.ar.
- **Teléfonos: ninguno.** El manual no los incluye y la app nunca inventa datos de contacto. Cargalos en *Empresa* (marcá cuál es WhatsApp).
- Foto de ejemplo: `public/seed/amola-legumbres.jpg` (packaging de Lentejas, Porotos negros y Arvejas, tomada del manual).

### Pendiente del manual ("a confirmar")
El propio manual marca como pendientes: archivo maestro del logo, tipografía corporativa oficial, Pantone/HEX oficiales, guía del isotipo "A" y del sello "Sin Gluten". Cuando lleguen:
- **Logo / sellos** → se suben desde *Empresa* y *Líneas* (sin tocar código).
- **Colores** → `src/lib/brand.ts` y `tailwind.config.js`.
- **Tipografía** → `src/fonts.ts` y `FONT_FAMILIES` en `src/lib/generate.ts`.

---

## 2. Arquitectura

```
  Foto, línea,   ───► Nuevo diseño ──► Motor de composición ──► Editor Konva (capas) ──► PNG / JPG / WebP
  textos, tel.                          (función pura, testeada)   deshacer · propiedades
                      IndexedDB (Dexie): proyectos · fotos · logos · líneas · presupuestos
                      Netlify Functions: login (usuario y contraseña, cookie firmada)
```

| Decisión | Por qué |
|---|---|
| **Capas independientes** (foto / logos / textos / teléfonos) | Teléfonos exactos, textos sin errores y logos fieles. Nada se "dibuja" dentro de la foto. |
| **Motor como función pura** (`src/lib/layout.ts`) | Se testea sin navegador: márgenes, no-superposición, proporción de logos, teléfonos exactos y contraste en 5 estilos × 3 variantes × 6 formatos. |
| **El producto nunca se deforma ni se recorta de más** | La foto solo se escala proporcionalmente; si la proporción no coincide, se muestra completa. |
| **Logos = archivo original** | Solo se mueven y escalan en proporción. Si falta un logo, se muestra el nombre en texto: nunca se inventa uno. |
| **Teléfonos nunca se parten ni se truncan** | Se imprimen como están cargados, en una línea; si no entran, se achica la letra. |

### Estructura
```
src/
  types.ts           Modelo de datos (capas, proyecto, línea, empresa). Ver nota de nombres internos abajo.
  lib/
    brand.ts         Paleta AMOLA y muestras de color
    claims.ts        Claims permitidos, titulares sugeridos y control de claims
    layout.ts        Motor de composición: estilos, variantes, ajuste de texto, degradación ordenada
    generate.ts      Une datos guardados + motor + medición real de texto con Konva
    db.ts            IndexedDB + datos iniciales (empresa, líneas, logo)
    assets.ts        Validación de archivos, caché de imágenes, color de borde de la foto
    quotes*.ts       Presupuestos: cálculos en centavos, PDF, numeración
  components/editor/ Lienzo Konva, nodos por tipo de capa, paneles
  pages/             Inicio · Crear publicidad · Editor · Presupuestos · Galería · Líneas · Empresa
netlify/             Funciones de login
tests/               Motor, claims, presupuestos, PDF, login y datos iniciales
```

**Nombres internos:** el modelo conserva algunos nombres de la base original para no tocar el motor. En AMOLA: `Brand` = línea de producto, `model` = producto ("Lentejas germinadas"), `machineType` = presentación ("Paquete 250 g"), `features` = beneficios.

---

## 3. Instalación local

Requisitos: Node 20 o superior.

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # pruebas (motor, claims, presupuestos, login)
npm run build        # genera dist/
```

## 4. Despliegue en Netlify

1. Netlify → *Add new site* → *Import an existing project* → elegí este repositorio.
2. Netlify detecta `netlify.toml` (build `npm run build`, publica `dist`, Node 20, funciones de login, redirección SPA). *Deploy*.

## 5. Login

La app no se abre sin ingresar. El acceso ya viene creado: **usuario `amola`** con la contraseña entregada aparte. La contraseña no está en el repositorio: `netlify/lib/auth.ts` guarda solo su huella (scrypt) y la valida una función de Netlify en el servidor.

**Cambiar usuario o contraseña:** Netlify → *Site configuration → Environment variables*:
```
AUTH_USER=amola
AUTH_PASSWORD=<la nueva contraseña>
```
y después *Deploys → Trigger deploy*. Esas variables reemplazan al acceso incorporado y cierran las sesiones abiertas. En tu PC, para `npm run dev`, usá un `.env.local` (git lo ignora) con las mismas dos variables.

Seguridad: comparación en tiempo constante, ~1 s de espera por intento fallido, cookie de sesión **HttpOnly, Secure, SameSite=Lax** firmada con HMAC y válida 30 días.

## 6. Presupuestos

Sección **Presupuestos**: presupuestos numerados para dietéticas, almacenes naturales y distribuidores, con el logo y los datos de AMOLA, descargables en PDF A4 y enviables por WhatsApp.
- Datos de la empresa en *Empresa → Datos para presupuestos* (dirección, CUIT, condición de IVA, email, condiciones de pago y entrega).
- Ítems con línea, cantidad, precio, bonificación e IVA por línea (21 % por defecto; también 10,5 % y 0 %). **Confirmá con el contador la alícuota de cada producto.**
- Totales en centavos enteros: el total siempre coincide con la suma de las líneas.
- Numeración correlativa por equipo (los datos viven en el navegador). Si se usa en varias PCs, configurá un *Próximo número* distinto en cada una.

## 7. Límites de la Fase 1
- **Sin IA todavía**: no hay recorte de fondo, fondos generados ni análisis de foto. Las propuestas salen del motor de plantillas.
- **Persistencia local**: proyectos y presupuestos viven en el navegador de cada equipo (IndexedDB). No se comparten entre PCs hasta la Fase 4.

## 8. Próximas fases
- **Fase 2 — IA de imagen** (el producto nunca lo redibuja la IA): análisis de foto, recorte de fondo, escenas naturales cálidas generadas con el producto original encima, "IA Creativa" con 3 propuestas, y textos sugeridos que respeten el control de claims.
- **Fase 3 — Asistente**: pedidos en lenguaje natural ("hacé una versión para historias", "destacá el WhatsApp") sobre las capas existentes.
- **Fase 4 — Producción**: base de datos compartida (Supabase), varios usuarios, roles y copias de seguridad.
