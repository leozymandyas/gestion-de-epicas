#!/usr/bin/env node
// Servidor MCP de "Gestión de épicas". Expone como herramientas las operaciones
// del plugin sobre uno o varios vaults locales de Obsidian. 100% local.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import * as v from "./vault.js";

const server = new McpServer({ name: "gestion-de-epicas", version: "1.0.0" });

function ok(data) {
	return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}
function fail(error) {
	return { isError: true, content: [{ type: "text", text: `Error: ${error?.message || String(error)}` }] };
}
const AVISO_REINICIO =
	"⚠️ Cambió la configuración del plugin (data.json). Recarga Obsidian (Cmd/Ctrl+R) " +
	"para que se refleje en la interfaz.";
function okReinicio(data) {
	return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }, { type: "text", text: AVISO_REINICIO }] };
}

const vaultArg = z.string().optional().describe("Nombre del vault configurado. Opcional si solo hay uno.");
const epicaArg = z.string().describe("Nombre o slug de la épica.");
const historiaOpt = z.string().optional().describe("Nombre o slug de la historia (opcional; sin ella, a nivel de épica).");
const rutaArg = z.string().describe("Ruta de la nota relativa a la raíz del vault.");

const reg = (nombre, desc, esquema, fn) => server.tool(nombre, desc, esquema, fn);
const correr = async (fn) => {
	try {
		return await fn();
	} catch (e) {
		return fail(e);
	}
};

// ----- Lectura -----

reg("listar_vaults", "Lista los vaults de Obsidian configurados para este MCP.", {}, () =>
	correr(async () => ok(await v.cargarVaults()))
);

reg("listar_epicas", "Lista las épicas (activas y archivadas) con nombre, slug y estado.", { vault: vaultArg }, ({ vault }) =>
	correr(async () => {
		const vt = await v.resolverVault(vault);
		return ok((await v.listarEpicas(vt)).map((e) => ({ slug: e.slug, nombre: e.nombre, estado: e.estado })));
	})
);

reg("listar_historias", "Lista las historias de una épica (nombre, slug, estado, etiquetas).", { vault: vaultArg, epica: epicaArg }, ({ vault, epica }) =>
	correr(async () => {
		const vt = await v.resolverVault(vault);
		const ep = await v.resolverEpica(vt, epica);
		return ok((await v.listarHistorias(vt, ep)).map((h) => ({ slug: h.slug, nombre: h.nombre, estado: h.estadoFrontmatter, etiquetas: h.etiquetas })));
	})
);

reg("detalle_epica", "Detalle completo de una épica: incidencias, documentos, tareas, pendientes e historias (con sus incidencias).", { vault: vaultArg, epica: epicaArg }, ({ vault, epica }) =>
	correr(async () => ok(await v.detalleEpica(await v.resolverVault(vault), epica)))
);

reg("listar_incidencias", "Lista las incidencias (y tareas/pendientes) de una épica o historia.", { vault: vaultArg, epica: epicaArg, historia: historiaOpt }, ({ vault, epica, historia }) =>
	correr(async () => ok(await v.listarIncidencias(await v.resolverVault(vault), epica, historia)))
);

reg("listar_documentos", "Lista los documentos clasificados de una épica.", { vault: vaultArg, epica: epicaArg }, ({ vault, epica }) =>
	correr(async () => ok(await v.listarDocumentos(await v.resolverVault(vault), epica)))
);

reg("leer_nota", "Lee el Markdown completo de una nota por su ruta relativa al vault.", { vault: vaultArg, ruta: rutaArg }, ({ vault, ruta }) =>
	correr(async () => ({ content: [{ type: "text", text: await v.leerNota(await v.resolverVault(vault), ruta) }] }))
);

reg("buscar", "Busca texto en nombres y contenido de las notas dentro de las carpetas de épicas.", { vault: vaultArg, texto: z.string().describe("Texto a buscar.") }, ({ vault, texto }) =>
	correr(async () => ok(await v.buscar(await v.resolverVault(vault), texto)))
);

// ----- Configuración (lectura) -----

reg("listar_tipos_incidencia", "Lista los tipos de incidencia configurados.", { vault: vaultArg }, ({ vault }) =>
	correr(async () => ok(await v.listarConfig(await v.resolverVault(vault), "incidencias")))
);
reg("listar_tipos_documento", "Lista los tipos de documento configurados.", { vault: vaultArg }, ({ vault }) =>
	correr(async () => ok(await v.listarConfig(await v.resolverVault(vault), "documentos")))
);
reg("listar_colaboradores", "Lista los colaboradores configurados.", { vault: vaultArg }, ({ vault }) =>
	correr(async () => ok(await v.listarConfig(await v.resolverVault(vault), "colaboradores")))
);
reg("listar_etiquetas_sprint", "Lista las etiquetas de sprint configuradas.", { vault: vaultArg }, ({ vault }) =>
	correr(async () => ok(await v.listarConfig(await v.resolverVault(vault), "etiquetas")))
);

// ----- Creación -----

reg("crear_epica", "Crea una épica nueva en la carpeta de épicas activas.", { vault: vaultArg, nombre: z.string() }, ({ vault, nombre }) =>
	correr(async () => ok(await v.crearEpica(await v.resolverVault(vault), nombre)))
);
reg("crear_historia", "Crea una historia dentro de una épica.", { vault: vaultArg, epica: epicaArg, nombre: z.string() }, ({ vault, epica, nombre }) =>
	correr(async () => ok(await v.crearHistoria(await v.resolverVault(vault), epica, nombre)))
);
reg(
	"crear_incidencia",
	"Crea una incidencia de un tipo configurado en una épica o historia. Colaboradores opcional.",
	{ vault: vaultArg, epica: epicaArg, historia: historiaOpt, tipo: z.string().describe("Nombre del tipo de incidencia."), nombre: z.string(), descripcion: z.string().optional(), colaboradores: z.array(z.string()).optional() },
	({ vault, epica, historia, tipo, nombre, descripcion, colaboradores }) =>
		correr(async () => ok(await v.crearIncidencia(await v.resolverVault(vault), epica, historia, tipo, nombre, descripcion, colaboradores)))
);
reg(
	"crear_documento",
	"Crea un documento de un tipo configurado en una épica (los documentos son a nivel de épica).",
	{ vault: vaultArg, epica: epicaArg, tipo: z.string().describe("Nombre del tipo de documento."), nombre: z.string(), descripcion: z.string().optional() },
	({ vault, epica, tipo, nombre, descripcion }) =>
		correr(async () => ok(await v.crearDocumento(await v.resolverVault(vault), epica, tipo, nombre, descripcion)))
);
reg("crear_tarea", "Crea una tarea en una épica o historia y la enlaza en su sección Tareas.", { vault: vaultArg, epica: epicaArg, historia: historiaOpt, nombre: z.string() }, ({ vault, epica, historia, nombre }) =>
	correr(async () => ok(await v.crearTarea(await v.resolverVault(vault), epica, historia, nombre)))
);
reg("crear_pendiente", "Crea un pendiente en una épica o historia y lo enlaza en su sección Pendientes.", { vault: vaultArg, epica: epicaArg, historia: historiaOpt, nombre: z.string() }, ({ vault, epica, historia, nombre }) =>
	correr(async () => ok(await v.crearPendiente(await v.resolverVault(vault), epica, historia, nombre)))
);

// ----- Edición -----

reg("cambiar_estado", "Cambia el 'estado' en el frontmatter de una nota (backlog, por-hacer, en-progreso, completado).", { vault: vaultArg, ruta: rutaArg, estado: z.string() }, ({ vault, ruta, estado }) =>
	correr(async () => ok(await v.cambiarEstado(await v.resolverVault(vault), ruta, estado)))
);
reg("asignar_colaborador", "Asigna (reemplaza) la lista de colaboradores en el frontmatter de una nota.", { vault: vaultArg, ruta: rutaArg, colaboradores: z.array(z.string()) }, ({ vault, ruta, colaboradores }) =>
	correr(async () => ok(await v.asignarColaborador(await v.resolverVault(vault), ruta, colaboradores)))
);
reg("etiquetar_historia", "Asigna (reemplaza) las etiquetas de una historia en su frontmatter.", { vault: vaultArg, ruta: rutaArg, etiquetas: z.array(z.string()) }, ({ vault, ruta, etiquetas }) =>
	correr(async () => ok(await v.etiquetarHistoria(await v.resolverVault(vault), ruta, etiquetas)))
);
reg("asignar_sprint", "Asigna (o quita, con sprint null) el sprint/año de una historia en su frontmatter.", { vault: vaultArg, ruta: rutaArg, anio: z.number(), sprint: z.number().nullable() }, ({ vault, ruta, anio, sprint }) =>
	correr(async () => ok(await v.asignarSprint(await v.resolverVault(vault), ruta, anio, sprint)))
);
reg("renombrar", "Renombra una nota. Épicas/historias actualizan las relaciones de sus hijos; incidencias/documentos cambian su nombre y archivo.", { vault: vaultArg, ruta: rutaArg, nombre: z.string() }, ({ vault, ruta, nombre }) =>
	correr(async () => ok(await v.renombrar(await v.resolverVault(vault), ruta, nombre)))
);
reg("eliminar", "Envía a la papelera (.trash del vault) una nota o, si es la nota principal, toda la épica/historia.", { vault: vaultArg, ruta: rutaArg }, ({ vault, ruta }) =>
	correr(async () => ok(await v.eliminar(await v.resolverVault(vault), ruta)))
);

// ----- Organización -----

reg("archivar_epica", "Archiva una épica. Si ya hay una archivada con el mismo nombre, la renombra con el año y actualiza sus hijos.", { vault: vaultArg, epica: epicaArg, anio: z.number().optional() }, ({ vault, epica, anio }) =>
	correr(async () => ok(await v.archivarEpica(await v.resolverVault(vault), epica, anio)))
);
reg("mover_historia", "Mueve una historia (con su contenido) a otra épica.", { vault: vaultArg, epica_origen: epicaArg, historia: z.string(), epica_destino: z.string() }, ({ vault, epica_origen, historia, epica_destino }) =>
	correr(async () => ok(await v.moverHistoria(await v.resolverVault(vault), epica_origen, historia, epica_destino)))
);
reg(
	"mover_incidencia",
	"Mueve una incidencia a otra épica/historia y, opcionalmente, cambia su tipo.",
	{ vault: vaultArg, ruta: rutaArg, epica_destino: epicaArg, historia_destino: historiaOpt, tipo: z.string().optional().describe("Nuevo tipo (opcional; conserva el actual si se omite).") },
	({ vault, ruta, epica_destino, historia_destino, tipo }) =>
		correr(async () => ok(await v.moverIncidencia(await v.resolverVault(vault), ruta, epica_destino, historia_destino, tipo)))
);
reg("reclasificar_tipo", "Cambia el tipo de una incidencia o documento conservando su ubicación.", { vault: vaultArg, ruta: rutaArg, tipo: z.string().describe("Nuevo tipo.") }, ({ vault, ruta, tipo }) =>
	correr(async () => ok(await v.reclasificarTipo(await v.resolverVault(vault), ruta, tipo)))
);
reg("clasificar_documento", "Clasifica un .md suelto como documento de un tipo en una épica (lo mueve a la carpeta del tipo).", { vault: vaultArg, ruta: rutaArg, epica: epicaArg, tipo: z.string().describe("Tipo de documento.") }, ({ vault, ruta, epica, tipo }) =>
	correr(async () => ok(await v.clasificarDocumento(await v.resolverVault(vault), ruta, epica, tipo)))
);

// ----- Configuración (escritura: requiere recargar Obsidian) -----

const claves = { tipo_incidencia: "incidencias", tipo_documento: "documentos", colaborador: "colaboradores", etiqueta_sprint: "etiquetas" };
for (const [suf, clave] of Object.entries(claves)) {
	reg(`agregar_${suf}`, `Agrega un ${suf.replace("_", " ")} a la configuración del plugin.`, { vault: vaultArg, nombre: z.string(), color: z.string().optional().describe("Color hex #rrggbb (opcional).") }, ({ vault, nombre, color }) =>
		correr(async () => okReinicio(await v.agregarConfig(await v.resolverVault(vault), clave, nombre, color)))
	);
	reg(`eliminar_${suf}`, `Elimina un ${suf.replace("_", " ")} de la configuración del plugin.`, { vault: vaultArg, nombre: z.string() }, ({ vault, nombre }) =>
		correr(async () => okReinicio(await v.eliminarConfig(await v.resolverVault(vault), clave, nombre)))
	);
}

// ---------------------------------------------------------------------------

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error("gestion-de-epicas MCP iniciado.");
}
main().catch((e) => {
	console.error("Fallo al iniciar el MCP:", e);
	process.exit(1);
});
