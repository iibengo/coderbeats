# Spec 020 · El Estudio como editor de remixes

Estado: **propuesta, sin programar**. Etiqueta del estado de partida: `estudio-v2`. Depende de 019 (Remixes en el Laboratorio) y reutiliza `melodyEdit.ts`, `tapMelody.ts`, `variations.ts`, la biblioteca (`library.ts`) y el enlace (`shareLink.ts`).

## Ajuste (2026-11-16): un remix, dos caras
- **Un remix es un único objeto (la canción) con dos caras:** Laboratorio = **actuarlo**; Estudio = **crearlo y editarlo**. Las mismas partes en los dos lados (**máximo 8**), sin versiones distintas: lo que se edita en el Estudio se ve tal cual en Remixes del Laboratorio (`partsFromSong`, spec 019 §1b).
- **Versión principal = la de ≈ 1 min** (la simplificada de 019); la larga de 4 min queda como **archivo** (no se borra, se abre desde «Archivo»).
- **La melodía no lleva editor nuevo: se mejora el Órgano que ya existe** (`MelodyOrgan.vue`) con lo de §1 (solo notas de la escala, casillas grandes, un compás a la vez en bucle, grabar con el dedo a media velocidad, «↻ responder», una melodía por parte). ⚠ **Aclaración honesta:** las fases 2–4 ya estaban hechas como pantalla aparte (`MelodyEditor.vue`, botón ♪; commits `821a52d`, `fe27afa`, `b928e61`) antes de este ajuste. **Hecho:** se portó al Órgano (casillas de corchea, ● grabar, ↻ responder; `melodyGrid.ts` y sus tests se reutilizan) y se **quitó ♪ y `MelodyEditor.vue`**, sin dejar dos editores. Pendiente en el Órgano: «una melodía por parte» (fase 5).
- Máximo 8 partes y ≤ 4 capas por parte también al editar (el Estudio avisa al pasarse; no borra nada).

## 0. Por qué
El Estudio creció hasta ser «todo». Su trabajo pasa a ser uno: **crear y editar remixes al 100 %**. Lo que más duele es la melodía: crearla es difícil porque se apilan melodías en la célula y el reloj va rápido. Los principios de `PRINCIPIOS.md` valen como inspiración, **sin ser tan estrictos** (el Estudio puede tener más de una cosa en pantalla, pero cada pantalla debe seguir teniendo un trabajo claro).

## 1. Editor de melodía (tipo Song Maker de Google)
**Se hace en el Órgano existente** (ver el ajuste de arriba), que se abre desde una parte del remix y vuelve a ella.

- **Cuadrícula:** filas = solo las notas de la escala del estilo (`scaleNotes`; 8–9 filas: una octava y un poco más; arriba agudas); columnas = **corcheas** (8 por compás). Muestra **un compás a la vez** con las casillas grandes (≥ 40 px: 8 × 8 en un móvil de 380 px), con ◀ ▶ para pasar de compás; la aguja recorre los dos. Se puede pasar a semicorcheas con «fino» (16 columnas, casillas más pequeñas) — escondido, para quien lo pida.
- **Largo:** 1 o 2 compases (botón), y «↻ responder» lo lleva a 4 (§1.3). Es el `loop` de melodía de 1/2/4 compases que ya existe (`setMelBars`).
- **Suena en bucle mientras edito:** el compás (o los 2) suena sobre la base de la parte; cada casilla que toco suena al instante (`previewNote`), y la melodía editada se oye en el siguiente paso de la aguja, no en el siguiente compás.
- **Imposible sonar mal:** solo hay notas de la escala; la casilla tocada se alinea a la columna; una nota por columna (monofónica, como Song Maker); arrastrar horizontalmente alarga la nota.

### 1.1 Dos formas de rellenarla
1. **Tocar casillas** (la de arriba).
2. **Grabar con el dedo, a media velocidad** (tipo Piano mágico / GarageBand): «● Grabar» baja el tempo a la mitad (el bucle suena más lento solo mientras grabo; al terminar se restablece, sin tocar `bpm` guardado), muestra una cuenta atrás de 1 compás, y cada toque o arrastre apunta la altura (la fila bajo el dedo, ya en la escala) y el instante. Al terminar, se **cuadra** a la columna más cercana de la cuadrícula (reutiliza `softQuantize` / `TapTake`) y se escala a velocidad normal. Se puede repetir sobre lo que hay (sustituye) o «+ sumar» (mantiene lo grabado antes en las columnas no tocadas).

### 1.2 Una sola melodía por parte
En el editor de remixes **cada parte tiene una melodía** (una capa «tema»; ya es la regla de 019). No se apilan. Lo que ya existe con varias melodías (canciones de antes) se abre sin perder nada: la primera es «el tema» y las demás se muestran como «melodías extra (ocultas)», que se conservan y se pueden quitar a mano, pero el editor no las toca.

### 1.3 «↻ responder» (pregunta-respuesta)
Con una frase de 2 compases, «↻ responder» **copia la frase a los 2 compases siguientes con una variación** y deja un loop de 4: la respuesta mantiene el ritmo, cambia las notas finales hacia la tónica (cierra la frase) y, si se pulsa otra vez, ofrece otra variación (secuencia fija, sin azar, como ya hacen las variaciones). Reutiliza `variations.ts` (`melody`) y `melodyAssist.ts`; la lógica nueva es solo «cerrar en la tónica» (puro, con tests).

### 1.4 Deshacer
Todo cambio del editor entra en el historial del Estudio (`setUndo`): «↶ deshacer» y «↷ rehacer» a la vista.

## 1b. Batería de cada parte
Misma idea que la melodía: **una pantalla «Batería»** por parte, con **dos formas de rellenarla** y **el micro nunca obligatorio**.

1. **Tocando** (la forma por defecto, sin permisos): el **Círculo de ritmo** del Laboratorio (tres anillos bombo/caja/platillo, con «ruedas» y «exacto») o una **cuadrícula** de 3 filas × 16 columnas (casillas grandes, un compás; ◀ ▶ si el patrón es de 4). Un interruptor elige cuál ver; se guarda el último. Suena en bucle con la base mientras edito y cada casilla toca su golpe al instante. Reutiliza `lab.ts` (`toggleStep`, `wheelSteps`) y los componentes `LabCirculo`.
2. **Grabando con la boca (🎤, opcional):** el beatbox de siempre (el clasificador de golpes del micro: bombo, caja, platillo) apunta lo que cantas durante 1–2 compases con cuenta atrás y se **cuadra** a la rejilla de 16 pasos. El botón 🎤 solo aparece si hay micro disponible; si no se concede el permiso o no se quiere, **todo lo demás funciona igual** (no se pide permiso hasta que se pulsa 🎤, nunca al abrir la pantalla). Los cuadros de calibración y de latencia siguen siendo los del Estudio, escondidos tras el primer uso.
3. **Lo grabado se corrige tocando:** al terminar la toma, el resultado **se ve en el círculo / la cuadrícula** y se puede quitar o poner golpes con un toque, como si lo hubiera tocado a mano (es el mismo patrón, no hay «modo grabado»). Un golpe mal clasificado (la caja que salió bombo) se corrige quitándolo en una fila y poniéndolo en otra; «↶» deshace la toma entera.
4. **Una batería por parte**, tres instrumentos (bombo, caja, platillo), 1 compás que se repite (o 4 con «largo»); es la capa «ritmo» de 019 (en la Subida, sin bombo por defecto, y se avisa si se pone uno).

## 2. Remixes ↔ Estudio
- En **Remixes** (Laboratorio) de una canción aparece «Abrir en el Estudio»: crea **una copia en Mis canciones** (`addSong`, id nuevo, nombre «Mi <título>») a partir de mi versión (o del remix original, si no hay) y la abre en el Estudio. El original nunca se toca.
- **Vuelve como mío:** lo editado en el Estudio y guardado (con «guardar cambios») aparece en la lista de Remixes como «mío». Para que lo reconozca: una marca opcional `lab: { remixId }` dentro de la canción guardada (campo extra opcional; versiones anteriores lo ignoran; `parseLibrary` ya conserva lo que no entiende). Se convierte de nuevo a partes (`labRemixFromSong`, puro): cada célula con nombre Intro / Subida / Drop / Final es una parte; sus loops se agrupan en las capas de 019 (bombo, caja, platillo → «ritmo»; melodía → «tema»; bajo; acordes); si una parte tiene más de 4 capas o más de una melodía, **se muestran solo las primeras 4 y no se borra nada** (se avisa en el Estudio).
- **Datos guardados:** el camino se limita a leer y a **añadir** entradas a Mis canciones; nunca reescribe ni borra una existente (la regla de siempre: leer nunca borra).

## 3. Un Estudio centrado en crear y editar remixes
Se mide contra tres cosas: **partes · capas · melodía · duración (≈ 1–2 min)**.

**Queda (lo central, a la vista):**
- Las **partes** del remix (Intro, Subida, Drop, Final y las que se añadan), en orden, con sus compases (la duración total a la vista: «1:12»), añadir / quitar / duplicar / mover una parte.
- Las **capas** de cada parte (≤ 4 por defecto): bombo, caja, platillo, bajo, acordes, tema; encender/apagar y editar el ritmo en el Círculo.
- La **melodía** (el editor de §1).
- Reproducir la canción entera, la parte en bucle, **Mis canciones** (guardar / abrir) y **vídeo** (la canción entera, ≤ 2 min).
- Estilo y kit.

**Se esconde (en «Avanzado», nada se borra, sigue funcionando):**
- Filtro por vuelta, «wowo», efectos por célula; grupos en paralelo; más de 4 capas; melodía sugerida y asistentes; modo «Jugar» con micro como pantalla (pasa a ser el 🎤 de la Batería; calibración tras el primer uso); órgano de melodía antiguo; tempo; el código Strudel (ver/copiar); piloto «Ver cómo se construye»; remixes del Estudio de 4 min como punto de partida.

**Sobra (a decidir contigo; propongo quitar de la interfaz y mantener el código mientras haya datos que dependan de él):**
- La portada 016 (`/estudio?portada`), el modo simple y su ajuste (ya lo cubre el Laboratorio), la guía del primer minuto y el tutorial (se rehacen para el editor), el mapa 3D de células (pasa a una lista de partes) y el aro/agua como interfaz principal (queda como visual del vídeo y de la reproducción).
- **No sobra:** el micro como forma de grabar ritmo y voz: queda como **opción 🎤** dentro de la pantalla de Batería (§1b) y nunca es obligatorio; la voz (pista de voz) queda en «Avanzado».

**Regla de datos:** `coderbeats:ui:v1` y la biblioteca se siguen leyendo igual; las preferencias de lo que se esconde van en una clave nueva (`coderbeats:studio:v2`), y su ausencia significa «lo de siempre».

## 4. Fases (cada una un commit, con tests + typecheck + build)
0. (hecho) Remixes del Laboratorio con N partes desde la canción (`partsFromSong`).
1. «Abrir en el Estudio» (copia en Mis canciones; las partes ya salen de la canción, no hace falta conversión de vuelta aparte).
2. Órgano mejorado: cuadrícula y sonido en bucle (tocar casillas). (La primera versión, `MelodyEditor.vue`, está hecha; falta portarla al Órgano.)
3. «● Grabar» a media velocidad y cuadrar.
3b. Batería de la parte: Círculo / cuadrícula (tocar) y 🎤 opcional (cuadrar y corregir tocando).
4. «↻ responder».
5. Una melodía por parte (con la migración de extras ocultos).
6. Estudio simplificado: lo que se esconde y «Avanzado».
7. Duración a la vista y vídeo de la canción entera de ≤ 2 min.

## 5. Principios (versión relajada)
1. **Una pantalla, una cosa:** el editor de melodía solo edita melodía; la lista de partes solo ordena partes. ✔
2. **No puede sonar mal:** escala bloqueada, cuadrícula, cierre en la tónica. ✔
3. **Respuesta inmediata:** la nota suena al tocar; lo editado, en el siguiente paso de la aguja. ✔
4. **Se siente mío:** todo se guarda en Mis canciones y vuelve a Remixes como mío. ✔
5. **Pocas cosas a la vez:** ⚠ el Estudio sigue teniendo más cosas que el Laboratorio; se esconden las avanzadas. Se acepta (el Estudio es el sitio del 100 %).
6. **Fácil de compartir:** enlace (ya existe) y vídeo ≤ 2 min. ✔
7. **Precedente:** Song Maker (Chrome Music Lab), GarageBand (grabar con el dedo), Incredibox. ✔
8. **Quitar antes de añadir:** §3. ✔

## 6. Riesgos y preguntas abiertas
- **Beatbox sin probar de oído** (como siempre): la clasificación depende de la voz y del micro; por eso el patrón grabado es corregible y el 🎤 es opcional. En iPhone, el permiso del micro solo se pide al pulsar 🎤.
- **Principio 5 (batería):** dos vistas del mismo patrón (círculo y cuadrícula) es una cosa más: se propone enseñar **una** (el círculo, ya conocido) y ofrecer la cuadrícula en «Avanzado» si la prefieres; decide tú.
- **Grabar a media velocidad** cambia el tempo del motor un rato: sin probar de oído; si molesta, alternativa = tempo normal con «cuenta de guía» y cuadrado más generoso (quantize a corcheas).
- **Conversión de vuelta** (canción → partes): si lo editado en el Estudio rompe el patrón de 4 partes, el remix «mío» no aparece en Remixes (aparece en Mis canciones). Para aceptar: ¿un remix con 6 partes (Intro, Subida, Drop, Subida 2, Drop 2, Final)? Propongo **máximo 8 partes** y botones por parte con desplazamiento.
- **¿Una melodía por parte con 4 compases** (la respuesta) o 1–2? Propuesta: 2 compases de pregunta + 2 de respuesta = 4, y es lo que suena en bucle.
- **¿Quito de la interfaz lo que «sobra» o solo lo escondo?** Propongo esconder en esta tanda y quitar tras tu prueba.
- Tiempo: unas 7 tandas; la 2 y la 3 son lo que más se nota.
