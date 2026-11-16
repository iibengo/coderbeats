# Spec 018 · Canciones completas en el Laboratorio

Estado: en curso. Depende de 017 (Laboratorio) y reutiliza el motor tal cual (`toggleLive`, `convertSong`, exportar vídeo). Nada nuevo en el Estudio.

## 1. Qué es
Que lo que toco en el Laboratorio se acumule y acabe siendo una canción con estructura, sin salir de Capas.

1. **Mis capas.** Círculo de ritmo guarda solo lo que dibujo como «mi batería». Piano mágico y Coro guardan lo último que toqué (4 compases, cuantizado a semicorcheas) como «mi melodía». En Capas aparecen como dos botones más, junto a la base del estilo (los círculos solo existen si hay algo).
2. **● Grabar** (Capas). Enciendo y apago capas en directo; el motor apunta por compás qué suena y lo convierte en partes (Intro, Subida, Drop…): es `toggleLive` («componer en directo»).
3. **✦ Hazme una canción** (Capas). Enciende todas mis capas y monta la estructura de la plantilla del estilo: es `convertSong` («Convertir en canción»). Después puedo **↻ regrabarla actuando**.
4. **Al terminar:** «▶ Escuchar mi canción» (entera, desde el principio) y «🎬 Mi vídeo» (grabación del escenario con el audio, para compartir). Sin células a la vista: se habla de «partes» y de «mi canción».

## 2. Cómo cumple PRINCIPIOS.md
1. **Una pantalla, una cosa:** la canción se hace solo en Capas; cada instrumento sigue haciendo lo suyo (el guardado es automático, sin botón). ✔
2. **No puede sonar mal:** capas ya hechas en la escala/estilo; la estructura viene de la plantilla del estilo; grabar solo apunta qué capas suenan. ✔
3. **Respuesta inmediata:** encender/apagar sigue siendo al compás como hasta ahora; nada espera a que termine una grabación. ✔
4. **Se siente mío:** la batería y la melodía son las mías, y puedo regrabar actuando. ✔
5. **Pocas cosas a la vez:** los círculos de mis capas aparecen solo si existen; los botones de canción aparecen según el momento (grabando → «■ Terminar»; hecha → escuchar / regrabar / vídeo). ⚠ hasta 8 círculos + 2 botones: el límite. Se comprueba en el móvil.
6. **Fácil de compartir:** «🎬 Mi vídeo» (descarga o hoja de compartir). ✔ (enlace con estado: sigue pendiente, no se promete aquí).
7. **Precedente:** Incredibox (grabar el directo), Groovepad. ✔
8. **Quitar antes de añadir:** no hay pantallas nuevas ni ajustes; se reutiliza el motor tal cual. ✔

## 3. Decisiones
- Persistencia en una clave nueva `coderbeats:lab:v1` (si no se puede leer o escribir, todo sigue funcionando en memoria). No se toca `coderbeats:ui:v1` ni nada del Estudio.
- Grabar necesita sonando y ≥2 capas con golpes (regla del motor); «Hazme una canción» necesita un ritmo.
- El vídeo es del escenario del Laboratorio (aguja y círculos), no del agua del Estudio.

## 4. Sin probar
Todo de oído y en iPhone. En Chrome: lógica, botones y flujo con guion.
