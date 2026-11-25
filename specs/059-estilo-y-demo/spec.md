# Spec 059 · Cambiar de estilo en el Estudio: seguir con tu canción o cargar la demo (corta)

## Por qué
Al quitar el aviso (tanda 8), cambiar de estilo con algo hecho solo cambiaba bajo, acordes y tempo: apenas se notaba (principio 3) y no había forma de pasar a la demo del estilo nuevo sin vaciar el Estudio. Guardar copias a escondidas se descartó: la persona puede creer que pierde su canción aunque se guarde (Ion).

## Qué cambia (`app/components/Studio.vue`, `ConfirmDialog.vue`, `useConfirm.ts`)
- El estilo se cambia **siempre al momento** (se oye).
- **Estudio vacío:** además se carga la demo del estilo nuevo, sin preguntar (no hay nada que perder).
- **Con algo hecho:** una pregunta con dos botones: **«Seguir con mi canción»** (no hace nada más) y **«Cargar la demo»** (reemplaza lo que hay). Cerrar el cuadro o tocar fuera = seguir con mi canción.
- `askConfirm` admite un tercer parámetro con el texto del botón de cancelar (por defecto «Cancelar»).
- El botón «Empezar con una demo de…» del Estudio vacío se queda: es la única forma de cargar la demo del estilo que ya está puesto.
- Fuera: el aviso «Cambia el bajo, los acordes…» (ya quitado).

## Principios
1 ✔ una pregunta, dos botones · 2 ✔ no cambia el sonido · 3 ✔ el estilo suena al instante · 4 ✔ la persona decide si pierde lo suyo · 5 ✔ · 6 ✔ · 7 ⚠ precedente: los cuadros de «¿conservar o reemplazar?» de cualquier editor; sin probar con alguien que no conozca la app · 8 ✔ sin copias automáticas ni más botones.

## Decisiones a revisar
- Con algo hecho, el estilo ya está cambiado cuando aparece la pregunta; «Seguir con mi canción» no lo revierte.
- Los textos de `ConfirmDialog` («Cancelar») siguen fuera de i18n; solo se traducen los nuevos.

## No comprobado
Solo con navegador sin pantalla. **No oído y no visto en un iPhone.**
