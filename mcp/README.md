# MCP de "Gestión de épicas"

Servidor [MCP](https://modelcontextprotocol.io) local que permite a un asistente
(Claude, etc.) leer y gestionar el contenido del plugin **Gestión de épicas**
directamente sobre los archivos de tu vault de Obsidian. Funciona 100% en local,
sin conexión a internet. No forma parte del release del plugin: vive en el
repositorio como herramienta complementaria.

## Instalación

```bash
cd mcp
npm install
```

## Configuración de vaults

Crea `~/.gestion-de-epicas-mcp/vaults.json` (o apunta a otro con la variable
`GESTION_VAULTS_CONFIG`, o pásalo inline con `GESTION_VAULTS`):

```json
{
  "vaults": [
    { "nombre": "trabajo", "ruta": "/ruta/a/tu/Vault" }
  ]
}
```

Con un solo vault, el parámetro `vault` de cada herramienta es opcional.

## Registrarlo en Claude Desktop

En `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gestion-de-epicas": {
      "command": "node",
      "args": ["/ruta/al/repo/mcp/src/index.js"]
    }
  }
}
```

## Herramientas

**Lectura:** `listar_vaults`, `listar_epicas`, `listar_historias`,
`detalle_epica`, `listar_incidencias`, `listar_documentos`, `leer_nota`,
`buscar`, `listar_tipos_incidencia`, `listar_tipos_documento`,
`listar_colaboradores`, `listar_etiquetas_sprint`.

**Creación:** `crear_epica`, `crear_historia`, `crear_incidencia`,
`crear_documento`, `crear_tarea`, `crear_pendiente`.

**Edición:** `cambiar_estado`, `asignar_colaborador`, `etiquetar_historia`,
`asignar_sprint`, `renombrar`, `eliminar`.

**Organización:** `archivar_epica`, `mover_historia`, `mover_incidencia`,
`reclasificar_tipo`, `clasificar_documento`.

**Configuración del plugin** (requiere recargar Obsidian): `agregar_*` /
`eliminar_*` para `tipo_incidencia`, `tipo_documento`, `colaborador` y
`etiqueta_sprint`.

## Notas

- Replica las convenciones de carpetas y frontmatter del plugin
  (`Épicas/`, `Épicas archivadas/`, `historias/`, carpetas por tipo, `data.json`).
- `eliminar` mueve a la papelera local del vault (`.trash`).
- Los cambios en `data.json` (tipos, colaboradores, etiquetas) requieren recargar
  Obsidian para verse en la interfaz.
