# 016 · La portada simple: música fácil, y mía

> Estado: **aprobada** (2026-11-16) con las decisiones de §9; **implementada** en las fases 1–5 (§12, §14, §15); falta la prueba con una persona nueva (fase 6) y la prueba de oído de la sincronía. Antes fue un borrador para revisar. Escrito después de probar el sintetizador de espiral (015 §14) y de ver que la app se complica.

## 1. El problema y la idea
coderbeats ya hace muchas cosas (Jugar y Componer, células y grupos, Escenario, Agua, voz, piloto, vídeo, producción, remixes, tres modos de sintetizador). Cada una es buena, pero **quien llega por primera vez no sabe por dónde empezar**. Lo mejor que hemos hecho, la **espiral** (las notas vienen a tu dedo), está escondido tras ⋯ → «+ melodía».

**La idea:** una **pantalla única** que es la **nueva portada de coderbeats** (no una app aparte). Todo lo demás pasa a un **«Estudio»** dentro de la misma app. La portada solo junta las mejores piezas que ya existen, con una interfaz nueva encima.

## 2. Lo que hace que alguien se quede (en este orden)
1. **Suena bien al instante, sin saber nada.** En menos de 10 s desde «Empezar» hay música sonando, y a los 20 s la persona la está tocando.
2. **Se ve bonito mientras suena.** El agua, la gota y la espiral son la identidad; nada de menús tapando.
3. **Se puede compartir en vídeo.** Un botón, un archivo que enseñar.

Cualquier cosa que no ayude a una de las tres se queda fuera de la portada.

## 2b. Ajuste (2026-11-16, tras ver muchos reels de Instagram de ritmos en círculo)
Esos vídeos son **para mirar, no para tocar**. **Nuestra diferencia es que el ritmo lo haces tú con la boca.** Por eso:
1. **La voz va primero.** Lo primero que se invita a hacer es **«Haz bum · pff · ts»**, y tus golpes **aparecen al instante en el círculo**. **La espiral de melodía viene después**, como segundo paso (no aparece hasta que hay ritmo).
2. **El vídeo es el gancho:** el de la portada queda **como esos reels** (círculo limpio, golpes de colores, aguja, **el estilo y los BPM arriba**), pero hecho con tu voz. El botón se llama **«🎬 Mi reel»**.
3. Apuntado para más adelante (sin programar): mando de consola y polirritmos (§13).

## 3. Principio: fácil pero **mío**
El riesgo de lo fácil es que la app parezca tocar sola. Reglas para que se note que **lo has hecho tú**:
- **La base es la única cosa que pone la app** (bajo y acordes del estilo, y un pulso suave). **Todo lo demás que se oye es un gesto tuyo.** Si no tocas ni cantas, la melodía y el ritmo no aparecen.
- **Tu voz y tus toques son el ritmo, tal cual**: sus golpes entran en el loop donde los hiciste (cuantizados al compás como hoy), no se sustituyen por un patrón de la app. El primer golpe suena y se ve **al instante** y, al volver el loop, **sigue siendo ese golpe**.
- **La melodía es un tema conocido, pero tú la «interpretas»**: el dedo decide el **brillo** (izquierda–derecha) y la **altura/octava** del tema (arriba–abajo) mientras llega; lo que se graba es **tu interpretación**, no la partitura. *(Decisión abierta, §9.1.)*
- **Todo lo que haces deja huella visible**: tu rastro de luz, tus golpes como puntos del color de la voz, y la gota cambia de forma con **tu** canción (ya lo hace con los loops).
- **Un deshacer siempre a mano** y **nada se borra sin deshacer**: probar no cuesta nada.

## 4. El flujo (4 pasos, una sola pantalla)
```
┌────────────────────────────────┐
│  hip hop · house · dnb · …     │  1 · Elige un estilo (la base empieza a sonar)
│                                │
│         agua / la gota         │  2 · Pon el dedo en el agua → aparece la espiral
│     (la espiral viene aquí)    │      y las notas vienen a tu dedo
│                                │
│   [ bum ]  [ pff ]  [ ts ]     │  3 · Ritmo: tu voz, o toca estas tres pastillas
│                                │
│  ↶    ● guardado     🎬 Compartir│  4 · Un botón: vídeo (y guardado automático)
└────────────────────────────────┘
```
1. **Estilo.** Al abrir, cinco tarjetas grandes (hip hop, house, dnb, dembow, techno). Al tocar una, **empieza a sonar la base** y la pantalla pasa a «tocar». Se puede cambiar de estilo cuando sea (conserva lo que hiciste, adaptado a la escala nueva).
2. **Ritmo primero.** (Ver abajo, «Ritmo».) La espiral aparece cuando hay ritmo.
2b. **Melodía: la espiral.** «Ahora pon el dedo en el agua.» Mantener y mover sin levantar: las notas del tema vienen al dedo y suenan al llegar (015 §14). «↻» cambia de tema (los 6 de la biblioteca, adaptados al estilo). Al acabar el tema, **queda como la melodía de la canción** y se puede volver a tocar encima (sustituye con deshacer).
3. **Ritmo.** El micro está **siempre escuchando**: «bum · pff · ts» entra directo. Para quien no tenga micro o esté en un sitio con gente, **tres pastillas** (bum, pff, ts) en la parte baja que se tocan con el dedo y entran igual en el loop. Sin calibración obligatoria (como hoy: modelo por defecto, y «¿te afino a tu voz?» si no acierta).
4. **Guardar y compartir.** Se guarda **solo** como «Mi canción» (la biblioteca de siempre). **🎬 Mi reel** graba un vídeo vertical **como un reel**: el círculo limpio con tus golpes de colores y la aguja, **el estilo y los BPM arriba** (`header`), 4 u 8 compases (≥ 10 s) y tu audio; sin opciones. El enlace de la canción queda en «más».

**Los dos primeros minutos guiados** (sustituyen a la guía y al tutorial actuales en la portada): una sola frase cada vez, tenue — «Elige cómo suena» → **«Haz bum · pff · ts»** → «Ahora pon el dedo en el agua» → «Se guarda solo. Compártelo con 🎬 Mi reel».

## 5. Lo que entra en la portada
| Pieza | De dónde sale | Qué cambia |
|---|---|---|
| Estilos con su base (bajo, acordes, escala) | `styles.ts`, fondo | ninguno; se elige con tarjetas |
| **Espiral + biblioteca de 6 temas** | 015 §13–§14 | pasa de ⋯ a ser la pieza central; el brillo (x) y la octava (y) los pone el dedo |
| **Ritmo con la voz** (modelo por defecto, sin calibrar) | 001 §17 | siempre escuchando; el «¿te afino?» se conserva |
| **Tres pastillas** (bum, pff, ts) | nuevo, mínimo | tocar en vez de cantar; entra como un golpe de voz |
| La gota, el agua, los golpes como puntos y la estela | aro + agua + flujo | igual; **más limpio** (sin botones sueltos) |
| **Vídeo** | 013 | un solo botón con opciones por defecto |
| **Guardado automático** y deshacer | biblioteca 006 | «Mi canción» se guarda sola; ↶ visible |
| «Entrar sin micro» | 001 §17 | pasa a ser el camino normal de las pastillas |
| Acerca de, licencia y créditos | `about.ts` | en «más» |

## 6. Lo que pasa a «Estudio» (sigue igual, solo se esconde)
Jugar/Componer con el mapa de células, grupos y disparadores · Escenario · «🎹 Agua» y los modos Puntos/Libre del sintetizador · pista de voz (007) · piloto y «Ver cómo se construye» · Previsualizar · Convertir en canción y las variaciones · Producción (swing, matices, transiciones) · remixes · Mis canciones completa · latencia, calibración, retraso de imagen, diagnóstico y código · el órgano de la melodía.

**Cómo se pasa de la portada al Estudio** (y vuelta):
- Un botón discreto **«⋯ → Estudio»** (y la preferencia se recuerda). Abre **el Estudio de hoy, con la misma canción**: lo que se hizo en la portada es una canción normal de **una célula** (base + loops de batería + loop de melodía), así que **aparece tal cual en Jugar/Componer** y se puede seguir.
- **Volver a la portada** desde avanzado: «⋯ → Modo simple». Si la canción tiene varias células o grupos, la portada **la toca y la graba igual** (sobre la célula que se ve) pero avisa de que lo demás se conserva y no se muestra; **nunca se borra ni se simplifica nada**.
- **Quien ya tiene canciones guardadas, calibración o preferencias** entra por la portada, con un acceso claro («Estudio» y «Mis canciones») y **todo lo suyo intacto**. La preferencia nueva (`ui: 'simple' | 'avanzado'`) se añade al guardado sin migración: sin ella = portada.
- Los enlaces compartidos y las canciones guardadas abren en el modo en que se hicieron (una célula → portada; más → avanzado).

## 7. Qué **no** se toca
Formato de canción y de biblioteca, calibración guardada, motor de audio y reloj, kits, estilos, análisis de voz, exportación de vídeo. **La portada es capa de interfaz y de orquestación** sobre lo que ya existe, más las tres pastillas y la nueva forma de elegir tema/estilo. Un fallo de la portada no puede dañar lo guardado: solo lee y escribe canciones válidas (`isSong`).

## 8. Cómo se sabrá que funciona
**Criterios (a comprobar con alguien que no la haya visto):**
1. Desde «Empezar», **suena música en < 10 s** y la persona **toca algo en < 20 s** sin leer.
2. En **1 minuto** hay una canción con base, melodía y ritmo **que ella ha hecho** y dice «es mío».
3. Comparte un vídeo sin ayuda.
4. **Nadie se pierde**: ninguna pantalla con más de 2 acciones visibles a la vez en la portada (estilo, ↻, ↶, 🎬, ⋯).
**Pruebas automáticas:** la portada solo usa canciones válidas; ida y vuelta portada ↔ avanzado no cambia los datos (test sobre la canción); con micro denegado funciona con pastillas; cambio de estilo conserva loops y melodía adaptada; el vídeo sale con las opciones por defecto. **Chrome sin pantalla** para el flujo de 4 pasos. **A mano (móvil):** el primer minuto con una persona nueva, y el oído (§3: ¿se nota que es tuyo?).

## 9. Decisiones (cerradas el 2026-11-16)
1. **Brillo + octava:** el dedo da el brillo (izquierda–derecha) y la octava del tema (arriba/abajo: arriba una octava más aguda, abajo una más grave, en el centro la del tema; si la nota no cabe en el registro del sinte, se queda en la más cercana que quepa). Lo que se graba es **la interpretación**, no la partitura.
2. **Sin tema conocido:** fuera de la primera versión. El modo ✋ Libre queda en el Estudio.
3. **Sincronía: sí.** La melodía **cae en el compás del motor** («que suene bien» es lo primero). Se hace **con cuidado, detrás de una opción** («Melodía en el compás», en «más» de la portada y en ajustes del Estudio), **sin tocar el reloj del motor**: la espiral **lee** la línea de compás y **programa** las notas en tiempo de audio (a la hora exacta de su paso); el tema empieza en una línea de compás (≥ 1,2 s por delante) y la melodía grabada lleva la fase de ese compás (`phaseBar`), así que **suena donde la tocaste**. Con la opción apagada, o con la música parada, se queda como hoy (reloj propio, sin sincronía). Tests de la parte pura y **prueba de oído** en ESTADO.md.
4. **Pastillas:** fila inferior.
5. **Todos entran por la portada;** si alguien elige el Estudio, **se recuerda** para la próxima vez (`ui: 'estudio'`) y entra directo.
6. **Nombre:** el modo avanzado se llama **«Estudio»**.

## 10. Fases propuestas (cuando se apruebe)
1. **Estructura y paso de ida y vuelta** (preferencia `ui`, portada vacía con las tarjetas de estilo y la base sonando; botón a avanzado; tests de datos).
2. **La espiral en la portada** (mover del sintetizador a la pantalla, con el brillo y la octava; cambio de tema; guardado en la célula).
3. **Ritmo:** micro siempre escuchando + las tres pastillas; golpes visibles al instante.
4. **Guardar y compartir:** guardado automático, ↶, botón de vídeo con opciones por defecto.
5. **Guía de los dos primeros minutos** y pulido visual (quitar todo lo que sobre en pantalla).
6. **Prueba con una persona nueva** y ajustes. *(La sincronía de §9.3 va en su propia parte, entre la 2 y la 3, y se escucha antes de darla por buena.)*

## 11. Pendiente (sin hacer ni decidido)
Melodía sin tema (§9.2) · más temas en la biblioteca y por estilo (que cada estilo tenga los que mejor le suenan) · un cuarto sonido de boca y ritmos más allá de bum/pff/ts · compartir la portada por enlace (hoy: el enlace de canción de avanzado) · versión de escritorio (la portada está pensada para móvil vertical).

## 12. Implementado: fase 2 y la sincronía (2026-11-16)
- **Espiral en la portada** (`ThereminOverlay` con `bare`): el dedo pone el brillo (x) y la **octava** (y: `octaveZone`, `shiftToList`: la nota desplazada es siempre una del sinte; si no cabe, la octava más cercana que sí); lo grabado es **lo que sonó** (`interpretedHits`).
- **Melodía en el compás** (`ui.syncMelody`, por defecto **encendida**; «⋯» de la portada y ajustes del Estudio): el motor **no cambia**; la espiral **lee** el reloj (`engine.barClock()`), el tema **empieza en la primera línea de compás con ≥ 1,2 s por delante** (`syncStart`) y cada nota se **programa a su hora de audio** (`thereminAt`, hasta 150 ms antes), con el paso del motor (`stepSec`); la imagen va corrida por la latencia de salida. Al acabar cada vuelta, lo que sonó pasa a ser la melodía del loop **con la fase del compás de salida** (`phaseBarOf`: el loop suena (g − fase) mod 4, así cae donde se tocó). Sin música, con varias células o con la opción apagada: el reloj propio de antes. **Comprobado:** 64 notas programadas en Chrome con **desvío 0,00 ms** respecto a la rejilla de pasos del motor; test de que la melodía con fase suena en los compases correctos (Strudel evaluado); tests de `syncStart`, vueltas y finales de nota.
- **Mientras tocas en vivo, y ya hay una melodía grabada, suenan las dos** (la grabada y tu voz de sintetizador): la grabada es tu vuelta anterior, así que se superponen. Decisión a oír (ESTADO).

## 13. Para más adelante (apuntado, **sin programar**)
- **Mando de consola (Gamepad API):** tocar con un mando: los botones como pastillas (bum · pff · ts), un stick para el dedo de la espiral (brillo y octava). Pensar el mapeo y la latencia (el mando se lee por fotograma).
- **Polirritmos («3 contra 4»):** un estilo cuyos loops tienen pulsos distintos (3 y 4 pasos por vuelta) que **se vea en el círculo** (dos anillos con aguja propia que se alinean cada 12 pasos). Exige loops de longitud no potencia de 2 (hoy 1, 2 o 4 compases de 16 pasos): decidir si es un tipo de loop nuevo.

## 14. Implementado: fases 3, 4 y 5 (2026-11-16)
Pastillas (`tapPad`), ↶ ↷ (`LoopHistory`), guardado automático como «Mi canción» (como mucho 3 s tras el primer cambio), **«🎬 Mi reel»** (`header` en `useVideoExport`: estilo y BPM arriba) y la **guía en el orden nuevo** (`portadaStep`: estilo → voz → dedo → guardar). **La espiral solo aparece cuando hay ritmo.**

## 15. Ajuste: «la forma de tu ritmo» y «Anatomía de tu ritmo» (2026-11-16)
Idea tras ver un reel «Anatomía del reggaetón, capa por capa»:
1. **La forma de tu ritmo.** En el aro, los golpes de cada instrumento (bombo, caja, platillo) se **unen con líneas finas de su color** y cada carril forma una figura (polígono): se ve **la forma de tu ritmo**. Va **encendido en la portada, en Previsualizar y, por tanto, en el vídeo** (el vídeo graba el aro). Es solo un dibujo del aro (`AroFrame.shapes`, `lib/aro/shapes.ts`); no toca datos ni sonido. Con el detalle del aro bajado por el vigilante de frames, se dibuja igual (son 3 trazos).
2. **Rótulos de capa en Previsualizar.** Al entrar cada capa, un rótulo corto y numerado que la explica: **«1 · Bombo: el pulso»**, **«4 · Ghost notes: golpes suaves de caja justo antes»** (`lib/layerCaptions.ts`).
   - **Las frases salen de cada estilo** (escritas a mano para los 5: hip hop, house, dnb, dembow y techno) para bombo, caja, platillo, bajo, acordes y melodía.
   - **Para las canciones de cualquiera se generan de sus datos** (`describeDrums`): el patrón se reconoce (cuatro al suelo, contratiempos, el backbeat de los tiempos 2 y 4, el tresillo del dembow, semicorcheas…) y, si no es ninguno, se cuenta («5 golpes por compás»). Las **ghost notes** se detectan en la caja (golpes suaves justo antes de uno fuerte) y salen como capa propia al final de la primera célula, junto a la melodía.
   - La numeración sigue el orden en que entran las capas; la frase del estilo y la de los datos se unen cuando las dos aportan.
3. **El vídeo de Previsualizar es el reel «Anatomía de tu ritmo»:** el rótulo de la capa que entra **se dibuja en el vídeo** (píldora abajo), junto con el círculo con sus figuras, el estilo y los BPM (`header`).
**Pendiente:** el botón de Previsualizar en la portada (hoy está en el Estudio: el piloto toca las bolas de bajo y acordes y las tiras del aro, que la portada esconde); el círculo sale algo pequeño en el vídeo vertical (encuadre más cerrado).
