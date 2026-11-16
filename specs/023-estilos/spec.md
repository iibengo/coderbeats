# Spec 023 · Estilos: house y techno se parecen demasiado (propuesta, sin programar)

## 1. Lo que hay (medido en `app/lib/styles.ts`)
| | house | techno |
|---|---|---|
| Tempo | 124 | 128 |
| Bombo (prior y plantilla) | 4 × 4 | 4 × 4 (idéntico) |
| Caja | contratiempos 2 y 4 | idéntico |
| Platillo | a contratiempo (pasos 2, 6, 10, 14) | idéntico |
| Bajo | notas sueltas a contratiempo, sierra con envolvente | pulso a corcheas, sierra |
| Acordes | stab corto (`struct "~ x ~ x"`), fa menor | pad largo, do menor |
| Escala / sinte | fa menor · lead | do menor · lead |
| Demo | la misma de ritmo | la misma de ritmo |

**Conclusión:** el *ritmo* es el mismo; solo cambian el tempo, la tonalidad, el bajo y los acordes. Al tocar con la voz o el Círculo suenan igual. Tienes razón.

## 2. Decisión (2026-11-16): sin «minimal» ni familias
**Lista plana de 5 estilos: hip hop, house, dnb, dembow, techno.** El problema real es que house y techno suenan igual; se diferencian **por patrones típicos** (no por tonalidad):

| | **House** (~124 bpm) | **Techno** (~132 bpm) |
|---|---|---|
| Bombo | 4×4 con peso (kit 808) | 4×4 **constante y seco** |
| Caja / palmada | **palmada en 2 y 4** | sin palmada fija |
| Platillo | **abierto a contratiempo** | percusión **hipnótica** (semicorcheas, clics repetidos) |
| Swing | **algo de swing** en las semicorcheas | recto, sin swing |
| Bajo | sincopado, redondo | **rodante en semicorcheas** |
| Acordes | **piano alegres** (stabs) | **casi sin acordes** (una nota larga, oscura) |
| Carácter | alegre, cálido | más oscuro, mecánico |

Cada uno con **su demo/remix principal, su escala, su bajo y sus acordes**. Prueba: 4 compases de cada uno con alguien que no conozca la app. *(De oído: sin probar hasta que lo escuches.)*

### Las canciones guardadas no cambian de sonido
`house` y `techno` mantienen sus ids, pero el cambio de patrones **no debe alterar lo ya guardado**: una canción lleva sus propios loops (los golpes se guardan), así que lo único que cambia con el estilo es el **fondo** (bajo y acordes) y el tempo. Para que no suene distinto: las canciones guardadas **fijan lo que usaban** (guardan el patrón de bajo, los acordes y el tempo con el id de «versión de estilo» `v1`); las nuevas usan `v2`. Quien quiera la versión nueva en una canción vieja, **la elige** (en «Estilo» → «Usar el sonido nuevo»). Mientras no haya marca, se interpreta como `v1`. Cambio compatible (campo opcional), con test de que una canción vieja produce **el mismo código Strudel** antes y después.

## 3. La barra de arriba (estilos + tempo) y el botón «demo» (aprobado: estilo al empezar el remix, etiqueta de estilo y tempo arriba, fuera «Cargar demo»; la demo es el remix principal de cada estilo)
- **Hoy:** cinco estilos en fila + el tempo (tocar 4 veces lo fija; mantener lo vuelve al del estilo) + «Cargar demo» en Ajustes.
- **Problema:** con 6 estilos la fila no cabe en un móvil, y **cambiar de estilo con una canción hecha** la deja sonando con otro bajo y otros acordes (confunde): el estilo es una decisión **de la canción**, no un interruptor suelto.
- **Propuesta:**
  1. **El estilo se elige al empezar** (al abrir un remix, o en «Nuevo remix» con la lista de estilos agrupada: lista plana de 5) y en la barra queda **como etiqueta** con su tempo (`house · 124`), no como seis botones. Tocarla abre la lista, con un aviso si hay cosas hechas («cambia el bajo, los acordes y el tempo; tu ritmo y tu melodía se quedan»).
  2. **El tempo se queda** (tocar 4 veces = tempo fácil; es de lo más útil y es de toda la canción).
  3. **«Cargar demo» se quita como botón:** la demo de cada estilo pasa a ser **su remix principal de serie** (se abre desde «Mis remixes → De serie»). Una cosa menos que explicar (principio 8) y la demo deja de ser un ritmo suelto para ser algo que ya suena a canción. Mientras no haya remix de un estilo, «Nuevo remix» arranca con la demo de ritmo de ese estilo como hoy (sin botón).

## 4. Principios
1. Una pantalla, una cosa ✔ (el estilo se elige una vez, al empezar). 2. No puede sonar mal ✔ (cada estilo con su escala; el aviso al cambiar). 3. Inmediata ✔. 4. Tuyo ✔ (mi ritmo y mi melodía se conservan al cambiar de estilo). 5. Pocas cosas ✔ (de 5 botones a 1 etiqueta). 6. Compartir ✔ (el estilo va en el enlace como siempre). 7. Precedente: los «géneros» de GarageBand y Groovepad ✔. 8. Quitar antes de añadir ✔ (se quita «Cargar demo» y la fila de estilos; se añade un estilo y a cambio se separan dos que eran uno).

## 5. Fases
1. Diseñar **house / techno / minimal** de verdad (priors, plantillas, bajo, acordes, tempo, kit) y comprobar de oído que se distinguen en 4 compases. *(Necesita oído: sin probar hasta que lo escuches.)*
2. Etiqueta de estilo + lista agrupada; «Nuevo remix».
3. Quitar «Cargar demo».
4. Remixes principales que falten.

## 6. Pendiente
- Falta un remix principal de **house**, de **hip hop** y de **dnb** (hoy: dembow y techno ×3). Mientras no lo haya, «Nuevo remix» usa la demo de ritmo de ese estilo, sin botón.
- Se hace **después de la auditoría**, en el orden acordado, **en un commit**.

## 7. Hecho (2026-11-16) y decisiones a revisar
- **Cómo se garantiza que lo guardado no cambia de sonido:** en vez de versionar el fondo dentro del motor (arriesgado), **`house` y `techno` se quedan tal cual (clásicos, `legacy`)** y los nuevos son estilos con id propio, **`house2` y `techno2`** (etiqueta «house» / «techno»). Todo el código ya se guía por el id del estilo, así que las canciones y los remixes de serie con `house`/`techno` suenan **idénticos** (test de que sus datos y su código siguen igual). La lista para elegir enseña los 5 estilos nuevos; un clásico solo sale si es el de la canción abierta («house (clásico)», «techno (clásico)»).
- **Datos nuevos:** house2 (124): bombo 4×4, palmada en 2 y 4, platillo a contratiempo, bajo sincopado, stabs de piano (do mayor); techno2 (132): bombo constante, un solo golpe de caja, percusión hipnótica, bajo rodante en semicorcheas sin los pasos del bombo, una sola nota larga oscura de acordes (do frigio). Cada uno con su demo, su plantilla de canción, sus rótulos y sugerencias. **Sin probar de oído.**
- **Swing de house:** no está en los patrones (los loops van a rejilla); lo da «Producción» (ajuste avanzado). A revisar si hay que ponerlo por defecto en house.
- **Etiqueta de estilo** (`house ▾`) en vez de los 5 botones; con algo hecho pide confirmar («Cambia el bajo, los acordes y el tempo; tu ritmo y tu melodía se quedan»). «Cargar demo» escondido (la demo de ritmo se carga sola al «Empezar»).
- **Remix principal por estilo:** hay para dembow (Himno), techno clásico (Dies Irae, Wow, Mozart), **house2 (Himno)** y **techno2 (Wow)**; **faltan hip hop y dnb** (siguen con la demo de ritmo).
- **Pendiente:** los remixes de serie de techno clásico no se pasan a techno2 (cambiarían de sonido); si te gusta techno2, se pueden rehacer.
- **Cambio (2026-11-17):** la **demo de cada estilo vuelve a ser un botón a la vista**: en la lista de estilos (`house ▾`), cada fila lleva «demo» (pone el estilo y su ritmo de demostración; pide confirmar si hay algo hecho). El botón suelto «Cargar demo» de Ajustes sigue en «avanzado». Además, **«▶ Lab»** a la vista en la pantalla principal (junto a ✎): abre el Laboratorio con el remix de ahora (lo guarda en el mismo remix, sin copias).
