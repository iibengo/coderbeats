# Preparar el repositorio para hacerlo público (2026-11-16)

**Nada se ha publicado ni subido.** Aquí está lo hecho, lo comprobado y **lo que falta, que es tuyo**.

## Hecho
- **Licencia:** `LICENSE` (AGPL-3.0, texto completo) y `"license": "AGPL-3.0-or-later"` en `package.json`; un test comprueba que coinciden con el «Acerca de» de la app.
- **«Acerca de»** en la app (⋯ → «acerca de» y un enlace en la pantalla de inicio): licencia, enlace al código fuente (AGPL §13) y créditos (Strudel, TidalCycles, Meyda, uzu-drumkit, Fischer, Boochi44, Nuxt/Vue/Tailwind). Los datos están en `app/lib/about.ts`; la URL del código es `SOURCE_URL` (apunta a `github.com/iibengo/coderbeats`: **cámbiala si el repositorio se llama distinto**).
- **Créditos de samples:** `public/samples/CREDITS.md` (todo con licencia clara: Unlicense y CC0; un test lo comprueba).
- **README público** reescrito (qué es, cómo probarlo, privacidad, cómo está hecho, cómo contribuir, licencia y créditos).
- **Secretos:** búsqueda en el código y en toda la historia de claves, tokens y contraseñas: **no hay**. No hay `.env` versionado. La app **no hace peticiones a terceros** al usarla (las tipografías están en local; `api.iconify.design` aparece en el bundle pero no se usa; `raw.githubusercontent.com` y `shabda` solo salen del código que copias a strudel.cc).
- **Tomas de voz:** `tests/fixtures/voice/` está en `.gitignore` y **nunca** estuvo en la historia (comprobado). Los tests que las usan se saltan si no están.
- **`.gitignore`** ahora excluye `tem/`, las capturas sueltas de la raíz (`/f_*.png`), `*.mkv` y `docs/anecdotas.md` (tu material del blog; no se sube).
- **Quitado del árbol:** `tem/grabacio.mkv` (grabación de pantalla, 4 MB) y seis capturas `f_*.png` **con tu barra de marcadores a la vista** (nombres de sitios, exchanges…). Los moví a `../coderbeats-material-privado/` (fuera del repositorio).
- **Rutas personales** quitadas de los guiones de `tests/browser/`.

## Lo que sigue en la HISTORIA (y por eso hay que limpiarla antes de publicar)
Un repositorio público publica **toda** la historia, no solo el último commit. Comprobado:
| Qué | Dónde |
|---|---|
| **Tu correo personal** como autor de los 228 commits | metadatos de commit |
| `f_31…f_38.png` (barra de marcadores del navegador) | commit `00873c6` y siguientes |
| `tem/grabacio.mkv` (4 MB) | historia |
| **Samples sin licencia declarada** (`public/samples/909` y `acoustic`, de tidal-drum-machines/ritchse), ya retirados del árbol | historia |
| Tu usuario de sistema en una ruta de `tests/browser/compartir.mjs` | 34 commits |

**Cómo limpiarla sin tocar este repositorio:** `scripts/limpiar-historial.sh [carpeta]` hace una **copia** y reescribe la historia solo allí (quita lo de la tabla, cambia el correo por `iibengo@users.noreply.github.com`, o el que pongas en `NEW_EMAIL`). **Probado:** en la copia no queda ningún correo, ni `tem/`, ni capturas, ni 909/acoustic, el árbol final es idéntico al de aquí y el `.git` pasa de 27 MB a ~2 MB.

## Lo que falta (tuyo)
1. **Decidir el correo/nombre de los commits** (`NEW_EMAIL`, `NEW_NAME`) y lanzar el script; revisar `git log` de la copia.
2. **Crear el repositorio en GitHub** y subir **la copia limpia** (no este directorio): `git remote add origin … && git push -u origin main`. Activa en GitHub el aviso de secretos y, si quieres, protege `main`.
3. **Publicar `kits/coderbeats-kits`** como `iibengo/coderbeats-kits`, etiqueta `v1` (sin eso, el código del kit «Vinilo» no suena en strudel.cc; la app funciona igual con su copia local).
4. **Una captura o un GIF** para el README (hazlo sin tu barra de marcadores; no he puesto ninguna).
5. Decidir si `docs/arquitectura.html` y `specs/` (incluido `ESTADO.md`, con tu manera de hablar y el registro de pruebas de tu iPhone) quedan públicos. `docs/anecdotas.md` ya está fuera.
6. **Dependencias:** `npm audit` y revisar licencias antes de publicar (las directas son MIT, salvo Strudel: AGPL-3.0-or-later, compatible).
7. Si quieres avisos de copyright por archivo, la AGPL no los exige; basta con `LICENSE` y el «Acerca de».
