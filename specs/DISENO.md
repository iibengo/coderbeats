# Diseño: reglas (sacadas del código y de las specs)

Corto, como reglas. Cuando el código y esto no cuadren, manda el código y se corrige este archivo. Los principios (`PRINCIPIOS.md`) mandan sobre todo lo de aquí.

## Paleta
- **Fondo negro.** Estudio: `INK #0B0B0F` (`app/lib/palette.ts`). Laboratorio: lienzo `#0B0B0D`, página `bg-black`. Sin fondos claros ni degradados de página.
- **Acento rosa `#F496BC`**: lo seleccionado, el estilo activo, el compás que suena, el botón principal (es también el color de la caja: el contexto lo distingue).
- **Lila `#B7A6F2`**, **azul `#8ECFF2`**, **ámbar `#F5C97A`** y **verde agua `#7FD6C2`** son, con el rosa, la paleta de los instrumentos. Texto: blanco con opacidad (`text-white` 100 % lo activo, `/60` lo normal, `/40` lo secundario). Rojo `#ff4d6d` solo para «grabando».
- **Un instrumento, un color, el mismo en toda la app** (Estudio y Laboratorio; la única fuente es `VOICE_HEX` en `app/lib/palette.ts`):

| Instrumento | Color |
|---|---|
| Bombo | ámbar `#F5C97A` |
| Caja | rosa `#F496BC` |
| Platillo | azul `#8ECFF2` |
| Bajo | lila `#B7A6F2` |
| Melodía / tema | verde agua `#7FD6C2` |
| Acordes y efectos (subida) | gris claro `#CFCFD6` |

  **Un color, un significado:** el color es solo de los instrumentos y el rosa, del acento. No hay colores propios para «mi ritmo», «mi melodía», las partes ni los estados. **Lo mío** (capas hechas por mí en el Círculo, el Piano o el Coro) lleva el color de su instrumento (ritmo = bombo, melodía = verde agua) **más una marca**: un segundo contorno del mismo color alrededor del círculo y la etiqueta «mi ritmo» / «mi melodía». (Hasta 2026-11-16 el Estudio usaba bombo rosa, caja lila, bajo rosa oscuro y melodía blanca; se unificó con el Laboratorio.)
- **Partes de un remix (hasta 8): sin color.** La que suena, **blanca y brillante** (borde blanco de 2 px, centro blanco); la que va a entrar, la misma con **parpadeo**; las demás, **tenues** (`text-white/45`, borde `white/15`).
- Las tres voces del Coro: rosa, lila, azul (`244,150,188`, `183,166,242`, `140,211,245`).

## Tipografía
- `Inter` (sans, por defecto) y `JetBrains Mono` (código); cargadas con `@nuxt/fonts`; en el lienzo, `system-ui`.
- Pocas medidas: títulos `text-base`/`text-lg`, texto `text-sm`, notas `text-xs`. Frases cortas, en español, sin jerga.
- **Ningún texto baja de 11 px reales.** El lienzo de 680 se ve a ~360 px en un iPhone (escala ≈ 0,53), así que 17 px de lienzo son ~9 px reales. Los textos del lienzo se piden con `fontPx(base, scale)` (`app/lib/lab.ts`): `max(base, 11 / escala)`; la escala real (`StageFrame.scale`) la da `LabStage` en cada frame. Las etiquetas largas se parten en dos líneas («mi / melodía») en vez de encogerse. Base: 20–26 en el lienzo (≥ 11 px reales a partir de una escala de 0,53).

## Tamaños de toque
- **Mínimo 44 × 44 px** para un botón (`h-11 w-11`); el lienzo del Laboratorio usa círculos de radio 50–52 (diámetro ≈ 55 px reales) y zona de toque de 62 (unidades del escenario de 680).
- **Casillas de cuadrícula ≥ 40 px** (editor de melodía: 8 × 9 en 380 px). Separación ≥ 3 px entre casillas.
- Botón de parte o de pantalla: `py-4`/`py-5`, de ancho completo en cuadrícula de 2 columnas.
- Toda zona de toque con `touch-none` en el lienzo y vibración corta opcional (`navigator.vibrate`, 5–8 ms).

## La aguja y el compás
- Cada pantalla del Laboratorio tiene **una aguja** que gira con el compás (una vuelta = un compás, el 0 arriba): línea blanca `.75`, 2,5 px, extremos redondos, longitud 320, con estela de abanico (degradado cónico, `.10` de opacidad). Solo gira si suena. Sin aguja = parado.
- Un anillo tenue (`rgba(255,255,255,.08)`, 1 px) marca la rueda; el tiempo cae cada 4 pasos y el elemento correspondiente «late» (+6–8 px de radio).

## Ondas al tocar
- **Cada toque dibuja una onda:** círculo de 3 px de trazo del color del instrumento, radio inicial 24 (o el del elemento), crece 4–6 px por frame y su opacidad se multiplica por `.93` por frame hasta `.03`. Como mucho 14 ondas a la vez. Una onda es la respuesta visual del principio 3: aparece en el mismo frame que el toque.

## Polígonos y figuras
- Los golpes de un anillo forman su **polígono** (trazo de 2 px, opacidad `.7`, relleno al `.08`, color del instrumento); con un solo golpe no hay polígono. Cada golpe es un punto relleno (radio 8) que **crece a 12 cuando la aguja pasa**; los 16 pasos libres son puntos de 3 px a `rgba(255,255,255,.35)`.
- Un círculo encendido: relleno del color al `.9`; apagado: `rgba(255,255,255,.05)` con contorno `.2`. Lo mío: un segundo contorno (radio +8, 2 px) del mismo color.

## Animaciones y desvanecimiento
- Todo lo que se mueve va **al compás** (la aguja, los latidos) o es una respuesta a un toque (ondas, vibración). Nada se mueve solo sin música.
- **Lo viejo se desvanece** (principio 5): el rastro del Coro (`×0.965` por frame hasta `.05`), las ondas, las estelas; lo apagado baja a opacidad `.25–.4`, no desaparece de golpe. Las hojas entran y salen con fundido (`sheet`).
- Una cosa pendiente (una parte que entrará en el próximo compás) **parpadea** (dos veces por segundo) hasta entrar.

## Movimiento reducido
- Con `prefers-reduced-motion: reduce`: sin animaciones de latido ni pulso (`play-pulse`, `bg-ball`), el aro no respira ni se tuerce, los cortes entran con fundido corto en vez de transición; el sonido y la respuesta a los toques no cambian. Se respeta en `VisualStage`, `Portada`, `MelodyOrgan`, `SettingsSheet` y el piloto.

## Rendimiento (vigilante de frames, `app/lib/frameGovernor.ts`)
- Objetivo: **60 fps** en un iPhone con todo sonando. El vigilante mide el p95 de ventanas de 120 frames: **> 14 ms baja un escalón** (primero los adornos del agua, luego el detalle de las células de fondo, el agua y el aro); **< 8 ms durante 5 ventanas seguidas sube uno**, con histéresis para no oscilar.
- Reglas: nada de trabajo por frame que se pueda cachear; sin asignar objetos en el bucle del lienzo; un solo `requestAnimationFrame` por pantalla; los lienzos del Laboratorio son de 680 × 680 fijos y se escalan con CSS.
- El vídeo (`useVideoExport`) copia los lienzos en cada frame: no añadir nada a la pantalla que no deba salir en el vídeo (botones fuera del lienzo).
