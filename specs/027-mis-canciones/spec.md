# Spec 027 · Mis canciones: lo privado de cada persona (corta)

## 1. Vocabulario
- **Remixes** = los **de coderbeats** (dominio público u originales, **en el repo**, los mantiene Ion): «De serie» + «Archivo».
- **Mis canciones** = todo lo que **crea o importa cada persona**. **Privado, en su navegador** (`coderbeats:library:v1`); nunca en el repo, ni en la build, ni en un servidor.
- Se ajustan los textos del Laboratorio y del Estudio (es/en/eu). Los datos y las claves **no cambian** (lo guardado sigue igual).

## 2. Qué se añade
1. **«+ Nueva canción»** en el Estudio: desde cero, **eligiendo estilo y tempo** (por defecto, el del estilo), además de editar una copia de un remix.
2. **Exportar una canción a `.json`** y **importar desde archivo o texto pegado** (con el validador de siempre: solo datos, nunca código; también acepta un enlace `#c=…`).
3. **Compartir por enlace también desde el Laboratorio** (Remixes).
4. **«Exportar todo» / «Importar copia»**: copia de seguridad de toda la lista en un `.json`. Importar **solo añade** (nunca reescribe ni borra lo que ya hay).
5. **Mis canciones se tocan en el Laboratorio igual que un remix** (ya sucede: sus partes salen de la canción).

## 3. Formato del archivo (versión 1)
- **Una canción:** el mismo objeto que lleva un enlace (`{v:1, n, s, k, b, f, g}`), en un archivo `.json` UTF-8.
- **Copia de seguridad:** `{ "formato": "coderbeats-copia", "version": 1, "canciones": [ <objeto de una canción>… ] }`, como mucho 500 canciones y 20 MB.
- **Validación:** cada canción pasa por `isSavedSong` (la de lo guardado y los enlaces). Lo inválido **se descarta con un aviso**, nunca se «arregla». Los nombres pasan por `cleanName`. Se leen como **texto**; nada se evalúa. Tope por archivo y por canción.

## 4. Privacidad (CLAUDE.md)
Nada se sube. Un archivo lo elige la persona y se lee en su navegador; un enlace `#c=` no llega al servidor. Importar nunca crea una petición de red. La web y el repo no contienen canciones de usuarios.

## 5. Cumple PRINCIPIOS.md
1. Una pantalla, una cosa: «Mis canciones» es una lista; importar/exportar viven en un cajón «⋯», no en la lista. ✔ 2. No puede sonar mal: lo importado pasa el validador. ✔ 3. Respuesta inmediata ✔. 4. Se siente tuyo: es privado y tuyo; «+ Nueva canción» empieza en blanco. ✔ 5. Pocas cosas a la vez: ⚠ la hoja gana botones; se esconden en «⋯». 6. Compartir fácil: enlace desde el Estudio y el Laboratorio, archivo y vídeo. ✔ 7. Precedente: «guardar/abrir archivo» de cualquier editor; exportar copia de seguridad. ✔ 8. Quitar antes de añadir: se quita el nombre «Mis remixes» y la separación «mío/de serie» confusa. ✔

## 6. Fases (un commit cada una)
1. Vocabulario (textos es/en/eu). 2. «+ Nueva canción». 3. Exportar e importar un archivo o texto. 4. Enlace desde el Laboratorio. 5. Exportar todo / importar copia.

## 7. Decisiones a revisar
- «Nueva canción» abre una **parte vacía** con el estilo y el tempo elegidos (no carga la demo).
- Al importar una copia, las canciones con el **mismo nombre y el mismo contenido** que ya existen se **omiten** (no se duplican); las demás se **añaden con id nuevo**.
