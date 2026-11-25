#!/usr/bin/env bash
# Prepara una COPIA limpia del repositorio para publicarlo (specs/PUBLICAR.md). NO toca el repositorio original.
#
#   scripts/limpiar-historial.sh [carpeta-destino]      (por defecto ../coderbeats-publico)
#   NEW_EMAIL=otro@ejemplo scripts/limpiar-historial.sh
#
# Qué quita de TODA la historia (solo en la copia):
#   · capturas con el navegador del autor a la vista (f_*.png) y grabaciones de pantalla (tem/)
#   · los samples sin licencia declarada que ya se retiraron (909, acoustic: tidal-drum-machines)
#   · el correo personal de los commits (se sustituye por NEW_EMAIL; por defecto, el «noreply» de GitHub)
#   · la ruta personal «/home/<usuario>/» que quedó en tests/browser/compartir.mjs
# Después comprueba, mira `git log` y publica la copia (nada se sube desde aquí).
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-$SRC/../coderbeats-publico}"
NEW_NAME="${NEW_NAME:-iibengo}"
# por defecto, el «noreply» con el ID real de GitHub (el que ya usan los commits recientes)
NEW_EMAIL="${NEW_EMAIL:-$(git -C "$SRC" log --format=%ae | grep -m1 'users.noreply.github.com' || echo iibengo@users.noreply.github.com)}"

[ -e "$DEST" ] && { echo "ya existe $DEST: bórralo o elige otro destino" >&2; exit 1; }
git clone --no-local --quiet "$SRC" "$DEST"
cd "$DEST"
git remote remove origin 2>/dev/null || true
export FILTER_BRANCH_SQUELCH_WARNING=1

git filter-branch -f --prune-empty --tag-name-filter cat \
  --index-filter 'git rm -r --cached --ignore-unmatch -q -- f_31.png f_33.png f_34.png f_36.png f_37.png f_38.png tem public/samples/909 public/samples/acoustic' \
  --env-filter "
    case \"\$GIT_AUTHOR_EMAIL\" in *users.noreply.github.com) ;; *) export GIT_AUTHOR_EMAIL='$NEW_EMAIL' GIT_AUTHOR_NAME='$NEW_NAME';; esac
    case \"\$GIT_COMMITTER_EMAIL\" in *users.noreply.github.com) ;; *) export GIT_COMMITTER_EMAIL='$NEW_EMAIL' GIT_COMMITTER_NAME='$NEW_NAME';; esac" \
  --tree-filter "[ -f tests/browser/compartir.mjs ] && sed -i 's#/home/[A-Za-z0-9._-]*/#./#g' tests/browser/compartir.mjs || true" \
  -- --all 2>&1 | tr '\r' '\n' | tail -n 2

# fuera las copias de seguridad de filter-branch y la basura
rm -rf .git/refs/original
git reflog expire --expire=now --all
git gc --prune=now --aggressive --quiet
echo
echo "Copia limpia en: $DEST"
echo "Comprobaciones:"
echo "  autores:        $(git log --format='%ae' | sort -u | tr '\n' ' ')"
echo "  tem/ o f_*.png: $(git log --all --name-only --format= | sort -u | grep -cE '^(tem/|f_[0-9]+\.png)' || true) (debe ser 0)"
echo "  909/acoustic:   $(git log --all --name-only --format= | sort -u | grep -cE 'samples/(909|acoustic)/' || true) (debe ser 0)"
echo "  tamaño .git:    $(du -sh .git | cut -f1)"
