# Spec 057 · Pantalla de inicio del Laboratorio como collage (corta)

## Por qué
La entrada era una lista de cinco botones iguales (solo Remixes destacaba). Ion pidió algo «como Spotify»: tarjetas de colores y tamaños distintos, con icono, y Remixes arriba y más grande (2026-11-23).

## Qué cambia (`app/pages/lab/index.vue`)
- Cuadrícula de 2 columnas con filas de 92 px: **Remixes** (ancha y alta, arriba), **Capas** (alta) junto a **Piano mágico** y **Círculo de ritmo** (pequeñas, una sobre otra) y **Coro** (ancha y baja, abajo).
- **Cada tarjeta lleva el color de su instrumento** (`VOICE_HEX`, sin colores nuevos): Remixes rosa (acento), Capas lila (bajo), Piano verde agua (melodía), Círculo ámbar (bombo), Coro azul (platillo; el Coro usa rosa, lila y azul). Texto y dibujo en `#0B0B0F`.
- Un **icono SVG** plano por tarjeta (barras del Pulso, capas, teclas, anillos, tres voces). Las tarjetas pequeñas muestran solo el título; las grandes, también su frase.
- Se mantiene `data-lab-remixes` en la tarjeta de Remixes. Los textos no cambian.

## Principios
1 ✔ una pantalla, una elección · 2 ✔ no toca el sonido · 3 ✔ la tarjeta responde al toque (`active:scale`) · 4 ✔ · 5 ✔ cinco tarjetas, como antes · 6 ✔ · 7 ✔ la portada de Spotify y de Incredibox · 8 ✔ se quita el borde rosa y el fondo gris de las tarjetas; el mini Pulso pasa a ser el dibujo de Remixes.

Diseño: sin animación propia (solo la respuesta al toque; con movimiento reducido, sin transición); zona de toque mínima 92 px de alto; textos ≥ 12 px reales.

## Decisiones a revisar
- Los colores se reparten por «instrumento más parecido»; Ion puede preferir otro reparto.
- Las tarjetas pequeñas no enseñan la frase (si hay que explicar, se simplifica: principio 1).

## No comprobado
Solo visto en el navegador sin pantalla (390 × 844 y 360 × 640). **No visto en un iPhone.**
