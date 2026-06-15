import { TFile, TFolder } from "obsidian";
import type GestorFuncionesPlugin from "./main";
import { listPendientes, listTareas } from "./files";

const SECCIONES_GESTIONADAS = ["Tareas", "Pendientes"];

/**
 * Vista unificada de la funcionalidad: en modo lectura, las notas con
 * frontmatter `tipo: funcionalidad` muestran sus secciones derivadas
 * dinámicamente del sistema de archivos, con un contador de elementos
 * junto a cada encabezado. El markdown plano de esas secciones se oculta.
 */
export function registerDashboard(plugin: GestorFuncionesPlugin): void {
	plugin.registerMarkdownPostProcessor((el, ctx) => {
		const fm = plugin.app.metadataCache.getCache(ctx.sourcePath)?.frontmatter;
		// Las épicas nuevas usan tipo: epica; las anteriores conservan tipo: funcionalidad.
		if (!fm || (fm.tipo !== "epica" && fm.tipo !== "funcionalidad")) return;

		const h2 = el.querySelector("h2");
		const titulo = h2?.textContent?.trim() ?? "";
		if (h2 && SECCIONES_GESTIONADAS.includes(titulo)) {
			const funcFolder = carpetaDeFuncionalidad(plugin, ctx.sourcePath);
			if (!funcFolder) return;
			h2.createSpan({ cls: "gf-contador", text: ` (${contar(plugin, funcFolder, titulo)})` });
			const cont = el.createDiv({ cls: "gf-dash" });
			h2.insertAdjacentElement("afterend", cont);
			renderSeccion(plugin, cont, funcFolder, ctx.sourcePath, titulo);
			return;
		}

		const info = ctx.getSectionInfo(el);
		if (info && enSeccionGestionada(info.text, info.lineStart)) {
			el.addClass("gf-hidden");
		}
	});
}

function carpetaDeFuncionalidad(
	plugin: GestorFuncionesPlugin,
	sourcePath: string
): TFolder | null {
	const main = plugin.app.vault.getAbstractFileByPath(sourcePath);
	if (!(main instanceof TFile) || !main.parent) return null;
	return main.parent;
}

/** ¿La línea dada cae dentro de una sección H2 gestionada por el plugin? */
function enSeccionGestionada(textoCompleto: string, linea: number): boolean {
	const lines = textoCompleto.split("\n");
	let actual: string | null = null;
	for (let i = 0; i <= linea && i < lines.length; i++) {
		const m = lines[i].match(/^(#{1,6})\s+(.*)$/);
		if (m) {
			actual = m[1].length === 2 ? m[2].trim() : null;
		}
	}
	return actual !== null && SECCIONES_GESTIONADAS.includes(actual);
}

/** Conteo para el encabezado: carpetas de tarea, o archivos .md de la carpeta. */
function contar(plugin: GestorFuncionesPlugin, funcFolder: TFolder, titulo: string): number {
	if (titulo === "Tareas") {
		const dir = funcFolder.children.find(
			(c): c is TFolder => c instanceof TFolder && c.name === "tareas"
		);
		if (!dir) return 0;
		return dir.children.filter((c) => c instanceof TFolder).length;
	}
	// Pendientes: cada uno es una carpeta (o un archivo plano de versiones anteriores).
	return listPendientes(plugin.app, funcFolder).length;
}

function renderSeccion(
	plugin: GestorFuncionesPlugin,
	cont: HTMLElement,
	funcFolder: TFolder,
	sourcePath: string,
	titulo: string
): void {
	if (titulo === "Tareas") {
		renderTareas(plugin, cont, funcFolder, sourcePath);
	} else {
		renderPendientes(plugin, cont, funcFolder, sourcePath);
	}
}

function renderTareas(
	plugin: GestorFuncionesPlugin,
	cont: HTMLElement,
	funcFolder: TFolder,
	sourcePath: string
): void {
	const tareas = listTareas(plugin.app, funcFolder);
	if (tareas.length === 0) {
		cont.createEl("em", { text: "Sin tareas aún." });
		return;
	}
	const ul = cont.createEl("ul", { cls: "gf-lista-tareas contains-task-list" });
	for (const t of tareas) {
		itemTarea(plugin, ul, t.file, t.nombre, sourcePath);
	}
}

function renderPendientes(
	plugin: GestorFuncionesPlugin,
	cont: HTMLElement,
	funcFolder: TFolder,
	sourcePath: string
): void {
	const app = plugin.app;
	const pendientes = listPendientes(app, funcFolder);
	if (pendientes.length === 0) {
		cont.createEl("em", { text: "Sin pendientes aún." });
		return;
	}
	const items = pendientes.map((p) => {
		const fm = app.metadataCache.getFileCache(p.file)?.frontmatter;
		const fechaFm = fm?.fecha ? String(fm.fecha).slice(0, 10) : "";
		const fecha = fechaFm || (p.slug.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "");
		return { ...p, fecha };
	});
	items.sort((a, b) => b.fecha.localeCompare(a.fecha));

	const ul = cont.createEl("ul", { cls: "contains-task-list" });
	for (const p of items) {
		const li = itemTarea(plugin, ul, p.file, p.nombre, sourcePath);
		if (p.fecha) li.appendText(` — ${p.fecha}`);
	}
}

function itemTarea(
	plugin: GestorFuncionesPlugin,
	ul: HTMLElement,
	file: TFile,
	nombre: string,
	sourcePath: string
): HTMLElement {
	const app = plugin.app;
	const completado =
		app.metadataCache.getFileCache(file)?.frontmatter?.estado === "completado";
	const li = ul.createEl("li", { cls: "task-list-item gf-tarea-item" });
	if (completado) li.addClass("is-checked");

	const cb = li.createEl("input", { type: "checkbox", cls: "task-list-item-checkbox" });
	cb.checked = completado;
	cb.addEventListener("change", () => {
		void app.fileManager.processFrontMatter(file, (f: Record<string, unknown>) => {
			f.estado = cb.checked ? "completado" : "por-hacer";
		});
		li.toggleClass("is-checked", cb.checked);
	});

	const a = li.createEl("a", { cls: "internal-link", text: nombre });
	a.addEventListener("click", (e) => {
		e.preventDefault();
		void app.workspace.openLinkText(file.path, sourcePath);
	});
	return li;
}

