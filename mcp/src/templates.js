// Plantillas de notas, replicadas de src/templates.ts del plugin.
import { escapeYaml } from "./slug.js";

function cuerpoSecciones(nombre) {
	return `# ${nombre}

## Descripción
<!-- Escribe aquí la descripción -->

## Links relacionados
<!-- Pega aquí los links del proyecto, tickets, documentos, etc. -->

## Tareas
<!-- Las tareas aparecen aquí automáticamente cuando las creas desde el plugin -->

## Pendientes
<!-- Los pendientes aparecen aquí automáticamente cuando los creas desde el plugin -->
`;
}

/** Nota principal de una épica. */
export function epica(nombre, fecha) {
	return `---
tipo: epica
nombre: "${escapeYaml(nombre)}"
fecha-creacion: ${fecha}
---

${cuerpoSecciones(nombre)}`;
}

/** Nota principal de una historia (dentro de una épica). */
export function historia(nombre, epicaSlug, fecha) {
	return `---
tipo: historia
epica: "[[${epicaSlug}]]"
nombre: "${escapeYaml(nombre)}"
estado: backlog
fecha-creacion: ${fecha}
---

${cuerpoSecciones(nombre)}`;
}

export function tarea(nombre, contenedorSlug, fecha) {
	return `---
tipo: tarea
historia: "[[${contenedorSlug}]]"
nombre: "${escapeYaml(nombre)}"
estado: por-hacer
fecha-creacion: ${fecha}
---

# ${nombre}

## Descripción
<!-- Escribe aquí los detalles de la tarea -->

## Notas
<!-- Notas relacionadas a esta tarea -->
`;
}

/** Incidencia o documento de un tipo configurable (su `tipo` es el slug del tipo). */
export function incidencia(nombre, contenedorSlug, fecha, tipoSlug, descripcion = "") {
	const desc = descripcion.trim() || "<!-- Escribe aquí los detalles -->";
	return `---
tipo: ${tipoSlug}
historia: "[[${contenedorSlug}]]"
nombre: "${escapeYaml(nombre)}"
estado: por-hacer
fecha-creacion: ${fecha}
---

# ${nombre}

## Descripción
${desc}

## Notas
<!-- Notas relacionadas -->
`;
}

export function pendiente(nombre, contenedorSlug, fecha) {
	return `---
tipo: pendiente
historia: "[[${contenedorSlug}]]"
nombre: "${escapeYaml(nombre)}"
estado: por-hacer
fecha: ${fecha}
---

# ${nombre}

**Fecha:** ${fecha}
**Historia relacionada:** [[${contenedorSlug}]]

## Descripción
<!-- Describe el pendiente -->

## Criterio de completado
<!-- ¿Cuándo se considera resuelto este pendiente? -->
`;
}
