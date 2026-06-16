import { ItemView, Notice, TAbstractFile, TFile, WorkspaceLeaf, normalizePath } from "obsidian";
import type GestorFuncionesPlugin from "./main";
import {
	FuncRef,
	carpetasGestionListas,
	listFuncionalidades,
	listFuncionalidadesDe,
	listNotasDeTipos,
	moverIncidencia,
} from "./files";
import { Etiqueta } from "./settings";
import { renderChipEtiqueta } from "./colores";
import { menuNotaEnEvento } from "./menu-contextual";

export const VIEW_TYPE_RECLASIFICAR_DOCS = "gestor-funciones-reclasificar-docs";
export const VIEW_TYPE_RECLASIFICAR_INC = "gestor-funciones-reclasificar-inc";

/** Configura la vista de reclasificación (documentos o incidencias). */
export interface ReclasificarConfig {
	viewType: string;
	titulo: string;
	singular: string;
	registro: (plugin: GestorFuncionesPlugin) => Etiqueta[];
}

export const RECLASIFICAR_DOCS: ReclasificarConfig = {
	viewType: VIEW_TYPE_RECLASIFICAR_DOCS,
	titulo: "Reclasificar documentos",
	singular: "documento",
	registro: (p) => p.settings.documentos,
};

export const RECLASIFICAR_INC: ReclasificarConfig = {
	viewType: VIEW_TYPE_RECLASIFICAR_INC,
	titulo: "Reclasificar incidencias",
	singular: "incidencia",
	registro: (p) => p.settings.incidencias,
};

interface Item {
	file: TFile;
	nombre: string;
	/** Tipo actual (nombre legible). */
	tipoNombre: string;
	/** Contenedor actual (épica o historia) donde vive la nota. */
	ref: FuncRef;
}

/**
 * Reclasifica el tipo de los documentos/incidencias de UNA épica. El primer
 * carril lleva el nombre de la épica y contiene sus elementos; los demás carriles
 * son los tipos. Se arrastran entre carriles de forma provisional y se aplican al
 * pulsar "Guardar" (se mueve cada nota a la carpeta del tipo destino).
 */
export class ReclasificarTipoView extends ItemView {
	private plugin: GestorFuncionesPlugin;
	private cfg: ReclasificarConfig;
	private renderTimer: number | null = null;
	private epicas: FuncRef[] = [];
	private epicaSlug = "";
	private items: Item[] = [];
	/** Reclasificación provisional: ruta de la nota → nombre del tipo destino. */
	private asignacion = new Map<string, string>();
	private arrastre: string | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: GestorFuncionesPlugin, cfg: ReclasificarConfig) {
		super(leaf);
		this.plugin = plugin;
		this.cfg = cfg;
	}

	getViewType(): string {
		return this.cfg?.viewType ?? VIEW_TYPE_RECLASIFICAR_DOCS;
	}

	getDisplayText(): string {
		return `${this.cfg?.titulo ?? "Reclasificar"} — Gestión de épicas`;
	}

	getIcon(): string {
		return "replace";
	}

	async onOpen(): Promise<void> {
		const refrescar = (file: TAbstractFile) => {
			const admin = normalizePath(this.plugin.settings.carpetaAdmin.trim() || "/");
			if (file.path === admin || file.path.startsWith(admin + "/")) this.renderSoon();
		};
		this.registerEvent(this.app.vault.on("create", refrescar));
		this.registerEvent(this.app.vault.on("delete", refrescar));
		this.registerEvent(this.app.vault.on("rename", refrescar));
		this.recargar();
	}

	recargar(): void {
		this.recolectar();
		this.render();
	}

	private renderSoon(): void {
		if (this.renderTimer !== null) window.clearTimeout(this.renderTimer);
		this.renderTimer = window.setTimeout(() => {
			this.renderTimer = null;
			this.recargar();
		}, 150);
	}

	private epicaActual(): FuncRef | null {
		return this.epicas.find((e) => e.slug === this.epicaSlug) ?? null;
	}

	private recolectar(): void {
		const admin = this.plugin.settings.carpetaAdmin.trim();
		this.epicas = admin ? listFuncionalidades(this.app, admin) : [];
		this.items = [];
		const ep = this.epicaActual();
		if (!ep) {
			this.asignacion.clear();
			return;
		}
		const tipos = this.cfg.registro(this.plugin);
		const agregar = (ref: FuncRef) => {
			for (const n of listNotasDeTipos(this.app, ref, tipos)) {
				this.items.push({ file: n.file, nombre: n.nombre, tipoNombre: n.tipoNombre, ref });
			}
		};
		agregar(ep);
		for (const fn of listFuncionalidadesDe(this.app, ep.folder)) agregar(fn);
		// Conserva solo la reclasificación provisional de notas aún presentes.
		const paths = new Set(this.items.map((i) => i.file.path));
		for (const k of [...this.asignacion.keys()]) if (!paths.has(k)) this.asignacion.delete(k);
	}

	private colorTipo(nombre: string): string {
		return this.cfg.registro(this.plugin).find((t) => t.nombre === nombre)?.color ?? "#B9BEC6";
	}

	render(): void {
		const cont = this.contentEl;
		cont.empty();
		cont.addClass("gf-colab");

		if (!carpetasGestionListas(this.app)) {
			const aviso = cont.createDiv({ cls: "gf-kanban-aviso" });
			aviso.createEl("p", {
				text: "Crea las carpetas de gestión desde el panel de acciones antes de continuar.",
			});
			const btn = aviso.createEl("button", { text: "Abrir panel de acciones", cls: "mod-cta" });
			btn.addEventListener("click", () => void this.plugin.abrirAcciones());
			return;
		}

		const barra = cont.createDiv({ cls: "gf-roadmap-controles" });
		barra.createEl("span", { text: "Épica", cls: "gf-roadmap-lbl" });
		const epicaSel = barra.createEl("select", { cls: "dropdown" });
		epicaSel.createEl("option", { text: "Seleccionar épica", value: "" });
		for (const ep of this.epicas) epicaSel.createEl("option", { text: ep.nombre, value: ep.slug });
		epicaSel.value = this.epicaSlug;
		epicaSel.addEventListener("change", () => {
			this.epicaSlug = epicaSel.value;
			this.asignacion.clear();
			this.recargar();
		});

		const pendientes = this.asignacion.size;
		const guardar = barra.createEl("button", {
			cls: "mod-cta",
			text: pendientes > 0 ? `Guardar (${pendientes})` : "Guardar",
		});
		guardar.disabled = pendientes === 0;
		guardar.addEventListener("click", () => void this.guardar());

		const recargar = barra.createEl("button", { text: "Recargar", cls: "gf-roadmap-recargar" });
		recargar.addEventListener("click", () => this.recargar());

		const ep = this.epicaActual();
		if (!ep) {
			cont.createDiv({ cls: "gf-kanban-vacio", text: "Selecciona una épica." });
			return;
		}

		const cuerpo = cont.createDiv();
		// Carril de la épica: sus elementos sin reclasificación provisional.
		this.renderCarril(
			cuerpo,
			ep.nombre,
			null,
			null,
			this.items.filter((i) => !this.asignacion.has(i.file.path))
		);
		// Un carril por tipo, con los elementos que se están reclasificando ahora.
		for (const tipo of this.cfg.registro(this.plugin).filter((t) => t.visible !== false)) {
			this.renderCarril(
				cuerpo,
				tipo.nombre,
				tipo.color,
				tipo.nombre,
				this.items.filter((i) => this.asignacion.get(i.file.path) === tipo.nombre)
			);
		}
	}

	private renderCarril(
		cuerpo: HTMLElement,
		titulo: string,
		color: string | null,
		tipoDestino: string | null,
		items: Item[]
	): void {
		const tarjeta = cuerpo.createDiv({ cls: "gf-colab-card" });
		tarjeta.addEventListener("dragover", (e) => {
			if (!this.arrastre) return;
			e.preventDefault();
			tarjeta.addClass("gf-drop-card");
		});
		tarjeta.addEventListener("dragleave", () => tarjeta.removeClass("gf-drop-card"));
		tarjeta.addEventListener("drop", (e) => {
			if (!this.arrastre) return;
			e.preventDefault();
			tarjeta.removeClass("gf-drop-card");
			this.soltar(this.arrastre, tipoDestino);
		});

		const head = tarjeta.createDiv({ cls: "gf-colab-head" });
		if (color) {
			const punto = head.createDiv({ cls: "gf-colab-punto" });
			punto.setCssStyles({ backgroundColor: color });
		}
		head.createEl("span", { text: titulo, cls: "gf-colab-nombre" });
		head.createEl("span", { cls: "gf-colab-conteo", text: String(items.length) });

		if (items.length === 0) {
			tarjeta.createEl("em", {
				cls: "gf-kanban-vacio",
				text: tipoDestino === null ? "Sin elementos." : "Arrastra aquí.",
			});
			return;
		}
		const ul = tarjeta.createEl("ul", { cls: "gf-colab-lista" });
		for (const it of items) {
			const li = ul.createEl("li", { cls: "gf-arrastrable" });
			li.addEventListener("contextmenu", (e) => {
				e.preventDefault();
				menuNotaEnEvento(this.plugin, it.file, e);
			});
			li.draggable = true;
			li.addEventListener("dragstart", () => {
				this.arrastre = it.file.path;
			});
			li.addEventListener("dragend", () => {
				this.arrastre = null;
			});
			// Etiqueta del tipo actual + nombre (sin ruta ni etiqueta de épica).
			renderChipEtiqueta(li, it.tipoNombre, this.colorTipo(it.tipoNombre));
			const a = li.createEl("a", { cls: "internal-link", text: it.nombre });
			a.addEventListener("click", (e) => {
				e.preventDefault();
				void this.plugin.mostrarNota(it.file);
			});
		}
	}

	private soltar(path: string, tipoDestino: string | null): void {
		if (!this.items.some((i) => i.file.path === path)) return;
		if (tipoDestino === null) this.asignacion.delete(path);
		else this.asignacion.set(path, tipoDestino);
		this.render();
	}

	private async guardar(): Promise<void> {
		const entradas = [...this.asignacion.entries()];
		if (entradas.length === 0) return;
		let aplicados = 0;
		for (const [path, nuevoTipo] of entradas) {
			const it = this.items.find((x) => x.file.path === path);
			if (!it || it.tipoNombre === nuevoTipo) continue; // sin cambio real
			try {
				await moverIncidencia(this.app, it.file, it.ref, it.ref, nuevoTipo, it.nombre);
				aplicados++;
			} catch (e) {
				console.error("gestion-de-epicas: error al reclasificar", e);
			}
		}
		this.asignacion.clear();
		new Notice(`Gestión de épicas: ${aplicados} ${this.cfg.singular}(s) reclasificado(s).`);
		this.recargar();
	}
}
