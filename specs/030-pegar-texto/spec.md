# Spec 030 · Pegar texto: Strudel y notas (idea para más adelante)

Estado: **idea apuntada, sin programar**. No toca nada de lo guardado. Complementa 021 («Importar remix» en JSON) y 028 (formato de canción).

## Por qué

Escribiendo canciones a mano (17/11/2026) quedó claro que:

- **Strudel es donde la música compleja ya funciona**: tresillos, acordes, dinámica, sin traducir nada.
- El conversor `notas-a-json.mjs` vive **fuera** del repo (`~/Descargas/coderbeats-herramientas`) y funciona, pero obliga a salir de la app, abrir una terminal y volver a importar.
- Las canciones de estos días salían a trozos por fallos de forma (compases que no suman, loops medio vacíos), no por falta de herramientas: hace falta que **algo lo compruebe al pegar**.

## 1. Pegar notas (el formato del conversor) — OPCIONAL
> **Opcional.** El formato `.txt` del conversor es una comodidad para quien escribe a mano (Ion, yo). Un usuario normal **no** escribe `Bb4:4 F4:4`: escribe o pide «una canción alegre de cumpleaños». Esto no es la base de nada; se puede hacer o no. Lo que **sí** tiene que existir, venga la música de donde venga, es el **chequeo de forma** (§3).

Un cuadro de texto en el Estudio («Pegar notas») que acepta el mismo formato que `notas-a-json.mjs` (ver `LEEME-escribir-canciones.md`):

- `nombre`, `estilo`, `tempo`, `kit`, `ritmo`, `parte:`, `melodia:`, `bajo:`, `acordes:`.
- notas `C4:4`, silencios `r:4`, tresillos de corchea `4/3`, **tresillo de negra** `[E4 F#4 G4]`, acordes `[G3,Bb3,D4]:16`, notas que cruzan el compás.
- Al pegar, se convierte **en el navegador** (la lógica del conversor pasa a `app/lib/pasteNotes.ts`, puro y con tests) y se enseña el resumen.
- **Avisos, no fallos** (las lecciones del 17/11): compás que se pasa de 16, compás vacío en medio, sección que no llega al final del loop. Se enseñan **antes** de aceptar, con el compás concreto.
- Solo se acepta si pasa el mismo validador que lo guardado (`isSavedSong`). Nada de eval.

## 2. Pegar Strudel (subconjunto seguro)

Idea: pegar un patrón de Strudel y quedarse con sus notas/golpes. **No se evalúa nada**: se *lee* el texto.

Subconjunto que tendría sentido, nada más:

- `note("…")` con la mini-notación de patrones: `c4 e4 g4`, `a@2`, `~`, `<a b>`, `[a b]`, `*2`, `(3,8)`.
- `s("bd ~ ~ sd")` con los nombres del motor (batería).
- `stack(…)` para varias líneas a la vez.
- `.slow(n)`, `.fast(n)`, `.gain(…)` (este último como dinámica por nota, 029 §2).

Lo que **no** se acepta: funciones, variables, `ref`, `.filterHaps`, `.duckorbit`, efectos, muestras propias, `arrange`. Si aparece algo fuera del subconjunto, se rechaza entero con el motivo (nunca se "ignora un trozo" en silencio).

### Mapeo

- 1 ciclo de Strudel = 1 compás (16 pasos). `.slow(2)` = loop de 2 compases; `.fast(2)` = la mitad de compás (se rechaza si no cae en la rejilla).
- `a*2` = dos corcheas; `(3,8)` = tresillo dentro de la mitad del ciclo (doceavos).
- Cada llamada `note(...)` = un loop de melodía; cada `s(...)` con batería = un loop de batería.
- Los compases que no están escritos **se avisan**: son silencio (lo que hacía sonar las canciones a trozos).

### Seguridad (importante)

Pegar Strudel **choca** con la regla «datos, nunca código». Por eso: **lector de patrones escrito a mano**, con un tokenizador cerrado (números, letras de nota, `~`, `[ ] < > * @ ( )`), sin `eval`, sin `Function`, sin `new`. Tests de inyección: `); alert(1); (`, `${…}`, `</script>`, texto de 10 MB, anidado profundo, patrones con 500 notas. Todo lo que llegue a un generador de código debe ser **un número o un nombre de nota sacado de una tabla**.

## 3. Pantalla

Un solo botón «Pegar» en el Estudio, con dos pestañas (Notas · Strudel). Al pegar: resumen + avisos + «Añadir a Mis canciones». Nunca sustituye lo que hay (como «Importar»: solo añade). Todo en «Avanzado» (principio 5).

## 4. Principios

1. Una pantalla, una cosa ✔ (pegar texto, ver el resumen, aceptar).
2. No puede sonar mal: los avisos de forma lo enseñan antes de aceptar; las notas fuera de escala se pueden ajustar.
3. Inmediata: el resumen sale al pegar, sin pulsar nada.
4. Tuyo: traes tu música de donde sea.
5. Pocas cosas: un botón y dos pestañas, en «Avanzado».
6. Compartir: el texto se pega en un mensaje; la canción se comparte como siempre.
7. Precedente: pegar un patrón en un secuenciador, pegar una receta.
8. Quitar antes de añadir: ⚠ añade una pantalla; compensa que sustituye a salir a la terminal.

## 5. Riesgos y qué falta decidir

- Leer Strudel es un **intérprete pequeño**: si no se hace con cuidado, es el sitio donde puede colarse código. Riesgo alto → subconjunto mínimo y tests de inyección.
- ¿Se acepta `.gain` como dinámica? (Propongo que sí, 029 §2.)
- ¿Qué se hace con dos `note(...)` en el mismo `stack`: melodía y contramelodía? (Propongo: dos loops de melodía, hasta 3.)
- **No resuelve el problema de las notas**: si el patrón pegado no es el tema, la app no lo sabe. Sigue haciendo falta escuchar y, antes de escribir, buscar referencias.
- **El formato `.txt` es secundario.** No es lo que usará la gente. Si algún día se acepta texto libre o una frase («una canción alegre de cumpleaños»), el camino natural es 021 (§1, con IA): el texto libre lo convierte algo externo y lo que llega a la app son **datos** que pasan por el chequeo. La app no escribe música por sí sola.
- **El chequeo de forma va primero** (y sirve para todo): compás que se pasa, compás vacío en medio, sección que no llega al final del loop. Es lo que hacía sonar las canciones a trozos.
- **Corregir y que aprenda** (principio 4, «lo corriges y la app aprende»): el usuario arregla una melodía o un tema y la app **guarda la diferencia** para la próxima. Solo en su navegador; nunca se sube. Tres decisiones antes de empezar: (a) qué se aprende — mejor el **sesgo** («cuando propongo X, lo cambias a Y») que cada nota suelta; (b) **siempre se puede volver atrás** y una sugerencia aprendida nunca sustituye a la que hay sin avisar; (c) el aprendizaje **no se comparte** (ni en enlaces ni en vídeos). Aviso honesto: la app no sabe si una melodía es buena, solo se acerca a lo que corregiste; es una ayuda, no un oído.

## 6. Relación con otras specs

- **021**: «Importar remix» en JSON (`coderbeats-remix`). Esta spec es el otro extremo: texto de músico, no JSON de IA.
- **028**: el formato de canción y el conversor.
- **029**: tresillos de negra y dinámica por nota (lo que hace falta para que un patrón de Strudel se lea sin perder nada).

## 7. Fases (cuando se decida)

0. **El chequeo de forma** (`checkSongShape`, puro, con tests): compás que se pasa, compás vacío en medio, sección que no llega al final. Sirve para todo lo que entre, hoy y mañana.
1. Lector de Strudel (subconjunto de §2) + tests de inyección. **Es lo que de verdad usa un músico.**
2. Pestaña «Pegar Strudel» en «Avanzado».
3. *Opcional:* `pasteNotes.ts` (el formato `.txt` del conversor dentro de la app). Barato, pero no es la prioridad: casi nadie escribe notas a mano.

Si un día se quiere «escribo una frase y sale una canción», eso es 021 §1 (con IA, y el resultado siempre pasa por el chequeo).
