# Gestion de epicas

**Plugin de Obsidian para Product Owners, Product Managers y equipos ágiles** que gestionan el desarrollo de producto a través de épicas. Concentra en un solo lugar toda la información que necesitas: historias, sprints, tareas, pendientes y roadmap — todo como notas Markdown dentro de tu bóveda.

Tu información siempre queda en archivos `.md` normales: portable, legible y tuya, incluso sin el plugin.

> ⚠️ Solo para **Obsidian Desktop** (Windows, macOS, Linux). Interfaz en español.

---

## ¿Qué puedes gestionar?

El plugin trabaja con una jerarquía pensada para gestión de producto:

| Elemento | Descripción |
|---|---|
| **Épica** | El contenedor principal de un esfuerzo de producto. Se almacenan en las carpetas `Épicas/` y `Épicas archivadas/` de tu vault. |
| **Historia** | Un módulo o bloque de trabajo dentro de una épica. |
| **Etiqueta** | Clasifica tus historias por funcionalidad u otros criterios que definas. |
| **Incidencia** | Crea tus propios tipos de registros: tareas, pendientes, notas, etc. Puedes asignarlas a nivel de épica o de historia. |
| **Sprint** | Asigna sprints a tus épicas y vincula los equipos o células que trabajarán en ellas. |
| **Colaborador** | Asigna personas a cualquier elemento que crees dentro del plugin. |

Cada elemento se guarda como una nota Markdown con su frontmatter, organizada automáticamente en carpetas con nombres *slugificados*:
`Diseñar pantalla de login` → `disenar-pantalla-de-login.md`

---

## Instalación

### Desde Community Plugins de Obsidian

> 🕐 Disponible una vez que el plugin sea aprobado en el catálogo oficial.

1. Abre **Settings → Community plugins → Browse**.
2. Busca **Gestion de epicas**.
3. Haz clic en **Install** y luego en **Enable**.

### Instalación manual

1. Descarga `manifest.json`, `main.js` y `styles.css` desde la [última Release del repositorio](../../releases/latest).
2. Crea la siguiente carpeta dentro de tu vault:
```
   <tu-vault>/.obsidian/plugins/gestion-de-epicas/
```
   > 💡 La carpeta `.obsidian` está oculta. En macOS presiona `Cmd + Shift + .` en Finder para verla.
3. Copia los tres archivos descargados en esa carpeta.
4. En Obsidian, ve a **Settings → Community plugins**, habilita los plugins de la comunidad si es necesario y activa **Gestion de epicas**.

---

## Primeros pasos

1. Abre el **panel de acciones** desde el ícono del plugin en la barra lateral izquierda.
2. La primera vez, usa **"Crear carpetas de gestión"** para generar la estructura de épicas en tu vault.
3. Crea tu primera **épica** — se abrirá su nota principal (el dashboard).
4. Desde ahí, agrega **historias, tareas y pendientes**.
5. Abre el **Kanban** o el **Roadmap** desde el panel para visualizar el avance general.

---

## Documentación detallada

Guías, ejemplos y artículos sobre cómo aprovechar el plugin en tu gestión de producto:

**[Anatomía del Producto](https://www.anatomia-del-producto.com/obsidian/gestion-de-epicas/)**

---

## Configuración

En **Settings → Gestion de epicas** puedes personalizar:

- Etiquetas de sprint
- Estados disponibles
- Opciones de incidencias e historias

---

## Desarrollo

```bash
npm install
npm run dev     # Compila en modo watch
npm run build   # Verifica tipos y genera main.js de producción
```

---

## Licencia

[MIT](LICENSE)

---

## ☕ ¿Te resulta útil?

Si este plugin te ahorra tiempo en tu día a día, considera invitarme un café. ¡Ayuda a seguir mejorándolo!

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-buymeacoffee.com%2Fleonardoruano-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/leonardoruano)
