import { escapeYaml } from "./utils";

export function funcionalidad(nombre: string, fecha: string): string {
	return `---
tipo: epica
nombre: "${escapeYaml(nombre)}"
fecha-creacion: ${fecha}
---

${cuerpoSecciones(nombre)}`;
}

/** Funcionalidad dentro de una épica: misma estructura de secciones, con
 * vínculo a su épica y estado propio. */
export function funcionalidadNueva(nombre: string, epicaSlug: string, fecha: string): string {
	return `---
tipo: historia
epica: "[[${epicaSlug}]]"
nombre: "${escapeYaml(nombre)}"
estado: backlog
fecha-creacion: ${fecha}
---

${cuerpoSecciones(nombre)}`;
}

function cuerpoSecciones(nombre: string): string {
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

export function tarea(nombre: string, funcSlug: string, fecha: string): string {
	return `---
tipo: tarea
historia: "[[${funcSlug}]]"
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

/** Incidencia de un tipo configurable (su `tipo` es el slug del tipo elegido). */
export function incidencia(
	nombre: string,
	funcSlug: string,
	fecha: string,
	tipoSlug: string
): string {
	return `---
tipo: ${tipoSlug}
historia: "[[${funcSlug}]]"
nombre: "${escapeYaml(nombre)}"
estado: por-hacer
fecha-creacion: ${fecha}
---

# ${nombre}

## Descripción
<!-- Escribe aquí los detalles de la incidencia -->

## Notas
<!-- Notas relacionadas a esta incidencia -->
`;
}

export function pendiente(nombre: string, funcSlug: string, fecha: string): string {
	return `---
tipo: pendiente
historia: "[[${funcSlug}]]"
nombre: "${escapeYaml(nombre)}"
estado: por-hacer
fecha: ${fecha}
---

# ${nombre}

**Fecha:** ${fecha}
**Historia relacionada:** [[${funcSlug}]]

## Descripción
<!-- Describe el pendiente -->

## Criterio de completado
<!-- ¿Cuándo se considera resuelto este pendiente? -->
`;
}
