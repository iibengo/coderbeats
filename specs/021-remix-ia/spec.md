# Spec 021 · Remixes con una IA (idea para más adelante) e «Importar remix»

Estado: **idea apuntada + primer paso diseñado, sin programar**. Depende de 019 (partes y capas del Laboratorio) y de 020 (Estudio editor). Nada de esto toca lo guardado.

## 1. La idea grande: pedirle un remix a una IA en un chat
«Remix techno del Himno que suba poco a poco» → la IA devuelve una canción → **es un punto de partida**: yo la actúo en Remixes y la edito en el Estudio. Nunca es un resultado final ni suena sola.

### 1.1 Problemas a resolver
1. **Sin backend no se puede meter una clave de IA en la web** (cualquiera la leería en el navegador). Opciones:
   - **A. Clave propia del usuario** (BYOK): la pega en Ajustes, se guarda solo en su navegador (`coderbeats:ai:v1`, nunca en enlaces ni en vídeos) y la llamada va directa del navegador al proveedor. Coste y control: del usuario. Riesgo: una clave en `localStorage` la puede leer cualquier script de la página (por eso: sin scripts de terceros; CSP estricta; opción «no guardar, pedirla cada vez»). Sin servidor propio.
   - **B. Servidor intermedio** (una función con la clave en secreto). Coste: lo paga quien lo aloja. Hay que protegerlo: tope de gasto diario global y por IP/dispositivo, límite de tamaño de entrada y de salida, sin historial largo, cuota por usuario (si hay cuenta), captcha o prueba de trabajo, y apagar con un interruptor. Más infraestructura y más responsabilidad (datos, abusos).
   - **C. Sin IA integrada:** «Importar remix» (§3) y que el usuario use la IA que quiera por fuera. **Recomendado como primer paso.**
2. **Solo melodías de dominio público.** La app no puede comprobar derechos de una melodía arbitraria. Diseño: la IA **no inventa notas de una obra**; elige de un **catálogo cerrado** de temas verificados (los que ya están en la app: Himno de la alegría, Dies Irae, Sinfonía 40, la biblioteca de `tuneLibrary`…, cada uno con su atribución y su razón de dominio público) y solo decide el **arreglo** (estilo, partes, capas, curva de energía, duración). Un tema propio escrito a mano o por la IA entra con la marca «tema propio (lo declaras tú)» y aviso; no se promete que sea de dominio público.
3. **El resultado es un punto de partida:** siempre pasa por el mismo validador y el mismo conversor que «Importar», cae en **Remixes** como un remix más (≤ 4 capas, 4 partes, ≈ 1 min), y se edita en el Estudio.
4. **Seguridad de lo que llega:** la respuesta de una IA es **texto no fiable** (puede venir de una web hostil o ser una inyección de prompt). Solo se aceptan **datos** (JSON del formato de §3), **nunca código**: no se evalúa nada, no se pasa a Strudel como texto, no se muestra HTML.

## 2. Qué se decide ahora
Nada de red por ahora. Se hace §3 (importar pegando texto) y se deja la opción A o B para cuando se quiera; el formato de §3 es lo que la IA integrada tendría que devolver, así que no se pierde trabajo.

## 3. «Importar remix» (primer paso, sin servidor)
En Remixes del Laboratorio, botón pequeño «Importar» (junto a «otra canción»): se pega el texto, se valida, se enseña un resumen («Techno · Do menor · 4 partes · 1:04 · tema: Himno de la alegría (sin verificar)») y se pide confirmar. Entra como remix «importado» en Remixes (guardado en una clave nueva, `coderbeats:lab:import:v1`; nunca en Mis canciones sin que lo pidas con «Abrir en el Estudio»).

### 3.1 Formato `coderbeats-remix` versión 1
Un único objeto JSON (texto plano, UTF-8, **máx. 16 KB**). Los nombres de las claves van en español.

```json
{
  "formato": "coderbeats-remix",
  "version": 1,
  "titulo": "Himno de la alegría (techno)",
  "estilo": "techno",
  "kit": "electro",
  "tema": { "nombre": "Himno de la alegría", "autor": "Beethoven", "dominioPublico": true, "fuente": "Oda a la alegría, 9.ª sinfonía (1824)" },
  "partes": [
    { "nombre": "Intro", "compases": 8, "capas": [
        { "tipo": "bombo", "patron": "x...x...x...x..." },
        { "tipo": "bajo" },
        { "tipo": "tema", "notas": [[0, 4, "F#4"], [4, 4, "F#4"], [8, 4, "G4"], [12, 4, "A4"]] }
    ] },
    { "nombre": "Subida", "compases": 4, "capas": [
        { "tipo": "caja", "patron": "xxxxxxxxxxxxxxxx" },
        { "tipo": "subida" },
        { "tipo": "tema", "notas": [[0, 2, "E4"], [2, 2, "F#4"]] }
    ] },
    { "nombre": "Drop", "compases": 16, "capas": [
        { "tipo": "ritmo", "bombo": "x...x...x...x...", "caja": "....x.......x...", "platillo": "xxxxxxxxxxxxxxxx" },
        { "tipo": "bajo" }, { "tipo": "acordes" },
        { "tipo": "tema", "notas": [[0, 4, "F#5"], [4, 4, "F#5"], [8, 4, "G5"], [12, 4, "A5"]] }
    ] },
    { "nombre": "Final", "compases": 4, "capas": [ { "tipo": "acordes" }, { "tipo": "tema", "notas": [[0, 8, "D4"]] } ] }
  ]
}
```

**Reglas** (todas se comprueban; una que falle rechaza el texto entero, con el motivo en español):
- Claves **exactamente** las listadas (sin claves de más: `__proto__`, `constructor`, `prototype` o cualquier otra no prevista se rechazan). Sin duplicadas.
- `estilo` ∈ {`hiphop90`, `house`, `dnb`, `dembow`, `techno`}; `kit` ∈ los kits conocidos (opcional: el del estilo).
- `titulo`: texto de 1 a 60 caracteres, sin etiquetas (`<`, `>`) ni saltos de línea (pasa por `cleanName`).
- `tema`: `nombre`, `autor` y `fuente` de texto (≤ 80 caracteres cada uno); `dominioPublico`: `true`/`false` (lo declara quien lo genera; la app solo lo muestra, **no lo verifica**); si el `nombre` coincide con un tema del catálogo de la app, se marca «verificado»; si no, «sin verificar».
- `partes`: de 3 a 8, `nombre` ∈ {`Intro`, `Subida`, `Drop`, `Final`, `Break`, `Subida 2`, `Drop 2`, `Salida`} (se muestran como se llaman); `compases` ∈ {1, 2, 4, 8, 16, 32}; la suma de compases dura entre 30 s y 2 min al tempo del estilo.
- `capas` de cada parte: de 1 a 4, con `tipo` ∈ {`ritmo`, `bombo`, `caja`, `platillo`, `bajo`, `acordes`, `subida`, `tema`}; no se repite el mismo tipo en una parte; como mucho **un** `tema` por parte; `bombo`/`caja`/`platillo` llevan `patron` (16 caracteres `x` o `.`, un compás, o 64 para 4 compases); `ritmo` lleva `bombo`/`caja`/`platillo` (al menos uno) con el mismo formato; `bajo`, `acordes` y `subida` no llevan nada más (el bajo y los acordes los pone el estilo).
- `tema.notas` (solo en `tipo: "tema"`): de 2 a 64 notas `[paso, duración, "nombre"]`: `paso` entero 0–63 (semicorcheas, 4 compases; 16 = el compás siguiente), `duración` entero 1–16, nombre en notación inglesa `[A-G]` + `#` o `b` opcional + octava 2–6 (p. ej. `"F#4"`, `"Bb3"`). Las notas que no estén en la escala del estilo se **ajustan a la más cercana** (no puede sonar mal); dos notas en el mismo paso: gana la última.
- Todo número es entero y finito; todo texto es `string` con longitud acotada; profundidad máxima 6; arrays acotados; sin `null` salvo donde se diga.
- No se aceptan archivos de más de 16 KB ni más de 8 partes.

### 3.2 Texto para pedírselo a una IA externa (se muestra en «Importar»)
> Eres un arreglista de música electrónica. Devuelve **solo un objeto JSON** (sin explicaciones, sin Markdown) con el formato `coderbeats-remix` versión 1 que sigue. Usa **solo melodías de dominio público**. Estructura: Intro (8 compases), Subida (4), Drop (16), Final (4). Máximo 4 capas por parte. La Subida **sin bombo**; el Drop **con todo** (ritmo con bombo, caja y platillo, bajo, acordes y tema). El tema debe reconocerse en sus primeros 4 compases. Pasos: 16 por compás; en `tema.notas`, `paso` va de 0 a 63. [aquí se pega el formato de §3.1 y el petición del usuario: «remix techno del Himno que suba poco a poco»]

### 3.3 Qué hace al importar
`parseRemixText(text)` → `{ ok: true, remix: LabRemix, resumen } | { ok: false, motivo }` (puro, en `app/lib/importRemix.ts`): 1. `text.length` ≤ 16 KB antes de parsear; 2. `JSON.parse` en un `try`; 3. validador estricto (con `Object.hasOwn`, sin `in`, sin confiar en prototipos); 4. construye `LabRemix` copiando **solo campos conocidos** a objetos nuevos (nada del objeto recibido sobrevive); 5. aplica las reglas de 019 (≤ 4 capas, la Subida sin bombo se **avisa** pero no se corrige; la duración se comprueba).

### 3.4 Tests (`tests/unit/importRemix.test.ts`)
- Casos buenos: el ejemplo de §3.1 y uno por estilo.
- **Inyección y hostilidad:** `__proto__`, `constructor`, `prototype` como claves; claves duplicadas; `titulo` con `<script>`, `javascript:`, comillas y saltos de línea; nombres con `"` y `` ` ``, `${...}` y `);` (para que nada llegue a Strudel como texto); `patron` con caracteres de más o de menos; números `NaN`, `Infinity`, `1e999`, negativos y decimales; arrays enormes; anidado a profundidad 1000; texto de 10 MB; tipos cambiados (número donde va texto y al revés); claves de más; JSON con comentarios o final cortado; Unicode raro (RTL, ceros de ancho, 4 bytes); mismo `tipo` repetido; 5 capas; 9 partes; duración fuera de rango.
- Propiedad: **para cualquier entrada aleatoria** (fuzz con semilla), `parseRemixText` no lanza y, si da `ok`, el `LabRemix` pasa las reglas de 019 y no contiene ninguna cadena que no sea de las listas conocidas ni el título limpio.
- **Ningún texto de la entrada llega a un generador de código:** test que construye la canción y comprueba que el código Strudel generado solo contiene números y las palabras del motor.

## 4. Principios
1. **Una pantalla, una cosa:** «Importar» es un cuadro de texto, un resumen y «Añadir». ✔
2. **No puede sonar mal:** notas ajustadas a la escala; parte vacía no se acepta. ✔
3. **Respuesta inmediata:** se valida al pegar (el resumen aparece sin pulsar nada). ✔
4. **Se siente mío:** el remix importado se actúa y se edita como cualquier otro. ✔
5. **Pocas cosas a la vez:** un botón pequeño que se esconde si no se usa. ✔
6. **Fácil de compartir:** el formato es texto: se comparte copiándolo. ✔
7. **Precedente:** pegar una receta en una app de recetas, importar un patrón en un secuenciador. ✔
8. **Quitar antes de añadir:** no se añade red, cuentas ni ajustes. ✔

## 5. Fases
1. `importRemix.ts` + tests (sin interfaz): el validador y el conversor.
2. «Importar» en Remixes con el texto de §3.2 y el botón «copiar el formato».
3. (Más adelante, con decisión tuya) opción A o B de §1.1.

## 6. Preguntas abiertas
- **¿El tema libre** (notas escritas por la IA de una obra concreta) **se acepta o solo el catálogo?** Propongo aceptar con la marca «sin verificar» y aviso, porque es lo que hará quien lo pida por fuera.
- **¿Nombres de partes libres?** Propuesta: lista cerrada de 8 (arriba).
- **Datos que no se guardan:** lo importado vive en su propia clave; «Abrir en el Estudio» (020) lo copia a Mis canciones solo si se pide.
