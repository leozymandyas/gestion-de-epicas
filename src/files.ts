import { App, TFile, TFolder, normalizePath, parseYaml } from "obsidian";
import { escapeYaml, hoy, slugify } from "./utils";
import * as tpl from "./templates";
import type { Etiqueta } from "./settings";

export const COLOR_ETIQUETA_FALLBACK = "#5082ff";

/** Lee las etiquetas definidas en el frontmatter de una épica (su nota principal). */
export function leerEtiquetasEpica(app: App, epica: FuncRef): Etiqueta[] {
	const fm = app.metadataCache.getFileCache(epica.file)?.frontmatter as
		| Record<string, unknown>
		| undefined;
	if (!Array.isArray(fm?.etiquetas)) return [];
	const out: Etiqueta[] = [];
	for (const x of fm.etiquetas as unknown[]) {
		if (!x || typeof x !== "object") continue;
		const o = x as Record<string, unknown>;
		const nombre = String(o.nombre ?? "").trim();
		if (!nombre) continue;
		out.push({
			nombre,
			color: String(o.color ?? "") || COLOR_ETIQUETA_FALLBACK,
			visible: o.visible === undefined ? true : Boolean(o.visible),
		});
	}
	return out;
}

/** Escribe las etiquetas en el frontmatter de la épica. */
export async function guardarEtiquetasEpica(
	app: App,
	epica: FuncRef,
	etiquetas: Etiqueta[]
): Promise<void> {
	await app.fileManager.processFrontMatter(epica.file, (fm: Record<string, unknown>) => {
		fm.etiquetas = etiquetas.map((e) => ({
			nombre: e.nombre,
			color: e.color,
			visible: e.visible !== false,
		}));
	});
}

/** Nombres de las etiquetas asignadas a una historia (en su frontmatter). */
export function leerEtiquetasHistoria(app: App, file: TFile): string[] {
	const fm = app.metadataCache.getFileCache(file)?.frontmatter as
		| Record<string, unknown>
		| undefined;
	return Array.isArray(fm?.etiquetas) ? (fm.etiquetas as unknown[]).map(String) : [];
}

/** Guarda las etiquetas asignadas a una historia (lista de nombres). */
export async function guardarEtiquetasHistoria(
	app: App,
	file: TFile,
	nombres: string[]
): Promise<void> {
	await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
		fm.etiquetas = nombres;
	});
}

/** Sprint (y año) al que está asignada una historia, según su frontmatter. */
export function leerSprintHistoria(app: App, file: TFile): { sprint: number; anio: number } | null {
	const fm = app.metadataCache.getFileCache(file)?.frontmatter as
		| Record<string, unknown>
		| undefined;
	const sprint = Number(fm?.sprint);
	const anio = Number(fm?.["año"] ?? fm?.anio);
	if (Number.isFinite(sprint) && sprint >= 1 && Number.isFinite(anio) && anio > 0) {
		return { sprint, anio };
	}
	return null;
}

/** Asigna (o quita, con sprint null) el sprint/año de una historia en su frontmatter. */
export async function guardarSprintHistoria(
	app: App,
	file: TFile,
	sprint: number | null,
	anio: number
): Promise<void> {
	await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
		if (sprint === null) {
			delete fm.sprint;
			delete fm["año"];
			delete fm.anio;
		} else {
			fm.sprint = sprint;
			fm["año"] = anio;
			delete fm.anio;
		}
	});
}

/** Se lanza cuando ya existe una funcionalidad con el mismo slug. */
export class YaExisteError extends Error {}

/** Carpetas de gestión, fijas en la raíz del vault. */
export const CARPETA_ACTIVAS = "Épicas";
export const CARPETA_INACTIVAS = "Épicas archivadas";

/** Carpeta dentro de cada épica que contiene sus historias. */
export const CARPETA_HISTORIAS = "historias";
/** Nombre heredado de esa carpeta (se migra a "historias"). */
export const CARPETA_HISTORIAS_LEGACY = "funcionalidades";

/** Nombre de la carpeta de historias a usar en una épica: la nueva si existe, la
 * heredada si aún no se ha migrado, o la nueva por defecto. */
function nombreCarpetaHistorias(epicaFolder: TFolder): string {
	const tiene = (n: string) =>
		epicaFolder.children.some((c) => c instanceof TFolder && c.name === n);
	if (tiene(CARPETA_HISTORIAS)) return CARPETA_HISTORIAS;
	if (tiene(CARPETA_HISTORIAS_LEGACY)) return CARPETA_HISTORIAS_LEGACY;
	return CARPETA_HISTORIAS;
}

export function carpetasGestionListas(app: App): boolean {
	return (
		app.vault.getAbstractFileByPath(normalizePath(CARPETA_ACTIVAS)) instanceof TFolder &&
		app.vault.getAbstractFileByPath(normalizePath(CARPETA_INACTIVAS)) instanceof TFolder
	);
}

export async function crearCarpetasGestion(app: App): Promise<void> {
	await ensureFolder(app, CARPETA_ACTIVAS);
	await ensureFolder(app, CARPETA_INACTIVAS);
}

/** Migra la carpeta de historias heredada ("funcionalidades") a "historias" en
 * cada épica (activas y archivadas). Renombra con `renameFile` para conservar
 * los enlaces internos. Es idempotente: no hace nada si ya está migrada. */
export async function migrarCarpetasHistorias(app: App): Promise<void> {
	const epicas = [
		...listFuncionalidades(app, CARPETA_ACTIVAS),
		...listFuncionalidades(app, CARPETA_INACTIVAS),
	];
	for (const ep of epicas) {
		const legacy = ep.folder.children.find(
			(c): c is TFolder => c instanceof TFolder && c.name === CARPETA_HISTORIAS_LEGACY
		);
		const yaNueva = ep.folder.children.some(
			(c) => c instanceof TFolder && c.name === CARPETA_HISTORIAS
		);
		if (legacy && !yaNueva) {
			try {
				await app.fileManager.renameFile(
					legacy,
					normalizePath(`${ep.folder.path}/${CARPETA_HISTORIAS}`)
				);
			} catch (e) {
				console.error(e);
			}
		}
	}

	// Corrige el `tipo` heredado de las historias ("funcionalidad" → "historia").
	// Solo afecta a las notas de historia (dentro de la carpeta de historias), no
	// a las notas de épica.
	const epicas2 = [
		...listFuncionalidades(app, CARPETA_ACTIVAS),
		...listFuncionalidades(app, CARPETA_INACTIVAS),
	];
	for (const ep of epicas2) {
		for (const h of listFuncionalidadesDe(app, ep.folder)) {
			const tipo = (
				app.metadataCache.getFileCache(h.file)?.frontmatter as Record<string, unknown> | undefined
			)?.tipo;
			if (tipo === "funcionalidad") {
				try {
					await app.fileManager.processFrontMatter(h.file, (fm: Record<string, unknown>) => {
						fm.tipo = "historia";
					});
				} catch (e) {
					console.error(e);
				}
			}
		}
	}
}

/** Clave de data.json: ruta relativa a la carpeta de épicas, sin extensión .md. */
export function claveRelativa(adminPath: string, path: string): string {
	const prefijo = normalizePath(adminPath) + "/";
	const sinMd = path.endsWith(".md") ? path.slice(0, -3) : path;
	return sinMd.startsWith(prefijo) ? sinMd.slice(prefijo.length) : sinMd;
}

export interface FuncRef {
	slug: string;
	nombre: string;
	file: TFile;
	folder: TFolder;
	/** Valor de `estado` del frontmatter de la nota principal, si existe. */
	estado?: string;
}

export interface TareaRef {
	slug: string;
	nombre: string;
	file: TFile;
}

export interface PendienteRef {
	slug: string;
	nombre: string;
	file: TFile;
}

export interface Incidencia {
	/** Id del tipo: "tarea" o "pendiente". */
	tipo: string;
	/** Etiqueta legible del tipo. */
	tipoNombre: string;
	file: TFile;
	nombre: string;
	/** 0 para tareas/pendientes, 1 para sub-elementos. */
	nivel: number;
}

export async function ensureFolder(app: App, path: string): Promise<TFolder> {
	const norm = normalizePath(path);
	const existente = app.vault.getAbstractFileByPath(norm);
	if (existente instanceof TFolder) return existente;
	if (existente) throw new Error(`"${norm}" existe pero no es una carpeta.`);
	await app.vault.createFolder(norm);
	const creada = app.vault.getAbstractFileByPath(norm);
	if (!(creada instanceof TFolder)) throw new Error(`No se pudo crear la carpeta "${norm}".`);
	return creada;
}

function nombreDesdeFrontmatter(app: App, file: TFile, fallback: string): string {
	const nombre = (app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined)?.nombre;
	return nombre ? String(nombre) : fallback;
}

/** Construye un FuncRef a partir de la ruta de su carpeta (épica o funcionalidad). */
export function funcRefDesdeCarpeta(app: App, folderPath: string): FuncRef | null {
	const folder = app.vault.getAbstractFileByPath(normalizePath(folderPath));
	if (!(folder instanceof TFolder)) return null;
	const main = folder.children.find(
		(c): c is TFile => c instanceof TFile && c.extension === "md" && c.basename === folder.name
	);
	if (!main) return null;
	const fm = app.metadataCache.getFileCache(main)?.frontmatter;
	return {
		slug: folder.name,
		nombre: fm?.nombre ? String(fm.nombre) : folder.name,
		file: main,
		folder,
		estado: fm?.estado ? String(fm.estado) : undefined,
	};
}

export function listFuncionalidades(app: App, adminPath: string): FuncRef[] {
	const root = app.vault.getAbstractFileByPath(normalizePath(adminPath));
	if (!(root instanceof TFolder)) return [];
	const out: FuncRef[] = [];
	for (const child of root.children) {
		if (!(child instanceof TFolder)) continue;
		const main = child.children.find(
			(c): c is TFile => c instanceof TFile && c.extension === "md" && c.basename === child.name
		);
		if (!main) continue;
		const fm = app.metadataCache.getFileCache(main)?.frontmatter;
		out.push({
			slug: child.name,
			nombre: fm?.nombre ? String(fm.nombre) : child.name,
			file: main,
			folder: child,
			estado: fm?.estado ? String(fm.estado) : undefined,
		});
	}
	return out.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/**
 * Funcionalidades de una épica: carpetas dentro de <épica>/funcionalidades/.
 * Comparten la forma de FuncRef, así que las operaciones de incidencias
 * funcionan igual a nivel de funcionalidad.
 */
export function listFuncionalidadesDe(app: App, epicaFolder: TFolder): FuncRef[] {
	const dir = epicaFolder.children.find(
		(c): c is TFolder =>
			c instanceof TFolder &&
			(c.name === CARPETA_HISTORIAS || c.name === CARPETA_HISTORIAS_LEGACY)
	);
	if (!dir) return [];
	const out: FuncRef[] = [];
	for (const child of dir.children) {
		if (!(child instanceof TFolder)) continue;
		const main = child.children.find(
			(c): c is TFile => c instanceof TFile && c.extension === "md" && c.basename === child.name
		);
		if (!main) continue;
		const fm = app.metadataCache.getFileCache(main)?.frontmatter;
		out.push({
			slug: child.name,
			nombre: fm?.nombre ? String(fm.nombre) : child.name,
			file: main,
			folder: child,
			estado: fm?.estado ? String(fm.estado) : undefined,
		});
	}
	return out.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export async function createFuncionalidadEn(
	app: App,
	epica: FuncRef,
	nombre: string
): Promise<TFile> {
	const slug = slugify(nombre);
	const carpeta = nombreCarpetaHistorias(epica.folder);
	await ensureFolder(app, `${epica.folder.path}/${carpeta}`);
	const fnPath = normalizePath(`${epica.folder.path}/${carpeta}/${slug}`);
	if (app.vault.getAbstractFileByPath(fnPath)) throw new YaExisteError();
	await app.vault.createFolder(fnPath);
	return app.vault.create(
		`${fnPath}/${slug}.md`,
		tpl.funcionalidadNueva(nombre, epica.slug, hoy())
	);
}

export function listTareas(app: App, funcFolder: TFolder): TareaRef[] {
	const dir = funcFolder.children.find(
		(c): c is TFolder => c instanceof TFolder && c.name === "tareas"
	);
	if (!dir) return [];
	const out: TareaRef[] = [];
	for (const child of dir.children) {
		if (child instanceof TFile && child.extension === "md") {
			out.push({
				slug: child.basename,
				nombre: nombreDesdeFrontmatter(app, child, child.basename),
				file: child,
			});
		}
	}
	return out.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/** Pendientes: archivo plano en formato actual. */
export function listPendientes(app: App, funcFolder: TFolder): PendienteRef[] {
	const dir = funcFolder.children.find(
		(c): c is TFolder => c instanceof TFolder && c.name === "pendientes"
	);
	if (!dir) return [];
	const out: PendienteRef[] = [];
	for (const child of dir.children) {
		if (child instanceof TFile && child.extension === "md") {
			out.push({
				slug: child.basename,
				nombre: nombreDesdeFrontmatter(app, child, child.basename),
				file: child,
			});
		}
	}
	return out.sort((a, b) => a.slug.localeCompare(b.slug, "es"));
}

/**
 * Todas las incidencias de una épica: tareas y pendientes (carpetas heredadas)
 * más las de cada tipo de incidencia configurado (su carpeta = slug del tipo).
 */
export function listIncidencias(
	app: App,
	func: FuncRef,
	tipos: { nombre: string }[] = []
): Incidencia[] {
	const out: Incidencia[] = [];
	for (const t of listTareas(app, func.folder)) {
		out.push({ tipo: "tarea", tipoNombre: "Tarea", file: t.file, nombre: t.nombre, nivel: 0 });
	}
	for (const p of listPendientes(app, func.folder)) {
		out.push({
			tipo: "pendiente",
			tipoNombre: "Pendiente",
			file: p.file,
			nombre: p.nombre,
			nivel: 0,
		});
	}
	for (const tipo of tipos) {
		const slug = slugify(tipo.nombre);
		const dir = func.folder.children.find(
			(c): c is TFolder => c instanceof TFolder && c.name === slug
		);
		if (!dir) continue;
		for (const child of dir.children) {
			if (child instanceof TFile && child.extension === "md") {
				out.push({
					tipo: slug,
					tipoNombre: tipo.nombre,
					file: child,
					nombre: nombreDesdeFrontmatter(app, child, child.basename),
					nivel: 0,
				});
			}
		}
	}
	return out;
}

/** Colaboradores asignados en el frontmatter `asignados` de una incidencia. */
export function getAsignados(app: App, file: TFile): string[] {
	const valor = (app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined)?.asignados;
	return Array.isArray(valor) ? valor.map(String) : [];
}

/** ¿Existe ya un archivo .md o una carpeta con ese slug dentro de dir? */
export function existeEnDir(app: App, dir: string, slug: string): boolean {
	return (
		!!app.vault.getAbstractFileByPath(normalizePath(`${dir}/${slug}.md`)) ||
		!!app.vault.getAbstractFileByPath(normalizePath(`${dir}/${slug}`))
	);
}

/** Devuelve el slug libre más cercano agregando sufijo numérico: slug, slug-2, slug-3… */
export function slugDisponible(app: App, dir: string, slug: string): string {
	if (!existeEnDir(app, dir, slug)) return slug;
	let n = 2;
	while (existeEnDir(app, dir, `${slug}-${n}`)) n++;
	return `${slug}-${n}`;
}

/** Inserta una línea al final de la sección indicada (antes del siguiente encabezado). */
export async function appendToSection(
	app: App,
	file: TFile,
	heading: string,
	linea: string
): Promise<void> {
	await app.vault.process(file, (content) => {
		const lines = content.split("\n");
		const idx = lines.findIndex((l) => l.trim() === heading);
		if (idx === -1) {
			return content.trimEnd() + `\n\n${heading}\n\n${linea}\n`;
		}
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
		return lines.join("\n");
	});
}

export async function createFuncionalidad(
	app: App,
	adminPath: string,
	nombre: string
): Promise<TFile> {
	const slug = slugify(nombre);
	await ensureFolder(app, adminPath);
	const funcPath = normalizePath(`${adminPath}/${slug}`);
	if (app.vault.getAbstractFileByPath(funcPath)) throw new YaExisteError();
	await app.vault.createFolder(funcPath);
	// Ninguna subcarpeta existe por defecto: tareas/ y pendientes/ se crean al
	// crear su primer elemento.
	return app.vault.create(`${funcPath}/${slug}.md`, tpl.funcionalidad(nombre, hoy()));
}

export async function createTarea(
	app: App,
	func: FuncRef,
	slug: string,
	nombre: string
): Promise<TFile> {
	await ensureFolder(app, `${func.folder.path}/tareas`);
	const dirTarea = normalizePath(`${func.folder.path}/tareas`);
	const file = await app.vault.create(
		`${dirTarea}/${slug}.md`,
		tpl.tarea(nombre, func.slug, hoy())
	);
	await appendToSection(app, func.file, "## Tareas", `- [ ] [[${slug}|${nombre}]]`);
	return file;
}

/** Crea una incidencia de un tipo configurable: nota en su carpeta (slug del
 * tipo) + enlace en la sección de ese tipo de la nota principal. */
export async function createIncidencia(
	app: App,
	func: FuncRef,
	base: string,
	nombre: string,
	tipoSlug: string,
	tipoNombre: string
): Promise<TFile> {
	const dir = `${func.folder.path}/${tipoSlug}`;
	await ensureFolder(app, dir);
	const file = await app.vault.create(
		normalizePath(`${dir}/${base}.md`),
		tpl.incidencia(nombre, func.slug, hoy(), tipoSlug)
	);
	await appendToSection(app, func.file, `## ${tipoNombre}`, `- [ ] [[${base}|${nombre}]]`);
	return file;
}

/** Una etiqueta asignada a un sprint, con su número de colaboradores opcional. */
export interface EtiquetaSprint {
	nombre: string;
	/** Número de colaboradores (👤); ausente o 0 = no se muestra. */
	num?: number;
}

export interface SprintAsignado {
	anio: number;
	sprint: number;
	/** Etiquetas del sprint; cada una con su número de colaboradores opcional. */
	etiquetas: EtiquetaSprint[];
}

export function archivoSprints(app: App, func: FuncRef): TFile | null {
	const f = app.vault.getAbstractFileByPath(normalizePath(`${func.folder.path}/sprints.md`));
	return f instanceof TFile ? f : null;
}

/** Lee las asignaciones de sprints.md (el frontmatter YAML es la fuente de verdad). */
export async function leerSprints(app: App, func: FuncRef): Promise<SprintAsignado[]> {
	const file = archivoSprints(app, func);
	if (!file) return [];
	const contenido = await app.vault.cachedRead(file);
	const m = contenido.match(/^---\n([\s\S]*?)\n---/);
	if (!m) return [];
	let fm: unknown;
	try {
		fm = parseYaml(m[1]);
	} catch {
		return [];
	}
	const lista = (fm as { sprints?: unknown } | null)?.sprints;
	if (!Array.isArray(lista)) return [];
	const out: SprintAsignado[] = [];
	for (const entrada of lista) {
		if (!entrada || typeof entrada !== "object") continue;
		const reg = entrada as Record<string, unknown>;
		const anio = Number(reg["año"] ?? reg["anio"]);
		const sprint = Number(reg["sprint"]);
		// Compatibilidad: formato antiguo (etiquetas: string[] + numElementos único).
		const numLegacy = Number(reg["numElementos"] ?? reg["num"]);
		const numSprintLegacy = Number.isFinite(numLegacy) && numLegacy > 0 ? numLegacy : undefined;
		const etiquetas: EtiquetaSprint[] = Array.isArray(reg["etiquetas"])
			? (reg["etiquetas"] as unknown[])
					.map((x): EtiquetaSprint | null => {
						if (x && typeof x === "object") {
							const o = x as Record<string, unknown>;
							const nombre = String(o.nombre ?? "").trim();
							const nv = Number(o.num);
							return nombre
								? { nombre, num: Number.isFinite(nv) && nv > 0 ? nv : undefined }
								: null;
						}
						const nombre = String(x).trim();
						return nombre ? { nombre, num: numSprintLegacy } : null;
					})
					.filter((e): e is EtiquetaSprint => e !== null)
			: [];
		if (Number.isFinite(anio) && anio > 0 && sprint >= 1) {
			out.push({ anio, sprint, etiquetas });
		}
	}
	return out;
}

/** Regenera sprints.md completo (frontmatter + tabla legible por año). */
export async function guardarSprints(
	app: App,
	func: FuncRef,
	sprints: SprintAsignado[]
): Promise<TFile> {
	const orden = [...sprints].sort((a, b) => a.anio - b.anio || a.sprint - b.sprint);
	const lineas: string[] = ["---", "tipo: sprints", `epica: "[[${func.slug}]]"`];
	if (orden.length === 0) {
		lineas.push("sprints: []");
	} else {
		lineas.push("sprints:");
		for (const s of orden) {
			lineas.push(`  - año: ${s.anio}`);
			lineas.push(`    sprint: ${s.sprint}`);
			if (s.etiquetas.length === 0) {
				lineas.push(`    etiquetas: []`);
			} else {
				lineas.push(`    etiquetas:`);
				for (const et of s.etiquetas) {
					const numPart = et.num && et.num > 0 ? `, num: ${et.num}` : "";
					lineas.push(`      - { nombre: "${escapeYaml(et.nombre)}"${numPart} }`);
				}
			}
		}
	}
	lineas.push("---", "", `# Sprints — ${func.nombre}`, "");
	if (orden.length === 0) {
		lineas.push("| Sprint | Etiquetas |", "|---|---|", "");
	} else {
		for (const anio of [...new Set(orden.map((s) => s.anio))]) {
			lineas.push(`## ${anio}`, "", "| Sprint | Etiquetas |", "|---|---|");
			for (const s of orden.filter((x) => x.anio === anio)) {
				const cels = s.etiquetas.map((e) =>
					e.num && e.num > 0 ? `${e.nombre} (${e.num})` : e.nombre
				);
				lineas.push(`| Sprint ${s.sprint} | ${cels.join(", ")} |`);
			}
			lineas.push("");
		}
	}
	const contenido = lineas.join("\n");
	const existente = archivoSprints(app, func);
	if (existente) {
		await app.vault.process(existente, () => contenido);
		return existente;
	}
	return app.vault.create(normalizePath(`${func.folder.path}/sprints.md`), contenido);
}

export async function createPendiente(
	app: App,
	func: FuncRef,
	base: string,
	nombre: string,
	fecha: string
): Promise<TFile> {
	await ensureFolder(app, `${func.folder.path}/pendientes`);
	const dirPend = normalizePath(`${func.folder.path}/pendientes`);
	const file = await app.vault.create(
		`${dirPend}/${base}.md`,
		tpl.pendiente(nombre, func.slug, fecha)
	);
	// appendToSection crea la sección ## Pendientes si la nota principal no la tiene.
	await appendToSection(app, func.file, "## Pendientes", `- [ ] [[${base}|${nombre}]] — ${fecha}`);
	return file;
}

// ===== Renombrado de épicas/historias y propagación de etiquetas =====

/** Todas las funcionalidades gestionadas: épicas y sus historias. */
export function listTodasFunc(app: App, adminPath: string): FuncRef[] {
	const out: FuncRef[] = [];
	for (const ep of listFuncionalidades(app, adminPath)) {
		out.push(ep);
		out.push(...listFuncionalidadesDe(app, ep.folder));
	}
	return out;
}

/** Reemplaza el primer encabezado H1 de una nota por `# nuevoNombre`. */
async function actualizarH1(app: App, file: TFile, nuevoNombre: string): Promise<void> {
	await app.vault.process(file, (content) => {
		const lines = content.split("\n");
		const i = lines.findIndex((l) => /^#\s+/.test(l));
		if (i !== -1) lines[i] = `# ${nuevoNombre}`;
		return lines.join("\n");
	});
}

/** Devuelve un slug de carpeta libre dentro de `dir` (sufijo -2, -3…). */
function slugCarpetaLibre(app: App, dir: string, slug: string): string {
	const existe = (s: string) => !!app.vault.getAbstractFileByPath(normalizePath(`${dir}/${s}`));
	if (!existe(slug)) return slug;
	let n = 2;
	while (existe(`${slug}-${n}`)) n++;
	return `${slug}-${n}`;
}

/** Devuelve un nombre de archivo .md libre dentro de `dir` (sufijo -2, -3…). */
function slugArchivoLibre(app: App, dir: string, slug: string): string {
	return slugArchivoLibreExcepto(app, dir, slug, "");
}

/** Como `slugArchivoLibre`, pero ignora el archivo en `exceptoPath` (para
 * renombrar/mover un .md sin que choque consigo mismo). */
function slugArchivoLibreExcepto(app: App, dir: string, slug: string, exceptoPath: string): string {
	const existe = (s: string) => {
		const p = normalizePath(`${dir}/${s}.md`);
		return p !== exceptoPath && !!app.vault.getAbstractFileByPath(p);
	};
	if (!existe(slug)) return slug;
	let n = 2;
	while (existe(`${slug}-${n}`)) n++;
	return `${slug}-${n}`;
}

/** Renombra una épica/historia: actualiza el `nombre`/H1 y también la carpeta y
 * la nota principal (slug) para que coincidan con el nuevo nombre. Usa
 * `renameFile`, que actualiza los enlaces internos que apuntan a ellas. */
export async function renombrarFuncionalidad(
	app: App,
	ref: FuncRef,
	nuevoNombre: string
): Promise<void> {
	await app.fileManager.processFrontMatter(ref.file, (fm: Record<string, unknown>) => {
		fm.nombre = nuevoNombre;
	});
	await actualizarH1(app, ref.file, nuevoNombre);

	const parent = ref.folder.parent;
	const deseado = slugify(nuevoNombre);
	if (!parent || !deseado || deseado === ref.slug) return;
	const nuevoSlug = slugCarpetaLibre(app, parent.path, deseado);
	// Primero la nota principal (se mueve con la carpeta al renombrarla después).
	await app.fileManager.renameFile(ref.file, normalizePath(`${ref.folder.path}/${nuevoSlug}.md`));
	await app.fileManager.renameFile(ref.folder, normalizePath(`${parent.path}/${nuevoSlug}`));
}

/** Renombra una incidencia: actualiza `nombre`/H1 y el archivo .md (slug). */
export async function renombrarIncidencia(
	app: App,
	file: TFile,
	nuevoNombre: string
): Promise<void> {
	await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
		fm.nombre = nuevoNombre;
	});
	await actualizarH1(app, file, nuevoNombre);
	const dir = file.parent;
	const deseado = slugify(nuevoNombre);
	if (!dir || !deseado || deseado === file.basename) return;
	const nuevo = slugArchivoLibre(app, dir.path, deseado);
	await app.fileManager.renameFile(file, normalizePath(`${dir.path}/${nuevo}.md`));
}

/** Reemplaza el encabezado `## anterior` por `## nuevo` en una nota. */
async function renombrarSeccion(
	app: App,
	file: TFile,
	anterior: string,
	nuevo: string
): Promise<void> {
	await app.vault.process(file, (content) => {
		const lines = content.split("\n");
		for (let i = 0; i < lines.length; i++) {
			if (lines[i].trim() === `## ${anterior}`) lines[i] = `## ${nuevo}`;
		}
		return lines.join("\n");
	});
}

/** Etiquetas de sprint: actualiza el nombre en todos los sprints.md. */
export async function renombrarEtiquetaSprint(
	app: App,
	adminPath: string,
	anterior: string,
	nuevo: string
): Promise<void> {
	for (const f of listTodasFunc(app, adminPath)) {
		const sprints = await leerSprints(app, f);
		let cambio = false;
		for (const s of sprints) {
			for (const e of s.etiquetas) if (e.nombre === anterior) {
				e.nombre = nuevo;
				cambio = true;
			}
		}
		if (cambio) await guardarSprints(app, f, sprints);
	}
}

export async function eliminarEtiquetaSprint(
	app: App,
	adminPath: string,
	nombre: string
): Promise<void> {
	for (const f of listTodasFunc(app, adminPath)) {
		const sprints = await leerSprints(app, f);
		let cambio = false;
		for (const s of sprints) {
			const antes = s.etiquetas.length;
			s.etiquetas = s.etiquetas.filter((e) => e.nombre !== nombre);
			if (s.etiquetas.length !== antes) cambio = true;
		}
		if (cambio) await guardarSprints(app, f, sprints);
	}
}

/** Colaboradores: actualiza el frontmatter `asignados` de todas las incidencias. */
export async function renombrarColaborador(
	app: App,
	adminPath: string,
	tipos: { nombre: string }[],
	anterior: string,
	nuevo: string
): Promise<void> {
	for (const f of listTodasFunc(app, adminPath)) {
		for (const inc of listIncidencias(app, f, tipos)) {
			const asign = getAsignados(app, inc.file);
			if (!asign.includes(anterior)) continue;
			const nuevos = [...new Set(asign.map((a) => (a === anterior ? nuevo : a)))].sort((a, b) =>
				a.localeCompare(b, "es")
			);
			await app.fileManager.processFrontMatter(inc.file, (fm: Record<string, unknown>) => {
				fm.asignados = nuevos;
			});
		}
	}
}

export async function eliminarColaborador(
	app: App,
	adminPath: string,
	tipos: { nombre: string }[],
	nombre: string
): Promise<void> {
	for (const f of listTodasFunc(app, adminPath)) {
		for (const inc of listIncidencias(app, f, tipos)) {
			const asign = getAsignados(app, inc.file);
			if (!asign.includes(nombre)) continue;
			await app.fileManager.processFrontMatter(inc.file, (fm: Record<string, unknown>) => {
				fm.asignados = asign.filter((a) => a !== nombre);
			});
		}
	}
}

/** Etiquetas de épica: actualiza el frontmatter `etiquetas` de sus historias. */
export async function renombrarEtiquetaHistoria(
	app: App,
	epica: FuncRef,
	anterior: string,
	nuevo: string
): Promise<void> {
	for (const h of listFuncionalidadesDe(app, epica.folder)) {
		const etqs = leerEtiquetasHistoria(app, h.file);
		if (etqs.includes(anterior)) {
			await guardarEtiquetasHistoria(app, h.file, etqs.map((e) => (e === anterior ? nuevo : e)));
		}
	}
}

export async function eliminarEtiquetaHistoria(
	app: App,
	epica: FuncRef,
	nombre: string
): Promise<void> {
	for (const h of listFuncionalidadesDe(app, epica.folder)) {
		const etqs = leerEtiquetasHistoria(app, h.file);
		if (etqs.includes(nombre)) {
			await guardarEtiquetasHistoria(app, h.file, etqs.filter((e) => e !== nombre));
		}
	}
}

/** Tipos de incidencia: renombra la carpeta (slug) que las contiene, actualiza el
 * frontmatter `tipo` de cada nota y el encabezado de sección de la nota principal. */
export async function renombrarTipoIncidencia(
	app: App,
	adminPath: string,
	anterior: string,
	nuevo: string
): Promise<void> {
	const slugAnt = slugify(anterior);
	const slugNue = slugify(nuevo);
	for (const f of listTodasFunc(app, adminPath)) {
		const dir = f.folder.children.find(
			(c): c is TFolder => c instanceof TFolder && c.name === slugAnt
		);
		if (!dir) continue;
		for (const child of dir.children) {
			if (child instanceof TFile && child.extension === "md") {
				await app.fileManager.processFrontMatter(child, (fm: Record<string, unknown>) => {
					fm.tipo = slugNue;
				});
			}
		}
		await renombrarSeccion(app, f.file, anterior, nuevo);
		if (slugNue !== slugAnt) {
			const destino = normalizePath(`${f.folder.path}/${slugNue}`);
			if (!app.vault.getAbstractFileByPath(destino)) {
				await app.fileManager.renameFile(dir, destino);
			}
		}
	}
}

// ===== Mover historias e incidencias =====

/** Mueve una historia a otra épica: traslada su carpeta (con sus incidencias) a
 * `<destino>/funcionalidades/` y actualiza su referencia `epica`. */
export async function moverHistoriaAEpica(
	app: App,
	historia: FuncRef,
	destino: FuncRef
): Promise<void> {
	const destDir = `${destino.folder.path}/${nombreCarpetaHistorias(destino.folder)}`;
	await ensureFolder(app, destDir);
	const nuevoSlug = slugCarpetaLibre(app, destDir, historia.slug);
	if (nuevoSlug !== historia.slug) {
		await app.fileManager.renameFile(
			historia.file,
			normalizePath(`${historia.folder.path}/${nuevoSlug}.md`)
		);
	}
	await app.fileManager.renameFile(historia.folder, normalizePath(`${destDir}/${nuevoSlug}`));
	await app.fileManager.processFrontMatter(historia.file, (fm: Record<string, unknown>) => {
		fm.epica = `[[${destino.slug}]]`;
	});
}

/** Quita del cuerpo de una nota las líneas que enlazan a `[[base]]`/`[[base|…]]`. */
async function quitarLineaConEnlace(app: App, file: TFile, base: string): Promise<void> {
	await app.vault.process(file, (content) => {
		const lines = content.split("\n");
		return lines
			.filter((l) => !l.includes(`[[${base}]]`) && !l.includes(`[[${base}|`))
			.join("\n");
	});
}

/** Cambia el tipo de una incidencia y/o la mueve a otra épica/historia: traslada
 * el .md a la carpeta del tipo destino dentro de la func destino, actualiza
 * `tipo`/`funcionalidad` y los índices de las notas principales. */
export async function moverIncidencia(
	app: App,
	incFile: TFile,
	origen: FuncRef,
	destino: FuncRef,
	nuevoTipoNombre: string,
	nuevoNombre: string
): Promise<void> {
	const oldBase = incFile.basename;
	const nombreFinal = nuevoNombre.trim() || oldBase;

	// Quita la incidencia del índice de su nota de origen.
	await quitarLineaConEnlace(app, origen.file, oldBase);

	const nuevoSlug = slugify(nuevoTipoNombre);
	const destDir = `${destino.folder.path}/${nuevoSlug}`;
	await ensureFolder(app, destDir);
	const deseado = slugify(nombreFinal) || oldBase;
	const base = slugArchivoLibreExcepto(app, destDir, deseado, incFile.path);
	const destPath = normalizePath(`${destDir}/${base}.md`);
	if (destPath !== incFile.path) {
		await app.fileManager.renameFile(incFile, destPath);
	}
	await app.fileManager.processFrontMatter(incFile, (fm: Record<string, unknown>) => {
		fm.tipo = nuevoSlug;
		fm.funcionalidad = `[[${destino.slug}]]`;
		fm.nombre = nombreFinal;
	});
	await actualizarH1(app, incFile, nombreFinal);

	// Agrega la incidencia al índice de la nota destino, en la sección de su tipo.
	await appendToSection(
		app,
		destino.file,
		`## ${nuevoTipoNombre}`,
		`- [ ] [[${base}|${nombreFinal}]]`
	);
}
