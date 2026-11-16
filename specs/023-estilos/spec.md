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

## 2. Propuesta
**Agrupar la música electrónica en una familia con tres estilos de verdad distintos** y dejar el resto como está:
- **House** (124): bombo 4×4, **palmada** en 2 y 4, platillo abierto a contratiempo, **shuffle** ligero (swing en las semicorcheas), bajo sincopado, acordes stab. Kit 808. Más «bailable», calidez.
- **Techno** (130): bombo 4×4 **más largo y grave**, **sin palmada fija** (caja en pellizco cada 4 compases), platillo a semicorcheas desde el drop, bajo de **pulso a corcheas**, acordes de pad oscuros. Kit electro. Más «máquina», empuje.
- **Minimal** (126, nuevo): bombo seco, **muy pocos golpes** (rim y clics en huecos), bajo de **una sola nota** que respira, **sin acordes** (o una sola nota larga), mucho silencio; la melodía son 3–4 notas. Kit electro suave. Más «aire».
- Siguen igual: **hip hop, dembow, dnb** (ya se distinguen).

Cada uno con **su demo, su escala, su bajo, sus acordes y su remix principal** (hoy solo hay remix de dembow y techno; faltaría uno de house, uno de minimal y uno de hip hop/dnb o dejarlos sin demo hasta que haya). Cada estilo debe oírse distinto en 4 compases (prueba con alguien que no conozca la app: «¿cuál suena a qué?»).

### Datos guardados
`house` y `techno` **se quedan con su id** (las canciones guardadas y los enlaces siguen abriendo); `minimal` es un id nuevo: una versión antigua que reciba una canción `minimal` no la abre (no la borra, como con cualquier estilo desconocido). Nada que migrar.

## 3. La barra de arriba (estilos + tempo) y el botón «demo»
- **Hoy:** cinco estilos en fila + el tempo (tocar 4 veces lo fija; mantener lo vuelve al del estilo) + «Cargar demo» en Ajustes.
- **Problema:** con 6 estilos la fila no cabe en un móvil, y **cambiar de estilo con una canción hecha** la deja sonando con otro bajo y otros acordes (confunde): el estilo es una decisión **de la canción**, no un interruptor suelto.
- **Propuesta:**
  1. **El estilo se elige al empezar** (al abrir un remix, o en «Nuevo remix» con la lista de estilos agrupada: *Urbano* (hip hop, dembow) y *Electrónica* (house, techno, minimal, dnb)) y en la barra queda **como etiqueta** con su tempo (`house · 124`), no como seis botones. Tocarla abre la lista, con un aviso si hay cosas hechas («cambia el bajo, los acordes y el tempo; tu ritmo y tu melodía se quedan»).
  2. **El tempo se queda** (tocar 4 veces = tempo fácil; es de lo más útil y es de toda la canción).
  3. **«Cargar demo» se quita como botón:** la demo de cada estilo pasa a ser **su remix principal de serie** (se abre desde «Mis remixes → De serie»). Una cosa menos que explicar (principio 8) y la demo deja de ser un ritmo suelto para ser algo que ya suena a canción. Mientras no haya remix de un estilo, «Nuevo remix» arranca con la demo de ritmo de ese estilo como hoy (sin botón).

## 4. Principios
1. Una pantalla, una cosa ✔ (el estilo se elige una vez, al empezar). 2. No puede sonar mal ✔ (cada estilo con su escala; el aviso al cambiar). 3. Inmediata ✔. 4. Tuyo ✔ (mi ritmo y mi melodía se conservan al cambiar de estilo). 5. Pocas cosas ✔ (de 5 botones a 1 etiqueta). 6. Compartir ✔ (el estilo va en el enlace como siempre). 7. Precedente: los «géneros» de GarageBand y Groovepad ✔. 8. Quitar antes de añadir ✔ (se quita «Cargar demo» y la fila de estilos; se añade un estilo y a cambio se separan dos que eran uno).

## 5. Fases
1. Diseñar **house / techno / minimal** de verdad (priors, plantillas, bajo, acordes, tempo, kit) y comprobar de oído que se distinguen en 4 compases. *(Necesita oído: sin probar hasta que lo escuches.)*
2. Etiqueta de estilo + lista agrupada; «Nuevo remix».
3. Quitar «Cargar demo».
4. Remixes principales que falten.

## 6. Preguntas abiertas
- ¿dnb dentro de «Electrónica» o aparte? (propongo dentro).
- ¿Un remix principal por estilo antes de quitar la demo, o se quita ya y «Nuevo remix» usa la demo de ritmo?
- ¿Minimal merece estar (6.º estilo) o basta con distinguir house y techno?
