# Gestion de epicas

Plugin de Obsidian para Product Owners y equipos que gestionan el desarrollo de un
producto. Concentra toda la información de una **épica** —historias, tareas,
pendientes, sprints y roadmap— como notas Markdown dentro de tu vault.

Todo se guarda en archivos `.md` normales: tu información queda en tu vault, es tuya,
portable y legible sin el plugin.

> Solo para Obsidian Desktop (Windows, macOS, Linux). Interfaz en español.

---

## Cómo organiza la información

El plugin trabaja con una jerarquía pensada para gestión de producto:

- **Épica** — el contenedor principal de un esfuerzo de producto. Se guardan en las
  carpetas `Épicas/` y `Épicas archivadas/` de tu vault.
- **Historia** — un módulo o parte de trabajo dentro de una épica.
- **Tarea** — el trabajo concreto, con estado (por hacer, en progreso, etc.).
- **Pendiente** — cosas por resolver, con su criterio de completado.
- **Sprint** — asignación de trabajo a sprints, con etiquetas configurables.
- **Colaborador** — personas asignables a tareas y pendientes.

Cada elemento es una nota Markdown con su frontmatter, organizada en carpetas
automáticamente y con nombres "slugificados" (`Diseñar pantalla de login` →
`disenar-pantalla-de-login.md`).

## Características

- **Panel de acciones** lateral (ícono en la barra izquierda de Obsidian) con botones
  para crear cada tipo de elemento, sin memorizar comandos.

  <img src="https://raw.githubusercontent.com/leozymandyas/gestion-de-epicas/main/assets/panel-acciones.png" alt="Panel de acciones" width="480">

- **Comandos** en la paleta (`Cmd/Ctrl + P`): crear épica, historia, tarea,
  pendiente, asignar sprint, asignar colaborador, archivar épicas, y más.

  <img src="https://raw.githubusercontent.com/leozymandyas/gestion-de-epicas/main/assets/comandos.png" alt="Comandos" width="480">

- **Sprints y etiquetas** configurables para clasificar el trabajo.

  <img src="https://raw.githubusercontent.com/leozymandyas/gestion-de-epicas/main/assets/etiquetas-sprint.png" alt="Sprint y etiquetas" width="480">

- **Tablero Kanban** (gestión de incidencias y de historias) y vista **Roadmap** para
  ver el avance general por estado y sprint.

  <img src="https://raw.githubusercontent.com/leozymandyas/gestion-de-epicas/main/assets/roadmap.png" alt="Roadmap" width="480">

## Instalación

### Desde los Community Plugins de Obsidian

> Disponible cuando el plugin sea aprobado en el catálogo oficial.

1. Abre **Settings → Community plugins → Browse**.
2. Busca **Gestion de epicas**.
3. **Install** y luego **Enable**.

### Instalación manual

1. Descarga `manifest.json`, `main.js` y `styles.css` desde la
   [última Release del repositorio](../../releases/latest).
2. Crea la carpeta `gestion-de-epicas` dentro de la carpeta de plugins de tu vault:
   ```
   <tu-vault>/.obsidian/plugins/gestion-de-epicas/
   ```
   > La carpeta `.obsidian` está oculta. En macOS pulsa `Cmd + Shift + .` en Finder para verla.
3. Copia los tres archivos descargados ahí dentro.
4. En Obsidian, ve a **Settings → Community plugins**, activa los plugins de la comunidad
   si te lo pide y enciende **Gestion de epicas**.

## Primeros pasos

1. Abre el **panel de acciones** desde el ícono del plugin en la barra lateral izquierda.
2. La primera vez, usa **"Crear carpetas de gestión"** para generar las carpetas de épicas.
3. Crea tu primera **épica**. Se abrirá su nota principal (el dashboard).
4. Desde ahí, agrega **historias, tareas y pendientes**.
5. Abre el **Kanban** o el **Roadmap** desde el panel para ver el avance general.

## Configuración

En **Settings → Gestion de epicas** puedes personalizar las etiquetas de sprint, los
estados y las opciones de incidencias e historias.

## Desarrollo

```bash
npm install
npm run dev     # compila en modo watch
npm run build   # verifica tipos y genera main.js de producción
```

## Licencia

[MIT](LICENSE).
