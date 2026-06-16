// Operaciones de sistema de archivos sobre uno o varios vaults de Obsidian.
// Replica las convenciones de carpetas/frontmatter del plugin "Gestión de épicas"
// (src/files.ts). Funciona 100% en local. Cada operación recibe el nombre de un
// vault, que se resuelve a una ruta absoluta única; nunca se cruzan vaults.

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import matter from "gray-matter";

import { slugify, hoy, escapeYaml } from "./slug.js";
import * as tpl from "./templates.js";

const PLUGIN_ID = "gestion-de-epicas";
const CARPETA_ACTIVAS = "Épicas";
const CARPETA_INACTIVAS = "Épicas archivadas";
const CARPETA_HISTORIAS = "historias";
const CARPETA_HISTORIAS_LEGACY = "funcionalidades";
const COLOR_DEFECTO = "#5082ff";

// ---------------------------------------------------------------------------
// Configuración de vaults
// ---------------------------------------------------------------------------

function rutaConfigPorDefecto() {
	return path.join(os.homedir(), ".gestion-de-epicas-mcp", "vaults.json");
}

export async function cargarVaults() {
	let crudo;
	if (process.env.GESTION_VAULTS) {
		crudo = process.env.GESTION_VAULTS;
	} else {
		const ruta = process.env.GESTION_VAULTS_CONFIG || rutaConfigPorDefecto();
		try {
			crudo = await fs.readFile(ruta, "utf8");
		} catch {
			throw new Error(
				`No encuentro la configuración de vaults. Crea "${ruta}" con el formato:\n` +
					`{\n  "vaults": [\n    { "nombre": "trabajo", "ruta": "/ruta/a/tu/Vault" }\n  ]\n}`
			);
		}
	}
	let datos;
	try {
		datos = JSON.parse(crudo);
	} catch {
		throw new Error("La configuración de vaults no es un JSON válido.");
	}
	const lista = Array.isArray(datos) ? datos : datos.vaults;
	if (!Array.isArray(lista) || lista.length === 0) {
		throw new Error('La configuración debe contener una lista "vaults" con al menos un vault.');
	}
	return lista.map((v) => {
		if (!v || !v.nombre || !v.ruta) throw new Error('Cada vault debe tener "nombre" y "ruta".');
		return {
			nombre: String(v.nombre),
			ruta: path.resolve(String(v.ruta).replace(/^~/, os.homedir())),
		};
	});
}

export async function resolverVault(nombre) {
	const vaults = await cargarVaults();
	if (!nombre) {
		if (vaults.length === 1) return vaults[0];
		const nombres = vaults.map((v) => `"${v.nombre}"`).join(", ");
		throw new Error(`Hay varios vaults (${nombres}). Indica cuál en el parámetro "vault".`);
	}
	const v = vaults.find((x) => x.nombre.toLowerCase() === String(nombre).toLowerCase());
	if (!v) {
		const nombres = vaults.map((x) => `"${x.nombre}"`).join(", ");
		throw new Error(`No existe el vault "${nombre}". Vaults: ${nombres}.`);
	}
	if (!(await esDir(v.ruta))) throw new Error(`La ruta del vault "${v.nombre}" no existe: ${v.ruta}`);
	return v;
}

// ---------------------------------------------------------------------------
// Helpers de sistema de archivos
// ---------------------------------------------------------------------------

async function esDir(p) {
	try {
		return (await fs.stat(p)).isDirectory();
	} catch {
		return false;
	}
}
async function esArchivo(p) {
	try {
		return (await fs.stat(p)).isFile();
	} catch {
		return false;
	}
}
async function subcarpetas(dir) {
	if (!(await esDir(dir))) return [];
	return (await fs.readdir(dir, { withFileTypes: true }))
		.filter((e) => e.isDirectory())
		.map((e) => e.name);
}
async function archivosMd(dir) {
	if (!(await esDir(dir))) return [];
	return (await fs.readdir(dir, { withFileTypes: true }))
		.filter((e) => e.isFile() && e.name.endsWith(".md"))
		.map((e) => e.name);
}
async function leerMd(abs) {
	const crudo = await fs.readFile(abs, "utf8");
	const parsed = matter(crudo);
	return { data: parsed.data || {}, content: parsed.content || "" };
}
async function actualizarFrontmatter(abs, mutar) {
	const crudo = await fs.readFile(abs, "utf8");
	const parsed = matter(crudo);
	const data = parsed.data || {};
	mutar(data);
	await fs.writeFile(abs, matter.stringify(parsed.content || "", data), "utf8");
}
function rel(vault, abs) {
	return path.relative(vault.ruta, abs);
}
function absDe(vault, rutaRel) {
	const abs = path.resolve(vault.ruta, rutaRel);
	if (abs !== vault.ruta && !abs.startsWith(vault.ruta + path.sep)) {
		throw new Error("Ruta fuera del vault.");
	}
	return abs;
}
async function recorrer(dir, fn) {
	let entradas;
	try {
		entradas = await fs.readdir(dir, { withFileTypes: true });
	} catch {
		return;
	}
	for (const ent of entradas) {
		const abs = path.join(dir, ent.name);
		if (ent.isDirectory()) await recorrer(abs, fn);
		else await fn(abs);
	}
}
async function existeSlugEn(dir, slug) {
	return (await esArchivo(path.join(dir, `${slug}.md`))) || (await esDir(path.join(dir, slug)));
}
async function slugCarpetaLibre(dir, slug) {
	if (!(await existeSlugEn(dir, slug))) return slug;
	let n = 2;
	while (await existeSlugEn(dir, `${slug}-${n}`)) n++;
	return `${slug}-${n}`;
}
async function slugArchivoLibre(dir, slug) {
	const existe = async (s) => esArchivo(path.join(dir, `${s}.md`));
	if (!(await existe(slug))) return slug;
	let n = 2;
	while (await existe(`${slug}-${n}`)) n++;
	return `${slug}-${n}`;
}

// ---------------------------------------------------------------------------
// data.json del plugin (tipos, colaboradores, etiquetas)
// ---------------------------------------------------------------------------

function rutaDataJson(vault) {
	return path.join(vault.ruta, ".obsidian", "plugins", PLUGIN_ID, "data.json");
}
export async function leerData(vault) {
	try {
		return JSON.parse(await fs.readFile(rutaDataJson(vault), "utf8"));
	} catch {
		return {};
	}
}
async function guardarData(vault, data) {
	const ruta = rutaDataJson(vault);
	await fs.mkdir(path.dirname(ruta), { recursive: true });
	await fs.writeFile(ruta, JSON.stringify(data, null, 2), "utf8");
}
async function tiposIncidencia(vault) {
	const d = await leerData(vault);
	return Array.isArray(d.incidencias) ? d.incidencias : [];
}
async function tiposDocumento(vault) {
	const d = await leerData(vault);
	return Array.isArray(d.documentos) ? d.documentos : [];
}

// ---------------------------------------------------------------------------
// Raíces y resolución de épicas / historias
// ---------------------------------------------------------------------------

async function rootsEpicas(vault) {
	let activas = CARPETA_ACTIVAS;
	const cfg = await leerData(vault);
	if (cfg.carpetaAdmin) activas = String(cfg.carpetaAdmin);
	return [
		{ estado: "activa", abs: path.join(vault.ruta, activas) },
		{ estado: "archivada", abs: path.join(vault.ruta, CARPETA_INACTIVAS) },
	];
}

async function refDesdeCarpeta(carpetaAbs, slug, estado) {
	const mainAbs = path.join(carpetaAbs, `${slug}.md`);
	if (!(await esArchivo(mainAbs))) return null;
	let nombre = slug;
	let estadoFm;
	let etiquetas = [];
	try {
		const { data } = await leerMd(mainAbs);
		if (data.nombre) nombre = String(data.nombre);
		if (data.estado) estadoFm = String(data.estado);
		if (Array.isArray(data.etiquetas)) etiquetas = data.etiquetas.map(String);
	} catch {}
	return { slug, nombre, estado, estadoFrontmatter: estadoFm, etiquetas, folder: carpetaAbs, file: mainAbs };
}

export async function listarEpicas(vault) {
	const out = [];
	for (const root of await rootsEpicas(vault)) {
		for (const slug of await subcarpetas(root.abs)) {
			const e = await refDesdeCarpeta(path.join(root.abs, slug), slug, root.estado);
			if (e) out.push(e);
		}
	}
	return out.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export async function resolverEpica(vault, ref) {
	const epicas = await listarEpicas(vault);
	const slugRef = slugify(ref);
	const e = epicas.find((x) => x.slug === slugRef || x.nombre.toLowerCase() === String(ref).toLowerCase());
	if (!e) {
		const nombres = epicas.map((x) => `"${x.nombre}"`).join(", ") || "(ninguna)";
		throw new Error(`No encontré la épica "${ref}". Épicas: ${nombres}.`);
	}
	return e;
}

function nombreCarpetaHistoriasSync(epicaFolder, hijos) {
	if (hijos.includes(CARPETA_HISTORIAS)) return CARPETA_HISTORIAS;
	if (hijos.includes(CARPETA_HISTORIAS_LEGACY)) return CARPETA_HISTORIAS_LEGACY;
	return CARPETA_HISTORIAS;
}

async function carpetaHistorias(epica) {
	const hijos = await subcarpetas(epica.folder);
	return path.join(epica.folder, nombreCarpetaHistoriasSync(epica.folder, hijos));
}

export async function listarHistorias(vault, epica) {
	const dir = await carpetaHistorias(epica);
	const out = [];
	for (const slug of await subcarpetas(dir)) {
		const h = await refDesdeCarpeta(path.join(dir, slug), slug, epica.estado);
		if (h) out.push(h);
	}
	return out.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/** Resuelve un contenedor (épica o "epica/historia") por referencia. */
export async function resolverContenedor(vault, epicaRef, historiaRef) {
	const epica = await resolverEpica(vault, epicaRef);
	if (!historiaRef) return epica;
	const historias = await listarHistorias(vault, epica);
	const slugRef = slugify(historiaRef);
	const h = historias.find(
		(x) => x.slug === slugRef || x.nombre.toLowerCase() === String(historiaRef).toLowerCase()
	);
	if (!h) {
		const nombres = historias.map((x) => `"${x.nombre}"`).join(", ") || "(ninguna)";
		throw new Error(`No encontré la historia "${historiaRef}" en "${epica.nombre}". Historias: ${nombres}.`);
	}
	return h;
}

// ---------------------------------------------------------------------------
// Listado de incidencias / documentos / tareas / pendientes de un contenedor
// ---------------------------------------------------------------------------

async function notasDeTipos(container, tipos) {
	const out = [];
	for (const tipo of tipos) {
		const slug = slugify(tipo.nombre);
		const dir = path.join(container.folder, slug);
		for (const archivo of await archivosMd(dir)) {
			const abs = path.join(dir, archivo);
			let nombre = archivo.replace(/\.md$/, "");
			let estado;
			try {
				const { data } = await leerMd(abs);
				if (data.nombre) nombre = String(data.nombre);
				if (data.estado) estado = String(data.estado);
			} catch {}
			out.push({ tipo: tipo.nombre, nombre, estado, file: abs });
		}
	}
	return out;
}

async function listarSimples(container, sub) {
	const dir = path.join(container.folder, sub);
	const out = [];
	for (const archivo of await archivosMd(dir)) {
		const abs = path.join(dir, archivo);
		let nombre = archivo.replace(/\.md$/, "");
		let estado;
		try {
			const { data } = await leerMd(abs);
			if (data.nombre) nombre = String(data.nombre);
			if (data.estado) estado = String(data.estado);
		} catch {}
		out.push({ nombre, estado, file: abs });
	}
	return out;
}

export async function listarIncidencias(vault, epicaRef, historiaRef) {
	const c = await resolverContenedor(vault, epicaRef, historiaRef);
	const tipos = await tiposIncidencia(vault);
	const notas = [...(await notasDeTipos(c, tipos)), ...(await listarSimples(c, "tareas")), ...(await listarSimples(c, "pendientes"))];
	return notas.map((n) => ({ ...n, ruta: rel(vault, n.file), file: undefined }));
}

export async function listarDocumentos(vault, epicaRef) {
	const c = await resolverEpica(vault, epicaRef);
	const tipos = await tiposDocumento(vault);
	return (await notasDeTipos(c, tipos)).map((n) => ({ ...n, ruta: rel(vault, n.file), file: undefined }));
}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

export async function detalleEpica(vault, epicaRef) {
	const epica = await resolverEpica(vault, epicaRef);
	const historias = await listarHistorias(vault, epica);
	const tIncidencia = await tiposIncidencia(vault);
	const tDocumento = await tiposDocumento(vault);
	const limpiar = (n) => ({ tipo: n.tipo, nombre: n.nombre, estado: n.estado, ruta: rel(vault, n.file) });
	return {
		vault: vault.nombre,
		epica: { slug: epica.slug, nombre: epica.nombre, estado: epica.estado, ruta: rel(vault, epica.file) },
		incidencias: (await notasDeTipos(epica, tIncidencia)).map(limpiar),
		documentos: (await notasDeTipos(epica, tDocumento)).map(limpiar),
		tareas: (await listarSimples(epica, "tareas")).map((n) => ({ nombre: n.nombre, estado: n.estado, ruta: rel(vault, n.file) })),
		pendientes: (await listarSimples(epica, "pendientes")).map((n) => ({ nombre: n.nombre, estado: n.estado, ruta: rel(vault, n.file) })),
		historias: await Promise.all(
			historias.map(async (h) => ({
				slug: h.slug,
				nombre: h.nombre,
				estado: h.estadoFrontmatter,
				etiquetas: h.etiquetas,
				ruta: rel(vault, h.file),
				incidencias: (await notasDeTipos(h, tIncidencia)).map(limpiar),
			}))
		),
	};
}

export async function leerNota(vault, rutaRel) {
	const abs = absDe(vault, rutaRel);
	if (!(await esArchivo(abs))) throw new Error(`No existe la nota: ${rutaRel}`);
	return fs.readFile(abs, "utf8");
}

export async function buscar(vault, texto, limite = 30) {
	const q = String(texto).toLowerCase();
	const out = [];
	for (const root of await rootsEpicas(vault)) {
		await recorrer(root.abs, async (abs) => {
			if (!abs.endsWith(".md")) return;
			const contenido = (await fs.readFile(abs, "utf8")).toLowerCase();
			const enNombre = path.basename(abs).toLowerCase().includes(q);
			const idx = contenido.indexOf(q);
			if (enNombre || idx !== -1) {
				let extracto;
				if (idx !== -1) {
					const ini = Math.max(0, idx - 40);
					extracto = contenido.slice(ini, idx + q.length + 40).replace(/\s+/g, " ").trim();
				}
				out.push({ ruta: rel(vault, abs), extracto });
			}
		});
	}
	return out.slice(0, limite);
}

// ---------------------------------------------------------------------------
// Helpers de escritura (secciones / enlaces)
// ---------------------------------------------------------------------------

async function appendToSection(fileAbs, heading, linea) {
	const content = await fs.readFile(fileAbs, "utf8");
	const lines = content.split("\n");
	const idx = lines.findIndex((l) => l.trim() === heading);
	let nuevo;
	if (idx === -1) {
		nuevo = content.replace(/\s+$/, "") + `\n\n${heading}\n\n${linea}\n`;
	} else {
		let fin = lines.length;
		for (let i = idx + 1; i < lines.length; i++) {
			if (/^#{1,6}\s/.test(lines[i])) {
				fin = i;
				break;
			}
		}
		let insertarEn = fin;
		while (insertarEn > idx + 1 && lines[insertarEn - 1].trim() === "") insertarEn--;
		lines.splice(insertarEn, 0, linea);
		nuevo = lines.join("\n");
	}
	await fs.writeFile(fileAbs, nuevo, "utf8");
}

async function quitarLineaConEnlace(fileAbs, base) {
	if (!(await esArchivo(fileAbs))) return;
	const content = await fs.readFile(fileAbs, "utf8");
	const nuevo = content
		.split("\n")
		.filter((l) => !l.includes(`[[${base}]]`) && !l.includes(`[[${base}|`))
		.join("\n");
	await fs.writeFile(fileAbs, nuevo, "utf8");
}

function reemplazarEnlace(content, oldSlug, newSlug) {
	return content.split(`[[${oldSlug}]]`).join(`[[${newSlug}]]`).split(`[[${oldSlug}|`).join(`[[${newSlug}|`);
}

async function actualizarH1(abs, nuevoNombre) {
	const content = await fs.readFile(abs, "utf8");
	const lines = content.split("\n");
	const i = lines.findIndex((l) => /^#\s+/.test(l));
	if (i !== -1) {
		lines[i] = `# ${nuevoNombre}`;
		await fs.writeFile(abs, lines.join("\n"), "utf8");
	}
}

async function notasDescendientesMd(carpetaAbs) {
	const out = [];
	await recorrer(carpetaAbs, (abs) => {
		if (abs.endsWith(".md")) out.push(abs);
	});
	return out;
}

async function nombreDe(abs) {
	try {
		const { data } = await leerMd(abs);
		if (data.nombre) return String(data.nombre);
	} catch {}
	return path.basename(abs).replace(/\.md$/, "");
}

// ---------------------------------------------------------------------------
// Creación
// ---------------------------------------------------------------------------

export async function crearEpica(vault, nombre) {
	const [root] = await rootsEpicas(vault);
	await fs.mkdir(root.abs, { recursive: true });
	const slug = await slugCarpetaLibre(root.abs, slugify(nombre));
	const carpeta = path.join(root.abs, slug);
	await fs.mkdir(carpeta, { recursive: true });
	const fileAbs = path.join(carpeta, `${slug}.md`);
	await fs.writeFile(fileAbs, tpl.epica(nombre, hoy()), "utf8");
	return { slug, nombre, ruta: rel(vault, fileAbs) };
}

export async function crearHistoria(vault, epicaRef, nombre) {
	const epica = await resolverEpica(vault, epicaRef);
	const dir = await carpetaHistorias(epica);
	await fs.mkdir(dir, { recursive: true });
	const slug = await slugCarpetaLibre(dir, slugify(nombre));
	const carpeta = path.join(dir, slug);
	await fs.mkdir(carpeta, { recursive: true });
	const fileAbs = path.join(carpeta, `${slug}.md`);
	await fs.writeFile(fileAbs, tpl.historia(nombre, epica.slug, hoy()), "utf8");
	return { slug, nombre, ruta: rel(vault, fileAbs) };
}

export async function crearTarea(vault, epicaRef, historiaRef, nombre) {
	const c = await resolverContenedor(vault, epicaRef, historiaRef);
	const dir = path.join(c.folder, "tareas");
	await fs.mkdir(dir, { recursive: true });
	const slug = await slugArchivoLibre(dir, slugify(nombre));
	const fileAbs = path.join(dir, `${slug}.md`);
	await fs.writeFile(fileAbs, tpl.tarea(nombre, c.slug, hoy()), "utf8");
	await appendToSection(c.file, "## Tareas", `- [ ] [[${slug}|${nombre}]]`);
	return { slug, nombre, ruta: rel(vault, fileAbs) };
}

export async function crearPendiente(vault, epicaRef, historiaRef, nombre) {
	const c = await resolverContenedor(vault, epicaRef, historiaRef);
	const dir = path.join(c.folder, "pendientes");
	await fs.mkdir(dir, { recursive: true });
	const fecha = hoy();
	const slug = await slugArchivoLibre(dir, slugify(nombre));
	const fileAbs = path.join(dir, `${slug}.md`);
	await fs.writeFile(fileAbs, tpl.pendiente(nombre, c.slug, fecha), "utf8");
	await appendToSection(c.file, "## Pendientes", `- [ ] [[${slug}|${nombre}]] — ${fecha}`);
	return { slug, nombre, ruta: rel(vault, fileAbs) };
}

async function resolverTipo(tipos, tipoNombre, etiqueta) {
	const t = tipos.find((x) => x.nombre.toLowerCase() === String(tipoNombre).toLowerCase());
	if (!t) {
		const nombres = tipos.map((x) => `"${x.nombre}"`).join(", ") || "(ninguno)";
		throw new Error(`No existe el tipo de ${etiqueta} "${tipoNombre}". Tipos: ${nombres}.`);
	}
	return t;
}

export async function crearIncidencia(vault, epicaRef, historiaRef, tipoNombre, nombre, descripcion, colaboradores) {
	const c = await resolverContenedor(vault, epicaRef, historiaRef);
	const tipo = await resolverTipo(await tiposIncidencia(vault), tipoNombre, "incidencia");
	const tipoSlug = slugify(tipo.nombre);
	const dir = path.join(c.folder, tipoSlug);
	await fs.mkdir(dir, { recursive: true });
	const base = await slugArchivoLibre(dir, slugify(nombre));
	const fileAbs = path.join(dir, `${base}.md`);
	await fs.writeFile(fileAbs, tpl.incidencia(nombre, c.slug, hoy(), tipoSlug, descripcion || ""), "utf8");
	await appendToSection(c.file, `## ${tipo.nombre}`, `- [ ] [[${base}|${nombre}]]`);
	if (Array.isArray(colaboradores) && colaboradores.length > 0) {
		await actualizarFrontmatter(fileAbs, (d) => {
			d.asignados = [...colaboradores].sort((a, b) => a.localeCompare(b, "es"));
		});
	}
	return { tipo: tipo.nombre, nombre, ruta: rel(vault, fileAbs) };
}

export async function crearDocumento(vault, epicaRef, tipoNombre, nombre, descripcion) {
	const epica = await resolverEpica(vault, epicaRef);
	const tipo = await resolverTipo(await tiposDocumento(vault), tipoNombre, "documento");
	const tipoSlug = slugify(tipo.nombre);
	const dir = path.join(epica.folder, tipoSlug);
	await fs.mkdir(dir, { recursive: true });
	const base = await slugArchivoLibre(dir, slugify(nombre));
	const fileAbs = path.join(dir, `${base}.md`);
	await fs.writeFile(fileAbs, tpl.incidencia(nombre, epica.slug, hoy(), tipoSlug, descripcion || ""), "utf8");
	await appendToSection(epica.file, `## ${tipo.nombre}`, `- [ ] [[${base}|${nombre}]]`);
	return { tipo: tipo.nombre, nombre, ruta: rel(vault, fileAbs) };
}

// ---------------------------------------------------------------------------
// Edición: estado, colaboradores, etiquetas, sprint
// ---------------------------------------------------------------------------

export async function cambiarEstado(vault, rutaRel, estado) {
	const abs = absDe(vault, rutaRel);
	if (!(await esArchivo(abs))) throw new Error(`No existe la nota: ${rutaRel}`);
	await actualizarFrontmatter(abs, (d) => {
		d.estado = estado;
	});
	return { ruta: rutaRel, estado };
}

export async function asignarColaborador(vault, rutaRel, colaboradores) {
	const abs = absDe(vault, rutaRel);
	if (!(await esArchivo(abs))) throw new Error(`No existe la nota: ${rutaRel}`);
	const lista = (colaboradores || []).map(String).sort((a, b) => a.localeCompare(b, "es"));
	await actualizarFrontmatter(abs, (d) => {
		if (lista.length > 0) d.asignados = lista;
		else delete d.asignados;
	});
	return { ruta: rutaRel, asignados: lista };
}

export async function etiquetarHistoria(vault, rutaRel, etiquetas) {
	const abs = absDe(vault, rutaRel);
	if (!(await esArchivo(abs))) throw new Error(`No existe la nota: ${rutaRel}`);
	const lista = (etiquetas || []).map(String);
	await actualizarFrontmatter(abs, (d) => {
		d.etiquetas = lista;
	});
	return { ruta: rutaRel, etiquetas: lista };
}

export async function asignarSprint(vault, rutaRel, anio, sprint) {
	const abs = absDe(vault, rutaRel);
	if (!(await esArchivo(abs))) throw new Error(`No existe la nota: ${rutaRel}`);
	await actualizarFrontmatter(abs, (d) => {
		if (sprint === null || sprint === undefined) {
			delete d.sprint;
			delete d["año"];
			delete d.anio;
		} else {
			d.sprint = sprint;
			d["año"] = anio;
			delete d.anio;
		}
	});
	return { ruta: rutaRel, anio, sprint };
}

// ---------------------------------------------------------------------------
// Renombrar (épica/historia actualiza relaciones; incidencia/documento renombra el .md)
// ---------------------------------------------------------------------------

export async function renombrar(vault, rutaRel, nuevoNombre) {
	const abs = absDe(vault, rutaRel);
	if (!(await esArchivo(abs))) throw new Error(`No existe la nota: ${rutaRel}`);
	const parent = path.dirname(abs);
	const base = path.basename(abs).replace(/\.md$/, "");
	const esPrincipal = base === path.basename(parent);

	if (esPrincipal) {
		// Épica o historia: actualiza nombre/H1, enlaces de hijos y renombra carpeta.
		await actualizarFrontmatter(abs, (d) => {
			d.nombre = nuevoNombre;
		});
		await actualizarH1(abs, nuevoNombre);
		const abuelo = path.dirname(parent);
		const deseado = slugify(nuevoNombre);
		if (!deseado || deseado === base) return { ruta: rutaRel, nombre: nuevoNombre };
		const nuevoSlug = await slugCarpetaLibre(abuelo, deseado);
		for (const f of await notasDescendientesMd(parent)) {
			const c = await fs.readFile(f, "utf8");
			await fs.writeFile(f, reemplazarEnlace(c, base, nuevoSlug), "utf8");
		}
		const mainNuevo = path.join(parent, `${nuevoSlug}.md`);
		await fs.rename(abs, mainNuevo);
		const carpetaNueva = path.join(abuelo, nuevoSlug);
		await fs.rename(parent, carpetaNueva);
		return { ruta: rel(vault, path.join(carpetaNueva, `${nuevoSlug}.md`)), nombre: nuevoNombre };
	}

	// Incidencia/documento/tarea/pendiente: nombre/H1 + slug del .md.
	await actualizarFrontmatter(abs, (d) => {
		d.nombre = nuevoNombre;
	});
	await actualizarH1(abs, nuevoNombre);
	const deseado = slugify(nuevoNombre);
	if (!deseado || deseado === base) return { ruta: rutaRel, nombre: nuevoNombre };
	const nuevo = await slugArchivoLibre(parent, deseado);
	const destino = path.join(parent, `${nuevo}.md`);
	await fs.rename(abs, destino);
	return { ruta: rel(vault, destino), nombre: nuevoNombre };
}

// ---------------------------------------------------------------------------
// Eliminar (mueve a la papelera local del vault: .trash)
// ---------------------------------------------------------------------------

async function aPapelera(vault, abs) {
	const trash = path.join(vault.ruta, ".trash");
	await fs.mkdir(trash, { recursive: true });
	let destino = path.join(trash, path.basename(abs));
	let n = 2;
	while (await existeAlgo(destino)) {
		const ext = abs.endsWith(".md") ? ".md" : "";
		destino = path.join(trash, `${path.basename(abs).replace(/\.md$/, "")}-${n}${ext}`);
		n++;
	}
	await fs.rename(abs, destino);
	return rel(vault, destino);
}
async function existeAlgo(p) {
	return (await esArchivo(p)) || (await esDir(p));
}

export async function eliminar(vault, rutaRel) {
	const abs = absDe(vault, rutaRel);
	const parent = path.dirname(abs);
	const base = path.basename(abs).replace(/\.md$/, "");
	const esPrincipal = (await esArchivo(abs)) && base === path.basename(parent);
	if (esPrincipal) {
		// Épica o historia: se elimina toda la carpeta.
		const papelera = await aPapelera(vault, parent);
		return { eliminado: rutaRel, enviadoA: papelera, tipo: "carpeta" };
	}
	if (!(await esArchivo(abs))) throw new Error(`No existe la nota: ${rutaRel}`);
	// Incidencia/documento: quita el enlace del índice del contenedor y borra el .md.
	const contenedorMain = path.join(parent, "..", `${path.basename(path.dirname(parent))}.md`);
	await quitarLineaConEnlace(contenedorMain, base);
	const papelera = await aPapelera(vault, abs);
	return { eliminado: rutaRel, enviadoA: papelera, tipo: "nota" };
}

// ---------------------------------------------------------------------------
// Archivar épica (con renombre por año si hay conflicto)
// ---------------------------------------------------------------------------

export async function archivarEpica(vault, epicaRef, anio) {
	const epica = await resolverEpica(vault, epicaRef);
	if (epica.estado === "archivada") throw new Error(`"${epica.nombre}" ya está archivada.`);
	const destino = path.join(vault.ruta, CARPETA_INACTIVAS);
	await fs.mkdir(destino, { recursive: true });
	const anioFinal = anio || new Date().getFullYear();

	if (!(await existeAlgo(path.join(destino, epica.slug)))) {
		await fs.rename(epica.folder, path.join(destino, epica.slug));
		return { archivada: epica.nombre, renombrada: false };
	}
	// Conflicto: renombrar con el año + actualizar hijos.
	const nuevoNombre = `${epica.nombre} ${anioFinal}`;
	const newSlug = await slugCarpetaLibre(destino, slugify(nuevoNombre) || epica.slug);
	await actualizarFrontmatter(epica.file, (d) => {
		d.nombre = nuevoNombre;
	});
	await actualizarH1(epica.file, nuevoNombre);
	for (const f of await notasDescendientesMd(epica.folder)) {
		const c = await fs.readFile(f, "utf8");
		await fs.writeFile(f, reemplazarEnlace(c, epica.slug, newSlug), "utf8");
	}
	await fs.rename(epica.file, path.join(epica.folder, `${newSlug}.md`));
	await fs.rename(epica.folder, path.join(destino, newSlug));
	return { archivada: nuevoNombre, renombrada: true };
}

// ---------------------------------------------------------------------------
// Mover historia entre épicas
// ---------------------------------------------------------------------------

export async function moverHistoria(vault, epicaOrigenRef, historiaRef, epicaDestinoRef) {
	const historia = await resolverContenedor(vault, epicaOrigenRef, historiaRef);
	const destino = await resolverEpica(vault, epicaDestinoRef);
	const destDir = await carpetaHistorias(destino);
	await fs.mkdir(destDir, { recursive: true });
	const nuevoSlug = await slugCarpetaLibre(destDir, historia.slug);
	if (nuevoSlug !== historia.slug) {
		await fs.rename(historia.file, path.join(historia.folder, `${nuevoSlug}.md`));
	}
	const mainAbs = path.join(historia.folder, `${nuevoSlug}.md`);
	const carpetaDest = path.join(destDir, nuevoSlug);
	await fs.rename(historia.folder, carpetaDest);
	const mainDest = path.join(carpetaDest, `${nuevoSlug}.md`);
	await actualizarFrontmatter(mainDest, (d) => {
		d.epica = `[[${destino.slug}]]`;
	});
	return { historia: historia.nombre, epicaDestino: destino.nombre, ruta: rel(vault, mainDest) };
}

// ---------------------------------------------------------------------------
// Mover / reclasificar incidencia (cambia contenedor y/o tipo)
// ---------------------------------------------------------------------------

export async function moverIncidencia(vault, rutaRel, destinoEpicaRef, destinoHistoriaRef, nuevoTipoNombre) {
	const abs = absDe(vault, rutaRel);
	if (!(await esArchivo(abs))) throw new Error(`No existe la nota: ${rutaRel}`);
	const oldBase = path.basename(abs).replace(/\.md$/, "");
	const nombre = await nombreDe(abs);
	// Contenedor de origen = carpeta abuela (… /<contenedor>/<tipo>/x.md).
	const tipoDir = path.dirname(abs);
	const origenFolder = path.dirname(tipoDir);
	const origenMain = path.join(origenFolder, `${path.basename(origenFolder)}.md`);

	const destino = await resolverContenedor(vault, destinoEpicaRef, destinoHistoriaRef);
	const tipoActual = path.basename(tipoDir);
	const tipos = await tiposIncidencia(vault);
	const tipo = nuevoTipoNombre
		? await resolverTipo(tipos, nuevoTipoNombre, "incidencia")
		: { nombre: tipos.find((t) => slugify(t.nombre) === tipoActual)?.nombre || tipoActual };
	const tipoSlug = slugify(tipo.nombre);
	const destDir = path.join(destino.folder, tipoSlug);
	await fs.mkdir(destDir, { recursive: true });
	const base = await slugArchivoLibre(destDir, oldBase);
	const destPath = path.join(destDir, `${base}.md`);

	await quitarLineaConEnlace(origenMain, oldBase);
	if (destPath !== abs) await fs.rename(abs, destPath);
	await actualizarFrontmatter(destPath, (d) => {
		d.tipo = tipoSlug;
		d.historia = `[[${destino.slug}]]`;
		delete d.funcionalidad;
		d.nombre = nombre;
	});
	await actualizarH1(destPath, nombre);
	await appendToSection(destino.file, `## ${tipo.nombre}`, `- [ ] [[${base}|${nombre}]]`);
	return { nombre, tipo: tipo.nombre, ruta: rel(vault, destPath) };
}

export async function reclasificarTipo(vault, rutaRel, nuevoTipoNombre) {
	const abs = absDe(vault, rutaRel);
	const origenFolder = path.dirname(path.dirname(abs));
	// Mismo contenedor: resolvemos su épica/historia por la estructura.
	const { epicaRef, historiaRef } = await ubicacionDeContenedor(vault, origenFolder);
	return moverIncidencia(vault, rutaRel, epicaRef, historiaRef, nuevoTipoNombre);
}

/** Deduce épica (y opcionalmente historia) a partir de la carpeta de un contenedor. */
async function ubicacionDeContenedor(vault, contenedorFolderAbs) {
	const relPath = rel(vault, contenedorFolderAbs).split(path.sep);
	// relPath: ["Épicas", "<epica>"] o ["Épicas", "<epica>", "historias", "<historia>"]
	const slugEpica = relPath[1];
	const epica = await resolverEpica(vault, slugEpica);
	if (relPath.length >= 4) {
		return { epicaRef: epica.slug, historiaRef: relPath[3] };
	}
	return { epicaRef: epica.slug, historiaRef: undefined };
}

// ---------------------------------------------------------------------------
// Clasificar un .md suelto como documento
// ---------------------------------------------------------------------------

export async function clasificarDocumento(vault, rutaRel, epicaRef, tipoNombre) {
	const abs = absDe(vault, rutaRel);
	if (!(await esArchivo(abs))) throw new Error(`No existe la nota: ${rutaRel}`);
	const epica = await resolverEpica(vault, epicaRef);
	const tipo = await resolverTipo(await tiposDocumento(vault), tipoNombre, "documento");
	const tipoSlug = slugify(tipo.nombre);
	const dir = path.join(epica.folder, tipoSlug);
	await fs.mkdir(dir, { recursive: true });
	const nombre = await nombreDe(abs);
	const base = await slugArchivoLibre(dir, path.basename(abs).replace(/\.md$/, ""));
	const destPath = path.join(dir, `${base}.md`);
	if (destPath !== abs) await fs.rename(abs, destPath);
	await actualizarFrontmatter(destPath, (d) => {
		d.tipo = tipoSlug;
		d.historia = `[[${epica.slug}]]`;
		if (!d.nombre) d.nombre = nombre;
	});
	await appendToSection(epica.file, `## ${tipo.nombre}`, `- [ ] [[${base}|${nombre}]]`);
	return { documento: nombre, tipo: tipo.nombre, ruta: rel(vault, destPath) };
}

// ---------------------------------------------------------------------------
// Configuración del plugin (data.json): tipos, colaboradores, etiquetas
// ---------------------------------------------------------------------------

function listaConfig(data, clave) {
	return Array.isArray(data[clave]) ? data[clave] : [];
}

export async function listarConfig(vault, clave) {
	return listaConfig(await leerData(vault), clave);
}

export async function agregarConfig(vault, clave, nombre, color) {
	const limpio = String(nombre).trim();
	if (!limpio) throw new Error("El nombre no puede estar vacío.");
	const data = await leerData(vault);
	if (!Array.isArray(data[clave])) data[clave] = [];
	if (data[clave].some((e) => String(e.nombre).toLowerCase() === limpio.toLowerCase())) {
		throw new Error(`Ya existe "${limpio}".`);
	}
	const item = { nombre: limpio, color: color || COLOR_DEFECTO, visible: true };
	data[clave].push(item);
	await guardarData(vault, data);
	return item;
}

export async function eliminarConfig(vault, clave, nombre) {
	const data = await leerData(vault);
	const antes = listaConfig(data, clave).length;
	data[clave] = listaConfig(data, clave).filter(
		(e) => String(e.nombre).toLowerCase() !== String(nombre).toLowerCase()
	);
	if (data[clave].length === antes) throw new Error(`No encontré "${nombre}".`);
	await guardarData(vault, data);
	return { eliminado: nombre };
}
