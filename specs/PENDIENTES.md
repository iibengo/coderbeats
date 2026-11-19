# Lo pendiente, de todas las specs (2026-11-16)

Revisadas todas las specs, `PLAN-AUTONOMO.md`, `PLAN-AUTONOMO-2.md` y `ESTADO.md`. Ordenado por cuánto ayuda a que la app sea fácil y divertida para alguien nuevo. **✔ = hecho en la octava tanda.**

## A. Necesita tu oído, tu voz o un iPhone (preparado y apuntado; no se puede cerrar sin ti)
1. **Reconocer «ts» y «pff» en el iPhone** (001 §17.9): falta tu registro etiquetado (8 «ts», pausa, 8 «pff», pausa, 8 «bum», con los segundos). Es lo que más afecta al primer minuto. Mientras, ⋯ → «Calibrar mis sonidos» (ahora a manos libres, ~20 s).
2. **Sintetizador de dedo** (015 §12): ¿el deslizamiento entre notas suena bien? ¿se parece lo grabado a lo tocado? (el oscilador no es el sinte de Strudel; ver la spec).
3. **Producción** (014 §8–§9): el downlifter (`lpenv` negativo) y la apertura de filtro de Intro/Entra: ¿suenan o raros? Swing/matices en una canción conocida.
4. **«🎹 Agua»** (015 §10): comparar con el sintetizador de dedo y decidir si se quita.
5. **Voz** (007): cae en el compás, sin clic ni deriva tras un minuto; Bluetooth.
6. **Remixes** (008 §9, §12, §13): oír el drop de «Wow», el wowo de Dies Irae, el bombo 808, la fuga del bajo.
7. **Vídeo** (013): iOS/Safari (`captureStream`, mp4, compartir) y su rendimiento.
8. **Escenario y piloto** (011 §13, 009): sensación al tocar, latencia, el dedo fantasma.
9. **Agua viva** (015 §11): ¿va fluido en tu móvil? ¿se apaga sola si va lento?
10. **Latencia por defecto** de 50/180 ms (Bluetooth) y la «¿Te afino?» con voces distintas a la tuya.
11. **PWA** (octava tanda): «Añadir a pantalla de inicio» en el iPhone, el icono y abrirla sin conexión.
12. **Audio parado** (llamada, bloqueo): ▶ y volver a la app lo despiertan (probado solo suspendiendo el contexto en Chrome).

## B. Decisiones tuyas
- Publicar el repositorio (`specs/PUBLICAR.md`): correo de los commits, repositorio de GitHub, `iibengo/coderbeats-kits` v1, captura para el README, qué specs quedan públicas.
- ¿Quitar «🎹 Agua» si el sintetizador gusta más? ¿Producción encendida por defecto?
- 001 §14.1 ideas de la hoja de ruta sin decidir: swing/más estilos (spec 004 sin escribir), loop crudo tipo RC-505, 4.º sonido de boca, aprender de mis correcciones.
- **031 «Compases de verdad»** (3/4, 6/8): hoy el 3/4 se apaña con 12 pasos de música + 4 de silencio. Con una o dos canciones así, basta; con varias, merece la pena el campo de compás (toca el motor: hace falta oído).
- **030 «Pegar texto»**: ¿meter el conversor de notas dentro del Estudio (sin IA) y, más adelante, pegar Strudel? Es lo que ahorra salir a la terminal. Lo barato es la pestaña «Pegar notas».
- **021 «Remixes con una IA»**: la idea del chat está diseñada pero parada; sin servidor no hay clave segura, y una IA inventando notas se equivoca (17/11). Si se retoma, primero «Importar remix» en JSON (§3), sin red.

## C. Se puede hacer sin oído ni voz (pendiente; por si sigues)
| # | Qué | Por qué se dejó | Coste |
|---|---|---|---|
| 1 | **Fundir sin reiniciar la música** + animación y anillo azul (005 §21, 011) | toca el reloj del motor (`replaceSong`): arriesgado sin oído | medio |
| 2 | **Hat abierto cada 2 y cambio de nota del bajo cada 8** (014) | exige un campo nuevo en los golpes (formato guardado) y tocar el motor | medio |
| 3 | **Silencio antes de caer y platillo/impacto solo al caer el drop** (014) | un loop se repite cada vuelta; haría falta volumen por célula | medio |
| 4 | **Reglas de producción en los remixes** (014) | son datos fijos; habría que reescribirlos | bajo |
| 5 | **El piloto, solo en dembow** (009): falta techno/house/dnb/hip hop, colonia, melodía, órgano, remixes | trabajo de guion, sin riesgo | medio |
| 6 | **👁 de «Mis canciones» grabable en vídeo** (013) | sin tocar | bajo |
| 7 | **Sintetizador de dedo:** giro con dos dedos, 3D, enlace vivo con la reproductora, adjuntar por fundir (015 §12.5) | fase siguiente | alto |
| 8 | **Partir `useAudioEngine.ts` (~3 mil líneas) y `AroCanvas.ts`** | sin tests de integración, riesgo alto | alto |
| 9 | **Voz:** capas, detector de voz, recolección de audios, autotune (007) | a propósito (borrar por un recuento incompleto podría perder tomas) | alto |
| 10 | **Escenario:** disco en perspectiva, estela, encendido en el drop (011 §13) | solo estética | medio |
| 11 | **Vídeo:** fallback WebCodecs si no hay `MediaRecorder`, cámara deformada (013) | sin iPhone para probar | alto |
| 12 | **Sensibilidad ajustable** en ⋯ (003 E4) | no se ha visto que haga falta | bajo |
| 13 | **Mover y cambiar notas del bajo con la voz** (001 §14, 002) | idea anotada | alto |
| 14 | **Rendimiento por frame** (cachear en `AroCanvas`) | sin perfilar en un móvil real | medio |

## D. Hecho en la octava tanda (✔)
✔ «Acerca de» con la AGPL, el código fuente y los créditos · ✔ «Entrar sin micro» · ✔ célula de melodía + sintetizador de dedo (015 §12) · ✔ automatización de filtro y downlifter en Producción (014 §9) · ✔ «¿Te afino?» también con todo caja y calibrar a manos libres (001 §17.10) · ✔ botones avanzados escondidos durante el tutorial · ✔ preparación para publicar (`PUBLICAR.md`, README, script de copia limpia) · ✔ PWA instalable y sin conexión · ✔ el audio se despierta tras una llamada o el bloqueo.

## E. Ideas para más adelante (2026-11-19)
- **Exportar audio sin reproducir ni grabar** (idea de Ion, aparcada): botón «Guardar audio» que renderice la canción entera **offline** con `renderPatternAudio` de `@strudel/webaudio` 1.3.0 (ya está en `node_modules`; calcula el audio de golpe y da un WAV). Falta: spec corta, sacar el patrón del código de la canción, registrar las mismas muestras en el contexto offline, aplicar un limitador a mano (la cadena del motor —limitador, EQ, compresor— no entra) y, para MP3, decidir entre convertir con `ffmpeg` o añadir un codificador (`lamejs`; comprobar la licencia por la AGPL). Para comprobarlo: compararlo con la grabación en tiempo real (duración, tempo, nivel, secciones). **Sin comprobar** que suene igual de oído ni en un iPhone. Mientras tanto: `node tests/browser/exportar-audio.mjs` graba el audio de un remix en tiempo real (`.webm`) y se pasa a MP3 con `ffmpeg`.
