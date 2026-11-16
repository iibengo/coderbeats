# Spec 022 · Auditoría de todo el Estudio (sin programar)

Estado: **para revisar; no se ha tocado nada.** Guía: `PRINCIPIOS.md` y `DISENO.md`. Objetivo del Estudio (spec 020): **crear y editar remixes** (partes, capas, batería, melodía, duración ≈ 1–2 min). Ya existen el panel **«Editar parte»**, **«Mis remixes»** (con los de serie) y el Órgano; muchos controles viejos hacen lo mismo o sirven a otra cosa.

**Clases:** **★ Imprescindible** (a la vista) · **A Avanzado** (escondido en «Avanzado», sigue funcionando) · **S Sobra** (se esconde ya y se quita tras probarlo). «Q» = decisión que te dejo a ti.
Fuentes: `Studio.vue`, `visual/VisualStage.vue`, `SettingsSheet.vue`, `LibrarySheet.vue`, `PartPanel.vue`, `DrumEditor.vue`, `visual/MelodyOrgan.vue`, `visual/StageOverlay.vue`, `visual/ThereminOverlay.vue`, `visual/WaterKeysOverlay.vue`, `StartScreen.vue`, `LatencyStep.vue`, `SoundStep.vue`, `VideoSheet.vue`, `PilotLayer.vue`, `AboutPanel.vue`, `ConfirmDialog.vue`, `lib/tutorial.ts`, `lib/firstMinute.ts`, mensajes `say(...)` del motor.
⚠ No he abierto cada gesto en un móvil: lo marcado «(código)» sale de leer el código, no de usarlo.

## 0. Vocabulario único (para el usuario)
| Hoy | Propuesta | Por qué |
|---|---|---|
| célula | **parte** | ya lo usan Remixes y el panel |
| loop / capa de ritmo | **capa** (batería, melodía, bajo, acordes) | una palabra; «loop» es jerga |
| canción / Mis canciones | **remix / Mis remixes** | lista única (hecha) |
| Componer / Jugar | **Armar / Tocar** (Q) o esconder el selector | «Componer» y «Jugar» no dicen qué cambia |
| Escenario / Efectos | **Efectos** | una sola palabra |
| Sintetizador de dedo / 🎛 Tocar / Teclado de agua | **Teclado** (la melodía con el dedo) | tres nombres para lo mismo |
| fondo / bajo y acordes del fondo | **bajo** y **acordes** (capas de la parte) | «fondo» confunde |
| piloto automático / Previsualizar / «Ver cómo se construye» | **Ver cómo se hizo** | tres nombres para una cosa |
| Convertir en canción / ✦ | **Montar el remix** | verbo de lo que hace |
| frase, cierre, repetir instrumento, ayuda, producción, calor… | (ver §D: casi todo avanzado) | |
| Drop (botón) | **Drop** (se queda: lo entiende quien hace remixes) | |

## A. Arranque
| Elemento | Qué hace / texto actual | Clase | Propuesta |
|---|---|---|---|
| Pantalla de inicio (`StartScreen`) | «coderbeats · Tu beatbox, convertido en batería y en código Strudel.» + **Empezar** | ★ | «Tu música, a tu manera.» (sin «Strudel» ni «beatbox»: el micro es opcional) + **Empezar** |
| «Entrar sin micro» + «Verás una demo y podrás tocar con el dedo (la espiral y las pastillas).» | entra sin permiso de micro | ★ (debería ser el camino por defecto) | **Empezar sin micro** como botón principal; el micro, opcional dentro de Batería 🎤 |
| Aviso «no seguro» (HTTPS) / error del micro | avisos rojos | A | «Para usar el micro hace falta una conexión segura.» |
| «Acerca de» (en el inicio) | licencia y créditos | A | mover solo a Ajustes → Acerca de |
| Latencia (`LatencyStep`, «Con cascos: suenan 4 clics. Da una palmada con cada uno…») | mide el retraso del micro | A | solo si se usa el 🎤: «Con cascos: aplaude con cada clic.» |
| Tus sonidos (`SoundStep`, «Cada sonido, N veces. Unos 20 segundos.», «Di “bum”…») | calibra la voz | A | solo si se usa el 🎤; «Di “bum” 3 veces.» |
| «¿Te afino a tu voz?» (aviso) | propone calibrar | S | quitar: aparece solo con micro, ya está en el 🎤 |

## B. Pantalla principal
| Elemento | Qué hace | Clase | Propuesta |
|---|---|---|---|
| **Estilo** (5 botones en fila) | cambia el estilo de todo | ★ → cambia (spec 023) | etiqueta `house · 124`; el estilo se elige al empezar el remix |
| **BPM** (tocar 4 veces fija el tempo; mantener vuelve al del estilo) | tempo fácil | ★ | texto: «tempo 124 · toca 4 veces para cambiarlo» |
| ▶ / ■ | tocar / parar | ★ | igual |
| **✎ Editar parte** (nuevo) | panel de capas | ★ | igual |
| **Mis remixes** (icono de lista) | guardar, abrir, de serie | ★ | icono + etiqueta «Remixes» |
| **⋯** | ajustes | ★ | «Más» (casi todo irá a «Avanzado») |
| **Selector Jugar \| Componer** | cambia lo que hacen los toques: grabar capas con la voz/dedos o mover/ordenar partes en el mapa | A (Q) | Si «Editar parte» + lista de partes cubren ordenar y editar, el selector se esconde y «Componer» queda en Avanzado |
| **Pastillas bum · pff · ts** (`PadsRow`) | tocar un golpe a mano | A | quedan como entrada rápida en Batería; fuera de la pantalla principal |
| **Tira de partes** (`CellStrip`, «partes de la canción») | saltar a una parte | ★ (con el tiempo total, spec 020) | `Intro · Estrofa · Drop…` con **duración total** «1:12» |
| **Bolas de capas** (loops, fila): tocar = silenciar, mantener = borrar | ver y apagar capas | S | lo cubre «Editar parte» (círculos con estado); esconder y quitar |
| **Bolas del fondo** (bajo, acordes) tocar = encender | ídem | S | ídem (están en «Editar parte») |
| **Aro / agua** (visual) | la visual principal; tocar una franja pone un golpe | A | queda como visual y para el vídeo; fuera como interfaz principal |
| **Mapa de células / colonia** (pellizcar, arrastrar, hilos, grupos) | ordenar y encadenar partes | A (Q) | sustituido por la lista de partes (añadir, quitar, duplicar, mover) |
| «Dale a ▶» (primera vez) | latido en Play | S | quitar (la guía de §J lo cubre) |
| «Sin micro · dale a ▶ y toca con el dedo» | aviso | S | quitar |

## C. Botones de acción sobre el aro (`act-btn`)
| Botón (texto actual) | Qué hace | Clase | Propuesta |
|---|---|---|---|
| ∞ Soltar bucle | sale de repetir una parte | ★ (con el 🔒 de la mejora «bloquear en bucle») | 🔒 Parte fija |
| Apagar grupos | apaga lo que suena en paralelo | A | (grupos en paralelo: avanzado) |
| ◎ Centrar / «Editando · X ▶ Seguir la canción» | vista y reproducción separadas | A | «Seguir» |
| Variaciones: + energía, − energía, melodía, relleno, igual · ↻ otra · ✓ | genera una copia con otra energía | A (Q) | «Variaciones» en Avanzado |
| ⚡ Escenario / ⚡ Efectos | pantalla de efectos en directo (crash, barrido, boom…) | A | «Efectos» |
| 👁 Previsualizar | la canción se construye sola | S | «Ver cómo se hizo» en Avanzado |
| 🎛 Tocar | sintetizador de dedo de la parte | A | «Teclado» |
| Teclado de agua (aro) + ● grabar lo tocado | notas de la escala tocando el fondo | S | lo cubre el Órgano y, después, el Piano mágico |
| 🎤 Voz (con cascos) | graba la voz en bucle | A | «Voz» (Avanzado) |
| ● Grabar canción | apunta qué capas suenan por compás | A | lo cubre «Remixes → ● Grabar mi versión» del Laboratorio |
| ✦ Convertir en canción | monta la estructura del estilo | A | «Montar el remix» |
| Melodía sugerida (↻ Otra melodía · ✕) | propone una melodía | A | «Sugerencia de melodía» |
| ↶ Deshacer el último borrado | deshace | ★ | «Deshacer» |
| ✕ Salir (Escenario) y botones propios del Escenario | | A | |

## D. Menú ⋯ → Ajustes (`SettingsSheet`, 4 pestañas)
| Elemento | Clase | Propuesta |
|---|---|---|
| Pestañas **ajustes · código · diagnóstico · acerca de** | A | «código» y «diagnóstico» a Avanzado; «acerca de» al final |
| **Kit** (808, electro…) | ★ | «Sonido» (batería) |
| **Fondo** (manual, progresivo, completo, sin fondo) | S | cada parte ya elige su bajo y sus acordes |
| **Frase** (1 compás / por silencio), **Cierre**, **Frase máxima** | A | solo para grabar con la voz |
| **Repetir instrumento** (sustituye / completa) | A | ídem |
| **Ayuda** (cuantiza y ajusta a la escala) | ★ | **«Ajustar a la escala»**, activado; nunca debería ser un ajuste que haga sonar mal |
| **Sugerencias**, **Producción (beta)**, **Agua viva**, **Melodía con la voz (beta)**, **Movimiento del móvil**, **Metrónomo** | A | todo en Avanzado (metrónomo útil al grabar el Órgano: se queda en el propio editor) |
| **Retraso de imagen** + auto + prueba de sincronía | A | solo si se usa el micro |
| **Calor** (deslizador) | A | |
| **Drop** | ★ | queda como botón «Drop» (efecto de DJ) |
| **Vaciar**, **Cargar demo** | S | «Vaciar» → «Nuevo remix»; «Cargar demo» desaparece (spec 023) |
| **👁 Previsualizar**, **🎬 Exportar vídeo**, **▶ Ver cómo se construye** | ★ vídeo · S los otros dos | «🎬 Vídeo» a la vista en «Remixes» |
| **Convertir en canción**, **Repetir la guía y el tutorial** | A | |
| **Añadir célula libre**, **+ melodía**, **Melodía en el compás**, **Modo simple** (portada) | S | quitar (grupos en paralelo, sintetizador antiguo, portada pausada) |
| Textos de ayuda («Arrastra en vertical sobre el agua para el filtro…», «Sonidos: …», «Recalibrar…») | A | |
| Aviso ámbar «El micro oye los altavoces. Usa cascos.» | A | solo con micro |

## E. Mis remixes (`LibrarySheet`)
| Elemento | Clase | Propuesta |
|---|---|---|
| Campo de nombre + **Guardar / Guardar cambios / Guardada** | ★ | «Guardar» (guarda en el mismo remix si viene de uno) |
| Lista (buscar por nombre o estilo, agrupada por estilo si hay > 4) | ★ | el buscador solo con > 8 |
| Fila: abrir · 👁 · 🔗 · ✎ renombrar · borrar (con deshacer 8 s) | ★ (abrir, compartir, renombrar, borrar) · S (👁) | 🔗 «Compartir» como texto; 👁 a Avanzado |
| «De serie» (principal ≈ 1 min) + «Archivo» (largas) | ★ | igual |
| Mensajes: «Aún no has guardado ningún remix.», «Viene de «X».», «Aún no hay nada que guardar…» | ★ | «Todavía no hay remixes tuyos.» |
| Confirmaciones («¿Abrir «X»? Tu canción de ahora no está guardada.», «¿Borrar «X»? Se puede deshacer unos segundos.») | ★ | «Lo de ahora no está guardado. ¿Abrir «X»?» |

## F. Editores (nuevos o mejorados)
| Elemento | Clase | Propuesta |
|---|---|---|
| **Editar parte** (◀ ▶, 4–5 círculos, «✎ editar») | ★ | título: nombre de la parte; subtítulo «parte 2 de 7» |
| **Batería** (círculo / cuadrícula / 🎤 boca / vaciar) | ★ (🎤 opcional) | |
| **Órgano** (casillas, 1·2·4 compases, ● grabar, ↻ responder, fino, ↶ deshacer, ▲▼, «+N melodías apiladas») | ★ | «grabar» → «Tocar y cuadrar» |
| Franja de la melodía (tocarla abre el Órgano) | S | (ya hay botón en «Editar parte») |
| Mejoras en cola (spec 024): ▶ Tocar en el Laboratorio, 🔒 parte fija, barra de tiempo | ★ | |

## G. Otras pantallas
| Elemento | Clase | Propuesta |
|---|---|---|
| **Escenario** (4 zonas: bombo, boom, crash, barrido; «Grabar efectos» → capas) | A | «Efectos» |
| **Teclado de agua** | S | quitar tras el Piano mágico |
| **Sintetizador de dedo** (arriba/abajo = nota, lados = filtro) | A | «Teclado» |
| **Pista de voz** (🎤 Voz, cascos, IndexedDB) | A | |
| **Piloto automático** («piloto automático · demo · micro bloqueado 🎙✕», ⏸ ⏭ ✕) | S | «Ver cómo se hizo» (solo dembow hoy): quitar hasta que valga para cualquier remix |
| **Previsualizar** (la canción se construye sola) | A | fusionar con el piloto |
| **Exportar vídeo** (Qué grabar, Compases, Formato, Calidad, Marca, ● Grabar, Guardar/Compartir) | ★ (simplificado) | «Vídeo del remix»: sin opciones; vertical 720 ≤ 2 min |
| **Acerca de** (licencia AGPL, créditos) | A | en Ajustes |

## H. Guía, tutorial y avisos
| Elemento | Clase | Propuesta |
|---|---|---|
| **Guía del primer minuto** («Haz bum · pff · ts», «Toca la franja de la melodía», «Canta «na»…») | S | se rehace para el remix: «Abre un remix de serie → toca una parte → edítala» (3 pasos) |
| **Tutorial** (mano fantasma: «Arrastra un golpe», «Llévalo al centro para borrarlo») | S | idem |
| **Avisos del motor** (`say`): «Grabando: enciende y apaga capas al ritmo», «No caben más loops (8)…», «Fundidas · N no entraron», «Melodía grabada: N notas (sustituye a la anterior)», «Tu canción: N partes…», «Voz grabada…», «No se pudo abrir el micro» | ★ (cortos) | vocabulario: «No caben más capas (8): quita alguna», «Melodía grabada: N notas», «Tu remix: N partes» |
| **Confirmaciones** (`askConfirm`): «¿Borrar toda la canción?», «¿Borrar todo y empezar de cero?», «¿Reemplazar tu canción por la demo…?» | ★ | unificar: «¿Borrar este remix?» / «¿Empezar de cero?» |
| **Diagnóstico** (registro, prueba ×8/×16 células, visual, pantalla) | A | solo desarrollo |

## I. Resumen de lo que sobra con el panel «Editar parte»
- **Sobran como interfaz:** bolas de capas y de fondo (fila del aro), «Fondo» (ajuste), «Añadir célula libre», «+ melodía», «Melodía en el compás», «Modo simple», «Cargar demo», Teclado de agua, franja de la melodía como única puerta, «¿Te afino a tu voz?», «Dale a ▶», «Sin micro…», guía del primer minuto y tutorial actuales, piloto/Previsualizar (uno solo, y solo si funciona con cualquier remix).
- **Pasan a Avanzado:** Componer/mapa, variaciones, grupos en paralelo, frase/cierre/repetir, sugerencias, producción, agua viva, voz, retraso de imagen, calor, metrónomo (el del editor se queda), código, diagnóstico, calibración, Escenario/Efectos, sintetizador de dedo.
- **Se queda a la vista:** estilo+tempo (etiqueta), ▶/■, Editar parte, Remixes (con Guardar, Compartir, de serie), lista de partes con duración, Kit, Drop, Deshacer, Vídeo, Ajustar a la escala.
- **Conteo:** el Estudio tiene hoy unas **60 cosas distintas a la vista o a un toque** (estilo ×5, BPM, play, listas, selector, pastillas ×3, bolas, ~12 botones de acción, ajustes ×20…); la propuesta deja **≈ 12 a la vista** y el resto detrás de «Avanzado».

## J. Decisiones para ti (Q)
1. ¿Esconder el selector **Jugar | Componer** y el mapa de células (el orden de las partes lo da la lista)?
2. ¿Las **pastillas bum·pff·ts** salen de la pantalla principal?
3. ¿**Variaciones** a Avanzado o se quitan?
4. ¿Se quita el **Teclado de agua** ya o tras el Piano mágico (propongo tras)?
5. ¿**Entrar sin micro** como camino por defecto (propongo sí)?
6. ¿Vocabulario: **Armar/Tocar** o esconder el selector?

## K. Aplicado (2026-11-16, tras tus decisiones) y decisiones a revisar
Hecho **escondiendo, sin borrar**: un único interruptor «Controles avanzados» en ⋯ (`coderbeats:studio:v2`, por defecto apagado) que muestra todo lo escondido.
- Esconde (sin avanzado): selector Jugar|Componer (y con él el mapa), bolas de capas y de fondo, botones Efectos, Previsualizar, 🎛 Teclado, teclado de agua y su grabar, Voz, ● Grabar canción, ✦ Convertir, «apagar grupos»; en ⋯: Fondo, Frase/Cierre/Repetir, Sugerencias, Producción, Agua viva, Melodía con voz, Movimiento, Metrónomo, Retraso de imagen, Calor, Previsualizar, Ver cómo se construye, Convertir, Repetir guía, Añadir célula libre, Melodía en el compás, Modo simple, + melodía, textos de ayuda, calibración, **Cargar demo**; y las pestañas «código» y «diagnóstico».
- Las pastillas bum·pff·ts **ya no estaban** en la pantalla principal del Estudio (solo en la portada pausada).
- **Variaciones:** siguen saliendo solas (contextuales) al duplicar; nuevo **«⧉ Duplicar con variación»** en «Editar parte» (copia detrás de la actual y propone variaciones; máx. 8 partes).
- **«Empezar» entra sin micro**; «Usar el micro (opcional)» aparte. Vocabulario: parte, Sonido, Ajustar a la escala, Empezar de cero.
- **Decisiones mías a revisar:** (1) un solo interruptor «avanzado» en vez de una pantalla «Avanzado» (más simple; ordenar por secciones queda para después); (2) «Cargar demo» se esconde ya (la demo de ritmo se carga sola al «Empezar»; la sustituirá el remix principal con la spec 023); (3) «Duplicar con variación» activa «Sugerencias» (ajuste escondido) para que salgan las variaciones; (4) los textos de ayuda largos de ⋯ se esconden en avanzado y no se han reescrito; (5) sin reescribir aún la guía del primer minuto ni el tutorial (siguen en el código, sin pasos visibles que apunten a lo escondido: **sin probar en el móvil**); (6) los guiones de navegador antiguos que tocan bolas o botones escondidos pueden fallar sin «avanzado».
- **Teclado de agua (hecho, 2026-11-16):** tras el Piano mágico en el Órgano, se quitan de la interfaz los dos botones (el teclado de agua y su «grabar»). El código del motor y de `WaterKeysOverlay` se queda sin puerta (se puede borrar del todo tras probar el Piano mágico).
