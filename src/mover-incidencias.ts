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
import { renderChipEtiqueta } from "./colores";
import { menuNotaEnEvento } from "./menu-contextual";

export const VIEW_TYPE_MOVER_INC = "gestor-funciones-mover-inc";

interface Item {
	file: TFile;
	nombre: string;
	tipoNombre: string;
	/** Contenedor actual (épica raíz o historia). */
	ref: FuncRef;
}

/**
 * Mueve incidencias entre las historias de una épica (o a la raíz de la épica).
 * Un carril por contenedor: la raíz de la épica y cada historia. Se arrastran las
 * incidencias entre carriles de forma provisional y se aplican al pulsar
 * "Guardar" (se mueve cada nota a la carpeta de su tipo en el destino).
 */
export class MoverIncidenciasView extends ItemView {
	private plugin: GestorFuncionesPlugin;
	private renderTimer: number | null = null;
	private epicas: FuncRef[] = [];
	private epicaSlug = "";
	/** Contenedores: [épica, ...historias]. */
	private contenedores: FuncRef[] = [];
	private items: Item[] = [];
	/** Movimiento provisional: ruta de la nota → slug del contenedor destino. */
	private asignacion = new Map<string, string>();
	private arrastre: string | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: GestorFuncionesPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_MOVER_INC;
	}

	getDisplayText(): string {
		return "Mover incidencias — Gestión de épicas";
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
		this.restaurarUltimaEpica();
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

	/** Recuerda la épica elegida para reabrirla la próxima vez que se abra la vista. */
	private guardarUltimaEpica(): void {
		const mapa = this.plugin.settings.ultimaEpicaVista;
		if (this.epicaSlug) mapa[this.getViewType()] = this.epicaSlug;
		else delete mapa[this.getViewType()];
		void this.plugin.saveSettings();
	}

	/** Restaura la última épica elegida (vacío la primera vez). */
	private restaurarUltimaEpica(): void {
		this.epicaSlug = this.plugin.settings.ultimaEpicaVista[this.getViewType()] ?? "";
	}

	private recolectar(): void {
		const admin = this.plugin.settings.carpetaAdmin.trim();
		this.epicas = admin ? listFuncionalidades(this.app, admin) : [];
		this.items = [];
		this.contenedores = [];
		const ep = this.epicaActual();
		if (!ep) {
			this.asignacion.clear();
			return;
		}
		this.contenedores = [ep, ...listFuncionalidadesDe(this.app, ep.folder)];
		const tipos = this.plugin.settings.incidencias;
		for (const c of this.contenedores) {
			for (const n of listNotasDeTipos(this.app, c, tipos)) {
				this.items.push({ file: n.file, nombre: n.nombre, tipoNombre: n.tipoNombre, ref: c });
			}
		}
		const paths = new Set(this.items.map((i) => i.file.path));
		for (const k of [...this.asignacion.keys()]) if (!paths.has(k)) this.asignacion.delete(k);
	}

	private colorTipo(nombre: string): string {
		return this.plugin.settings.incidencias.find((t) => t.nombre === nombre)?.color ?? "#B9BEC6";
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
			this.guardarUltimaEpica();
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
		for (const c of this.contenedores) {
			const esRaiz = c.slug === ep.slug;
			const titulo = esRaiz ? `${ep.nombre} (raíz)` : c.nombre;
			const items = this.items.filter(
				(i) => (this.asignacion.get(i.file.path) ?? i.ref.slug) === c.slug
			);
			this.renderCarril(cuerpo, titulo, c.slug, items);
		}
	}

	private renderCarril(
		cuerpo: HTMLElement,
		titulo: string,
		contSlug: string,
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
			this.soltar(this.arrastre, contSlug);
		});

		const head = tarjeta.createDiv({ cls: "gf-colab-head" });
		head.createEl("span", { text: titulo, cls: "gf-colab-nombre" });
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
				menuNotaEnEvento(this.plugin, it.file, e);
			});
			li.draggable = true;
			li.addEventListener("dragstart", () => {
				this.arrastre = it.file.path;
			});
			li.addEventListener("dragend", () => {
				this.arrastre = null;
			});
			renderChipEtiqueta(li, it.tipoNombre, this.colorTipo(it.tipoNombre));
			const a = li.createEl("a", { cls: "internal-link", text: it.nombre });
			a.addEventListener("click", (e) => {
				e.preventDefault();
				void this.plugin.mostrarNota(it.file);
			});
		}
	}

	private soltar(path: string, contSlug: string): void {
		const it = this.items.find((i) => i.file.path === path);
		if (!it) return;
		if (contSlug === it.ref.slug) this.asignacion.delete(path);
		else this.asignacion.set(path, contSlug);
		this.render();
	}

	private async guardar(): Promise<void> {
		const entradas = [...this.asignacion.entries()];
		if (entradas.length === 0) return;
		let aplicados = 0;
		for (const [path, destinoSlug] of entradas) {
			const it = this.items.find((x) => x.file.path === path);
			const destino = this.contenedores.find((c) => c.slug === destinoSlug);
			if (!it || !destino || destino.slug === it.ref.slug) continue;
			try {
				await moverIncidencia(this.app, it.file, it.ref, destino, it.tipoNombre, it.nombre);
				aplicados++;
			} catch (e) {
				console.error("gestion-de-epicas: error al mover incidencia", e);
			}
		}
		this.asignacion.clear();
		new Notice(`Gestión de épicas: ${aplicados} incidencia(s) movida(s).`);
		this.recargar();
	}
}
