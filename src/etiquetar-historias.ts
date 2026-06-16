import {
	ItemView,
	Modal,
	TAbstractFile,
	TFile,
	WorkspaceLeaf,
	normalizePath,
	setIcon,
} from "obsidian";
import type GestorFuncionesPlugin from "./main";
import {
	FuncRef,
	carpetasGestionListas,
	eliminarEtiquetaHistoria,
	guardarEtiquetasEpica,
	guardarEtiquetasHistoria,
	leerEtiquetasEpica,
	leerEtiquetasHistoria,
	listFuncionalidades,
	listFuncionalidadesDe,
	renombrarEtiquetaHistoria,
} from "./files";
import { Etiqueta } from "./settings";
import { colorAleatorio, renderChipEtiqueta, renderSelectorColor } from "./colores";
import { ConfirmacionModal } from "./modals";

export const VIEW_TYPE_ETIQUETAR_HISTORIAS = "gestor-funciones-etiquetar-historias";

/** Lane "Sin etiqueta": historias sin ninguna etiqueta asignada. */
const SIN_ETIQUETA = "";

interface HistCard {
	file: TFile;
	nombre: string;
	/** Etiqueta única asignada (la primera del frontmatter) o "" si no tiene. */
	etiqueta: string;
}

/**
 * Tablero "Etiquetar historias": tras elegir una épica, sus historias se
 * organizan en carriles, uno por etiqueta de la épica (más "Sin etiqueta").
 * Cada carril ES una etiqueta: crear un carril crea la etiqueta en la épica,
 * borrarlo la borra (de la épica y de sus historias). Arrastrar una historia a
 * un carril escribe esa etiqueta en su frontmatter (una etiqueta por historia).
 */
export class EtiquetarHistoriasView extends ItemView {
	private plugin: GestorFuncionesPlugin;
	private renderTimer: number | null = null;
	private epicaSlug = "";
	private epicas: FuncRef[] = [];
	private historias: HistCard[] = [];
	/** Etiquetas de la épica (carriles personalizados). */
	private etiquetas: Etiqueta[] = [];

	constructor(leaf: WorkspaceLeaf, plugin: GestorFuncionesPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_ETIQUETAR_HISTORIAS;
	}

	getDisplayText(): string {
		return "Etiquetas de historias — Gestión de épicas";
	}

	getIcon(): string {
		return "tags";
	}

	async onOpen(): Promise<void> {
		const refrescar = (file: TAbstractFile) => {
			const admin = normalizePath(this.plugin.settings.carpetaAdmin.trim() || "/");
			if (file.path === admin || file.path.startsWith(admin + "/")) this.renderSoon();
		};
		this.registerEvent(this.app.vault.on("create", refrescar));
		this.registerEvent(this.app.vault.on("delete", refrescar));
		this.registerEvent(this.app.vault.on("rename", refrescar));
		this.registerEvent(this.app.metadataCache.on("changed", (file) => refrescar(file)));
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
		this.historias = [];
		this.etiquetas = [];
		const ep = this.epicaActual();
		if (!ep) return;
		this.etiquetas = leerEtiquetasEpica(this.app, ep);
		const nombresValidos = new Set(this.etiquetas.map((e) => e.nombre));
		for (const h of listFuncionalidadesDe(this.app, ep.folder)) {
			// Una etiqueta por historia: se toma la primera que siga existiendo.
			const etiqueta = leerEtiquetasHistoria(this.app, h.file).find((n) => nombresValidos.has(n)) ?? SIN_ETIQUETA;
			this.historias.push({ file: h.file, nombre: h.nombre, etiqueta });
		}
	}

	private colorEtiqueta(nombre: string): string {
		return this.etiquetas.find((e) => e.nombre === nombre)?.color ?? "#B9BEC6";
	}

	render(): void {
		const cont = this.contentEl;
		cont.empty();
		cont.addClass("gf-kanban");
		cont.addClass("gf-orgdocs");

		if (!carpetasGestionListas(this.app)) {
			const aviso = cont.createDiv({ cls: "gf-kanban-aviso" });
			aviso.createEl("p", {
				text: "Crea las carpetas de gestión desde el panel de acciones antes de usar Etiquetas de historias.",
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
			this.recargar();
		});

		if (this.epicaActual()) {
			const agregar = barra.createEl("button", { text: "Agregar etiqueta", cls: "gf-roadmap-recargar" });
			agregar.addEventListener("click", () => this.agregarEtiqueta());
		}
		const recargar = barra.createEl("button", { text: "Recargar", cls: "gf-roadmap-recargar" });
		recargar.addEventListener("click", () => this.recargar());

		if (!this.epicaActual()) {
			cont.createDiv({ cls: "gf-kanban-vacio", text: "Selecciona una épica." });
			return;
		}

		const board = cont.createDiv({ cls: "gf-orgdocs-board" });
		this.renderCarril(board, { nombre: SIN_ETIQUETA, titulo: "Sin etiqueta", fija: true });
		for (const et of this.etiquetas) {
			this.renderCarril(board, { nombre: et.nombre, titulo: et.nombre, fija: false });
		}
	}

	private renderCarril(
		board: HTMLElement,
		carril: { nombre: string; titulo: string; fija: boolean }
	): void {
		const colEl = board.createDiv({ cls: "gf-orgdocs-carril" });
		colEl.addEventListener("dragover", (e) => {
			e.preventDefault();
			colEl.addClass("gf-drop");
		});
		colEl.addEventListener("dragleave", () => colEl.removeClass("gf-drop"));
		colEl.addEventListener("drop", (e) => {
			e.preventDefault();
			colEl.removeClass("gf-drop");
			const path = e.dataTransfer?.getData("text/plain");
			if (path) void this.asignar(path, carril.nombre);
		});

		const header = colEl.createDiv({ cls: "gf-orgdocs-header" });
		if (!carril.fija) {
			const punto = header.createDiv({ cls: "gf-kanban-dot" });
			punto.setCssStyles({ backgroundColor: this.colorEtiqueta(carril.nombre) });
		}
		header.createEl("span", { cls: "gf-kanban-titulo", text: carril.titulo });
		const cards = this.historias
			.filter((h) => h.etiqueta === carril.nombre)
			.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
		header.createEl("span", { cls: "gf-kanban-conteo", text: String(cards.length) });

		if (!carril.fija) {
			const acciones = header.createDiv({ cls: "gf-orgdocs-carril-acciones" });
			const renombrar = acciones.createEl("button", { cls: "gf-orgdocs-icono-btn" });
			setIcon(renombrar, "pencil");
			renombrar.setAttr("aria-label", "Renombrar etiqueta");
			renombrar.addEventListener("click", () => this.renombrarEtiqueta(carril.nombre));
			const eliminar = acciones.createEl("button", { cls: "gf-orgdocs-icono-btn" });
			setIcon(eliminar, "trash-2");
			eliminar.setAttr("aria-label", "Eliminar etiqueta");
			eliminar.addEventListener("click", () => this.eliminarEtiqueta(carril.nombre));
		}

		const cuerpo = colEl.createDiv({ cls: "gf-orgdocs-cuerpo" });
		if (cards.length === 0) {
			cuerpo.createDiv({ cls: "gf-kanban-vacio", text: "Sin historias." });
		}
		for (const card of cards) this.renderTarjeta(cuerpo, card);
	}

	private renderTarjeta(cuerpo: HTMLElement, card: HistCard): void {
		const el = cuerpo.createDiv({ cls: "gf-kanban-card gf-orgdocs-card" });
		el.draggable = true;
		el.addEventListener("dragstart", (e) => {
			e.dataTransfer?.setData("text/plain", card.file.path);
		});
		if (card.etiqueta) {
			renderChipEtiqueta(el, card.etiqueta, this.colorEtiqueta(card.etiqueta));
		}
		el.createSpan({ cls: "gf-orgdocs-card-nombre", text: card.nombre });
		el.addEventListener("click", () => void this.plugin.mostrarNota(card.file));
	}

	/** Asigna (reemplaza) la etiqueta de la historia: una etiqueta por historia. */
	private async asignar(path: string, etiqueta: string): Promise<void> {
		const card = this.historias.find((h) => h.file.path === path);
		if (!card || card.etiqueta === etiqueta) return;
		await guardarEtiquetasHistoria(this.app, card.file, etiqueta ? [etiqueta] : []);
		this.recargar();
	}

	private agregarEtiqueta(): void {
		const ep = this.epicaActual();
		if (!ep) return;
		new NombrePromptModal(this.plugin, "Nueva etiqueta", "", colorAleatorio(), (nombre, color) => {
			if (this.etiquetas.some((e) => e.nombre === nombre)) return;
			const nuevas = [...this.etiquetas, { nombre, color, visible: true }];
			void (async () => {
				await guardarEtiquetasEpica(this.app, ep, nuevas);
				this.recargar();
			})();
		}).open();
	}

	private renombrarEtiqueta(nombre: string): void {
		const ep = this.epicaActual();
		if (!ep) return;
		const actual = this.etiquetas.find((e) => e.nombre === nombre);
		new NombrePromptModal(
			this.plugin,
			"Editar etiqueta",
			nombre,
			actual?.color ?? colorAleatorio(),
			(nuevo, color) => {
				// El nombre nuevo no puede chocar con otra etiqueta distinta.
				if (nuevo !== nombre && this.etiquetas.some((e) => e.nombre === nuevo)) return;
				void (async () => {
					const nuevas = this.etiquetas.map((e) =>
						e.nombre === nombre ? { ...e, nombre: nuevo, color } : e
					);
					await guardarEtiquetasEpica(this.app, ep, nuevas);
					if (nuevo !== nombre) await renombrarEtiquetaHistoria(this.app, ep, nombre, nuevo);
					this.recargar();
				})();
			}
		).open();
	}

	private eliminarEtiqueta(nombre: string): void {
		const ep = this.epicaActual();
		if (!ep) return;
		new ConfirmacionModal(
			this.plugin,
			"Eliminar etiqueta",
			`¿Eliminar la etiqueta "${nombre}"? Se quitará de la épica y de todas las historias que la tengan.`,
			"Eliminar",
			async () => {
				const nuevas = this.etiquetas.filter((e) => e.nombre !== nombre);
				await guardarEtiquetasEpica(this.app, ep, nuevas);
				await eliminarEtiquetaHistoria(this.app, ep, nombre);
				this.recargar();
			}
		).open();
	}
}

/** Prompt para el nombre y color de la etiqueta. */
class NombrePromptModal extends Modal {
	private titulo: string;
	private valor: string;
	private colorInicial: string;
	private onGuardar: (nombre: string, color: string) => void;

	constructor(
		plugin: GestorFuncionesPlugin,
		titulo: string,
		valor: string,
		colorInicial: string,
		onGuardar: (nombre: string, color: string) => void
	) {
		super(plugin.app);
		this.titulo = titulo;
		this.valor = valor;
		this.colorInicial = colorInicial;
		this.onGuardar = onGuardar;
	}

	onOpen(): void {
		this.titleEl.setText(this.titulo);
		const input = this.contentEl.createEl("input", {
			type: "text",
			cls: "gf-orgdocs-nombre-input",
			value: this.valor,
		});
		input.placeholder = "Nombre de la etiqueta";

		const colorRow = this.contentEl.createDiv({ cls: "gf-campo" });
		colorRow.createEl("label", { text: "Color", cls: "gf-campo-label" });
		const selectorColor = renderSelectorColor(colorRow, this.colorInicial);

		const guardar = () => {
			const nombre = input.value.trim();
			if (!nombre) return;
			this.onGuardar(nombre, selectorColor.getColor());
			this.close();
		};
		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				guardar();
			}
		});
		const row = this.contentEl.createDiv({ cls: "gf-botones" });
		const cancelar = row.createEl("button", { text: "Cancelar" });
		cancelar.addEventListener("click", () => this.close());
		const ok = row.createEl("button", { text: "Guardar", cls: "mod-cta" });
		ok.addEventListener("click", guardar);
		window.setTimeout(() => input.focus(), 0);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
