import { ItemView, Notice, TAbstractFile, WorkspaceLeaf, normalizePath } from "obsidian";
import type GestorFuncionesPlugin from "./main";
import {
	FuncRef,
	carpetasGestionListas,
	listFuncionalidades,
	listFuncionalidadesDe,
	moverHistoriaAEpica,
} from "./files";
import { colorDesdeNombre, renderChipEtiqueta } from "./colores";
import { menuNotaEnEvento } from "./menu-contextual";
import { crearMultiSelect } from "./ui";

export const VIEW_TYPE_MOVER_HISTORIAS = "gestor-funciones-mover-historias";

interface Item {
	historia: FuncRef;
	/** Slug de la épica actual donde vive la historia. */
	epicaSlug: string;
}

/**
 * Mueve historias entre épicas. Un carril por épica con sus historias; se
 * arrastran entre carriles de forma provisional y se aplican al pulsar "Guardar"
 * (cada historia se traslada con su contenido a la épica destino).
 */
export class MoverHistoriasView extends ItemView {
	private plugin: GestorFuncionesPlugin;
	private renderTimer: number | null = null;
	private epicas: FuncRef[] = [];
	private items: Item[] = [];
	/** Movimiento provisional: ruta de la historia → slug de la épica destino. */
	private asignacion = new Map<string, string>();
	/** Filtro de épicas (carriles visibles). Por defecto, todas. */
	private epicaSeleccion = new Set<string>();
	private epicaInit = false;
	private arrastre: string | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: GestorFuncionesPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_MOVER_HISTORIAS;
	}

	getDisplayText(): string {
		return "Mover historias — Gestión de épicas";
	}

	getIcon(): string {
		return "folder-symlink";
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

	private recolectar(): void {
		const admin = this.plugin.settings.carpetaAdmin.trim();
		this.epicas = admin ? listFuncionalidades(this.app, admin) : [];
		this.items = [];
		for (const ep of this.epicas) {
			for (const h of listFuncionalidadesDe(this.app, ep.folder)) {
				this.items.push({ historia: h, epicaSlug: ep.slug });
			}
		}
		const paths = new Set(this.items.map((i) => i.historia.file.path));
		for (const k of [...this.asignacion.keys()]) if (!paths.has(k)) this.asignacion.delete(k);
		const vivos = new Set(this.epicas.map((e) => e.slug));
		for (const s of [...this.epicaSeleccion]) if (!vivos.has(s)) this.epicaSeleccion.delete(s);
		if (!this.epicaInit) {
			this.epicaInit = true;
			this.epicaSeleccion = new Set(this.epicas.map((e) => e.slug));
		}
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
		crearMultiSelect({
			parent: barra,
			etiqueta: "Épicas",
			opciones: this.epicas.map((e) => ({ valor: e.slug, texto: e.nombre })),
			seleccion: this.epicaSeleccion,
			onChange: () => this.render(),
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

		if (this.epicas.length === 0) {
			cont.createDiv({ cls: "gf-kanban-vacio", text: "No hay épicas." });
			return;
		}

		const cuerpo = cont.createDiv();
		for (const ep of this.epicas) {
			if (this.epicaSeleccion.size > 0 && !this.epicaSeleccion.has(ep.slug)) continue;
			const items = this.items.filter(
				(i) => (this.asignacion.get(i.historia.file.path) ?? i.epicaSlug) === ep.slug
			);
			this.renderCarril(cuerpo, ep, items);
		}
	}

	private renderCarril(cuerpo: HTMLElement, epica: FuncRef, items: Item[]): void {
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
			this.soltar(this.arrastre, epica.slug);
		});

		const head = tarjeta.createDiv({ cls: "gf-colab-head" });
		const titulo = head.createEl("a", { text: epica.nombre, cls: "gf-colab-nombre internal-link" });
		titulo.addEventListener("click", (e) => {
			e.preventDefault();
			void this.plugin.mostrarNota(epica.file);
		});
		titulo.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			menuNotaEnEvento(this.plugin, epica.file, e);
		});
		head.createEl("span", { cls: "gf-colab-conteo", text: String(items.length) });

		if (items.length === 0) {
			tarjeta.createEl("em", { cls: "gf-kanban-vacio", text: "Arrastra aquí." });
			return;
		}
		const ul = tarjeta.createEl("ul", { cls: "gf-colab-lista" });
		for (const it of items) {
			const li = ul.createEl("li", { cls: "gf-arrastrable" });
			li.addEventListener("contextmenu", (e) => {
				e.preventDefault();
				menuNotaEnEvento(this.plugin, it.historia.file, e);
			});
			li.draggable = true;
			li.addEventListener("dragstart", () => {
				this.arrastre = it.historia.file.path;
			});
			li.addEventListener("dragend", () => {
				this.arrastre = null;
			});
			// Chip "Historia" (color por carril) para mantener la consistencia visual.
			renderChipEtiqueta(li, "Historia", colorDesdeNombre(epica.slug));
			const a = li.createEl("a", { cls: "internal-link", text: it.historia.nombre });
			a.addEventListener("click", (e) => {
				e.preventDefault();
				void this.plugin.mostrarNota(it.historia.file);
			});
		}
	}

	private soltar(path: string, epicaSlug: string): void {
		const it = this.items.find((i) => i.historia.file.path === path);
		if (!it) return;
		if (epicaSlug === it.epicaSlug) this.asignacion.delete(path);
		else this.asignacion.set(path, epicaSlug);
		this.render();
	}

	private async guardar(): Promise<void> {
		const entradas = [...this.asignacion.entries()];
		if (entradas.length === 0) return;
		let aplicados = 0;
		for (const [path, destinoSlug] of entradas) {
			const it = this.items.find((x) => x.historia.file.path === path);
			const destino = this.epicas.find((e) => e.slug === destinoSlug);
			if (!it || !destino || destino.slug === it.epicaSlug) continue;
			try {
				await moverHistoriaAEpica(this.app, it.historia, destino);
				aplicados++;
			} catch (e) {
				console.error("gestion-de-epicas: error al mover historia", e);
			}
		}
		this.asignacion.clear();
		new Notice(`Gestión de épicas: ${aplicados} historia(s) movida(s).`);
		this.recargar();
	}
}
