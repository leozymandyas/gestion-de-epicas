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
	listDocumentos,
	listFuncionalidadesDe,
	listFuncionalidadesVisibles,
} from "./files";
import { CARRIL_DOCS_TODOS, DocCarril, OrganizacionDocsEpica } from "./settings";
import { renderChipEtiqueta } from "./colores";
import { menuNotaEnEvento } from "./menu-contextual";

export const VIEW_TYPE_ORGANIZAR_DOCS = "gestor-funciones-organizar-docs";

interface DocCard {
	file: TFile;
	nombre: string;
	/** Nombre del tipo de documento (para el chip de color). */
	tipoNombre: string;
	/** Segmento al que pertenece el documento, según su frontmatter `segmento`. */
	segmento?: string;
}

interface DragPayload {
	path: string;
}

/**
 * Tablero "Organizar documentos": tras elegir una épica, sus documentos (los de
 * la épica y los de sus historias) se muestran como tarjetas dentro de carriles
 * horizontales. El carril "Documentos sin segmentos" recoge las no asignadas; el
 * usuario puede crear carriles, ponerles nombre y arrastrar documentos entre
 * ellos. La organización (carriles, asignación y orden) se guarda por épica en
 * data.json (carpeta oculta del vault), igual que el resto de los órdenes de los
 * tableros.
 */
export class OrganizarDocumentosView extends ItemView {
	private plugin: GestorFuncionesPlugin;
	private renderTimer: number | null = null;
	private epicaSlug = "";
	private epicas: FuncRef[] = [];
	private docs: DocCard[] = [];
	/** Id del segmento que se está arrastrando para reordenar (null = arrastre de tarjeta). */
	private arrastreCarril: string | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: GestorFuncionesPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_ORGANIZAR_DOCS;
	}

	getDisplayText(): string {
		return "Documentos por segmentos — Gestión de épicas";
	}

	getIcon(): string {
		return "layout-grid";
	}

	async onOpen(): Promise<void> {
		try {
			const refrescar = (file: TAbstractFile) => {
				const admin = normalizePath(this.plugin.settings.carpetaAdmin.trim() || "/");
				if (file.path === admin || file.path.startsWith(admin + "/")) this.renderSoon();
			};
			this.registerEvent(this.app.vault.on("create", refrescar));
			this.registerEvent(this.app.vault.on("delete", refrescar));
			this.registerEvent(this.app.vault.on("rename", refrescar));
			// El segmento vive en el frontmatter: refrescar también al editarlo a mano.
			this.registerEvent(this.app.metadataCache.on("changed", (file) => refrescar(file)));
			this.restaurarUltimaEpica();
			void this.recargar();
		} catch (e) {
			console.error("gestion-de-epicas: error en onOpen (organizar documentos)", e);
			this.render();
		}
	}

	/** Relee desde disco, migra asignaciones heredadas y vuelve a renderizar. */
	async recargar(): Promise<void> {
		this.recolectar();
		await this.migrarSegmentos();
		this.render();
	}

	private renderSoon(): void {
		if (this.renderTimer !== null) window.clearTimeout(this.renderTimer);
		this.renderTimer = window.setTimeout(() => {
			this.renderTimer = null;
			void this.recargar();
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
		this.epicas = admin
			? listFuncionalidadesVisibles(this.app, admin, this.plugin.settings.epicasOcultas)
			: [];
		this.docs = [];
		const ep = this.epicaActual();
		if (!ep) return;
		const tipos = this.plugin.settings.documentos;
		const agregar = (ref: FuncRef) => {
			for (const doc of listDocumentos(this.app, ref, tipos)) {
				const fm = this.app.metadataCache.getFileCache(doc.file)?.frontmatter as
					| Record<string, unknown>
					| undefined;
				const segmento = fm?.segmento ? String(fm.segmento) : undefined;
				this.docs.push({ file: doc.file, nombre: doc.nombre, tipoNombre: doc.tipoNombre, segmento });
			}
		};
		agregar(ep);
		for (const fn of listFuncionalidadesDe(this.app, ep.folder)) agregar(fn);
	}

	// ----- Persistencia (por épica) -----

	/** Organización de la épica actual en modo lectura (no crea la entrada). */
	private datos(): OrganizacionDocsEpica {
		return (
			this.plugin.settings.organizacionDocs[this.epicaSlug] ?? {
				carriles: [],
				asignacion: {},
				orden: [],
			}
		);
	}

	/** Organización de la épica actual, creando la entrada si no existe (para mutar). */
	private datosEditable(): OrganizacionDocsEpica {
		const mapa = this.plugin.settings.organizacionDocs;
		let d = mapa[this.epicaSlug];
		if (!d) {
			d = { carriles: [], asignacion: {}, orden: [] };
			mapa[this.epicaSlug] = d;
		}
		return d;
	}

	/** Carril donde se muestra un documento, según su frontmatter `segmento`. Si ese
	 * segmento ya no existe (se borró el carril), cae en "Documentos sin segmentos"
	 * aunque el documento conserve la propiedad. */
	private carrilDe(card: DocCard): string {
		if (card.segmento) {
			const c = this.datos().carriles.find((x) => x.nombre === card.segmento);
			if (c) return c.id;
		}
		return CARRIL_DOCS_TODOS;
	}

	private colorTipo(nombre: string): string {
		return this.plugin.settings.documentos.find((t) => t.nombre === nombre)?.color ?? "#B9BEC6";
	}

	// ----- Render -----

	render(): void {
		try {
			this.renderInterno();
		} catch (e) {
			console.error("gestion-de-epicas: error al renderizar (organizar documentos)", e);
			this.contentEl.empty();
			this.contentEl.createEl("p", {
				cls: "gf-kanban-vacio",
				text: `Error al cargar la vista: ${e instanceof Error ? e.message : String(e)}`,
			});
		}
	}

	private renderInterno(): void {
		const cont = this.contentEl;
		cont.empty();
		cont.addClass("gf-kanban");
		cont.addClass("gf-orgdocs");

		if (!carpetasGestionListas(this.app)) {
			const aviso = cont.createDiv({ cls: "gf-kanban-aviso" });
			aviso.createEl("p", {
				text: "Crea las carpetas de gestión desde el panel de acciones antes de usar Documentos por segmentos.",
			});
			const btn = aviso.createEl("button", { text: "Abrir panel de acciones", cls: "mod-cta" });
			btn.addEventListener("click", () => void this.plugin.abrirAcciones());
			return;
		}

		const barra = cont.createDiv({ cls: "gf-roadmap-controles" });

		// Selector de épica.
		barra.createEl("span", { text: "Épica", cls: "gf-roadmap-lbl" });
		const epicaSel = barra.createEl("select", { cls: "dropdown" });
		epicaSel.createEl("option", { text: "Seleccionar épica", value: "" });
		for (const ep of this.epicas) epicaSel.createEl("option", { text: ep.nombre, value: ep.slug });
		epicaSel.value = this.epicaSlug;
		epicaSel.addEventListener("change", () => {
			this.epicaSlug = epicaSel.value;
			this.guardarUltimaEpica();
			void this.recargar();
		});

		if (this.epicaActual()) {
			const agregar = barra.createEl("button", { text: "Agregar segmento", cls: "gf-roadmap-recargar" });
			agregar.addEventListener("click", () => this.agregarCarril());
		}

		const recargar = barra.createEl("button", { text: "Recargar", cls: "gf-roadmap-recargar" });
		recargar.setAttr("title", "Releer las notas desde el disco");
		recargar.addEventListener("click", () => void this.recargar());

		if (!this.epicaActual()) {
			cont.createDiv({ cls: "gf-kanban-vacio", text: "Selecciona una épica." });
			return;
		}

		this.renderBoard(cont);
	}

	private renderBoard(cont: HTMLElement): void {
		const board = cont.createDiv({ cls: "gf-orgdocs-board" });
		const carriles: Array<DocCarril & { fijo: boolean }> = [
			{ id: CARRIL_DOCS_TODOS, nombre: "Documentos sin segmentos", fijo: true },
			...this.datos().carriles.map((c) => ({ ...c, fijo: false })),
		];
		for (const carril of carriles) this.renderCarril(board, carril);
	}

	private renderCarril(board: HTMLElement, carril: DocCarril & { fijo: boolean }): void {
		const colEl = board.createDiv({ cls: "gf-orgdocs-carril" });
		colEl.addEventListener("dragover", (e) => {
			e.preventDefault();
			if (this.arrastreCarril !== null) {
				if (this.arrastreCarril !== carril.id) colEl.addClass("gf-drop-carril");
			} else {
				colEl.addClass("gf-drop");
			}
		});
		colEl.addEventListener("dragleave", () => {
			colEl.removeClass("gf-drop");
			colEl.removeClass("gf-drop-carril");
		});
		colEl.addEventListener("drop", (e) => {
			e.preventDefault();
			colEl.removeClass("gf-drop");
			colEl.removeClass("gf-drop-carril");
			// Arrastre de segmento: reordenar; arrastre de tarjeta: mover el documento.
			if (this.arrastreCarril !== null) {
				const rect = colEl.getBoundingClientRect();
				const despues = e.clientY > rect.top + rect.height / 2;
				this.reordenarCarril(this.arrastreCarril, carril.id, despues, carril.fijo);
				return;
			}
			const payload = leerPayload(e);
			if (payload) void this.soltar(payload.path, carril.id, null);
		});

		const header = colEl.createDiv({ cls: "gf-orgdocs-header" });
		// Los segmentos personalizados se reordenan arrastrándolos por el asa.
		if (!carril.fijo) {
			const grip = header.createDiv({ cls: "gf-orgdocs-grip" });
			setIcon(grip, "grip-vertical");
			grip.setAttr("aria-label", "Arrastrar para reordenar");
			grip.draggable = true;
			grip.addEventListener("dragstart", (e) => {
				this.arrastreCarril = carril.id;
				e.dataTransfer?.setData("text/plain", JSON.stringify({ carril: carril.id }));
			});
			grip.addEventListener("dragend", () => {
				this.arrastreCarril = null;
			});
		}
		header.createEl("span", { cls: "gf-kanban-titulo", text: carril.nombre });
		const cards = this.ordenar(this.docs.filter((c) => this.carrilDe(c) === carril.id));
		header.createEl("span", { cls: "gf-kanban-conteo", text: String(cards.length) });

		// Los carriles personalizados se pueden renombrar y eliminar.
		if (!carril.fijo) {
			const acciones = header.createDiv({ cls: "gf-orgdocs-carril-acciones" });
			const renombrar = acciones.createEl("button", { cls: "gf-orgdocs-icono-btn" });
			setIcon(renombrar, "pencil");
			renombrar.setAttr("aria-label", "Renombrar segmento");
			renombrar.addEventListener("click", () => this.renombrarCarril(carril));
			const eliminar = acciones.createEl("button", { cls: "gf-orgdocs-icono-btn" });
			setIcon(eliminar, "trash-2");
			eliminar.setAttr("aria-label", "Eliminar segmento");
			eliminar.addEventListener("click", () => this.eliminarCarril(carril));
		}

		const cuerpo = colEl.createDiv({ cls: "gf-orgdocs-cuerpo" });
		if (cards.length === 0) {
			cuerpo.createDiv({ cls: "gf-kanban-vacio", text: "Sin documentos." });
		}
		for (const card of cards) this.renderTarjeta(cuerpo, card, carril.id);
	}

	private renderTarjeta(cuerpo: HTMLElement, card: DocCard, carrilId: string): void {
		const el = cuerpo.createDiv({ cls: "gf-kanban-card gf-orgdocs-card" });
		el.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			menuNotaEnEvento(this.plugin, card.file, e);
		});
		el.draggable = true;
		el.addEventListener("dragstart", (e) => {
			e.dataTransfer?.setData(
				"text/plain",
				JSON.stringify({ path: card.file.path } satisfies DragPayload)
			);
		});
		// Soltar sobre esta tarjeta: insertar la arrastrada justo antes de ella.
		el.addEventListener("dragover", (e) => {
			// Si se arrastra un segmento, no interferir: deja que lo maneje el carril.
			if (this.arrastreCarril !== null) return;
			e.preventDefault();
			e.stopPropagation();
			el.addClass("gf-drop-card");
		});
		el.addEventListener("dragleave", () => el.removeClass("gf-drop-card"));
		el.addEventListener("drop", (e) => {
			if (this.arrastreCarril !== null) return;
			e.preventDefault();
			e.stopPropagation();
			el.removeClass("gf-drop-card");
			const payload = leerPayload(e);
			if (payload && payload.path !== card.file.path) {
				void this.soltar(payload.path, carrilId, card.file.path);
			}
		});

		renderChipEtiqueta(el, card.tipoNombre, this.colorTipo(card.tipoNombre));
		el.createSpan({ cls: "gf-orgdocs-card-nombre", text: card.nombre });
		el.addEventListener("click", () => void this.plugin.mostrarNota(card.file));
	}

	// ----- Orden manual (por épica) -----

	private ordenar(cards: DocCard[]): DocCard[] {
		const orden = this.datos().orden;
		const idx = new Map(orden.map((p, i) => [p, i] as const));
		return [...cards].sort((a, b) => {
			const ia = idx.get(a.file.path);
			const ib = idx.get(b.file.path);
			if (ia !== undefined && ib !== undefined) return ia - ib;
			if (ia !== undefined) return -1;
			if (ib !== undefined) return 1;
			return a.nombre.localeCompare(b.nombre, "es");
		});
	}

	/** Reposiciona `path` antes de `beforeKey` (o al final) en el orden de la épica. */
	private posicionar(path: string, beforeKey: string | null): void {
		const d = this.datosEditable();
		const orden = this.ordenar(this.docs)
			.map((c) => c.file.path)
			.filter((p) => p !== path);
		const pos = beforeKey ? orden.indexOf(beforeKey) : -1;
		if (pos === -1) orden.push(path);
		else orden.splice(pos, 0, path);
		d.orden = orden;
	}

	/** Mueve el documento al segmento del carril (escribe `segmento` en su
	 * frontmatter) y lo reordena dentro de él. */
	private async soltar(path: string, carrilId: string, beforeKey: string | null): Promise<void> {
		const card = this.docs.find((c) => c.file.path === path);
		if (!card) return;
		this.posicionar(path, beforeKey);
		const nombre =
			carrilId === CARRIL_DOCS_TODOS
				? null
				: this.datos().carriles.find((c) => c.id === carrilId)?.nombre ?? null;
		await this.escribirSegmento(card.file, nombre);
		card.segmento = nombre ?? undefined;
		await this.plugin.saveSettings();
		this.render();
	}

	/** Escribe (o borra, con null) la propiedad `segmento` del documento. */
	private async escribirSegmento(file: TFile, nombre: string | null): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			if (nombre) fm.segmento = nombre;
			else delete fm.segmento;
		});
	}

	/** Migra las asignaciones heredadas (guardadas en settings) al frontmatter, una
	 * sola vez por documento; después limpia la asignación heredada. Conserva la
	 * compatibilidad con organizaciones creadas antes de mover el segmento al .md. */
	private async migrarSegmentos(): Promise<void> {
		const d = this.plugin.settings.organizacionDocs[this.epicaSlug];
		if (!d || Object.keys(d.asignacion).length === 0) return;
		let cambios = false;
		for (const card of this.docs) {
			const legacy = d.asignacion[card.file.path];
			if (!legacy) continue;
			if (!card.segmento) {
				const nombre = d.carriles.find((c) => c.id === legacy)?.nombre;
				if (nombre) {
					await this.escribirSegmento(card.file, nombre);
					card.segmento = nombre;
				}
			}
			delete d.asignacion[card.file.path];
			cambios = true;
		}
		if (cambios) await this.plugin.saveSettings();
	}

	// ----- Carriles -----

	/**
	 * Reordena un segmento personalizado, colocándolo antes o después del segmento
	 * destino según dónde se haya soltado. Soltar sobre el carril fijo "Documentos
	 * sin segmentos" lo coloca al principio de los personalizados.
	 */
	private reordenarCarril(origenId: string, destinoId: string, despues: boolean, destinoFijo: boolean): void {
		if (origenId === destinoId) return;
		const d = this.datosEditable();
		const arr = d.carriles;
		const desde = arr.findIndex((c) => c.id === origenId);
		if (desde === -1) return;
		const [item] = arr.splice(desde, 1);
		let hasta: number;
		if (destinoFijo) {
			hasta = 0;
		} else {
			hasta = arr.findIndex((c) => c.id === destinoId);
			if (hasta === -1) hasta = arr.length;
			else if (despues) hasta += 1;
		}
		arr.splice(hasta, 0, item);
		void this.plugin.saveSettings();
		this.render();
	}

	private agregarCarril(): void {
		new NombreCarrilModal(this.plugin, "Nuevo segmento", "", (nombre) => {
			const d = this.datosEditable();
			d.carriles.push({ id: nuevoId(), nombre });
			void this.plugin.saveSettings();
			this.render();
		}).open();
	}

	private renombrarCarril(carril: DocCarril): void {
		new NombreCarrilModal(this.plugin, "Renombrar segmento", carril.nombre, (nombre) => {
			void (async () => {
				const anterior = carril.nombre;
				const d = this.datosEditable();
				const c = d.carriles.find((x) => x.id === carril.id);
				if (c) c.nombre = nombre;
				await this.plugin.saveSettings();
				// Propaga el nuevo nombre al frontmatter de los documentos del segmento.
				for (const card of this.docs) {
					if (card.segmento === anterior) {
						await this.escribirSegmento(card.file, nombre);
						card.segmento = nombre;
					}
				}
				this.render();
			})();
		}).open();
	}

	private eliminarCarril(carril: DocCarril): void {
		const d = this.datosEditable();
		d.carriles = d.carriles.filter((c) => c.id !== carril.id);
		void (async () => {
			// Al borrar el segmento se quita también la propiedad `segmento` de sus
			// documentos: pasan a "Documentos sin segmentos" sin dato huérfano.
			for (const card of this.docs) {
				if (card.segmento === carril.nombre) {
					await this.escribirSegmento(card.file, null);
					card.segmento = undefined;
				}
			}
			await this.plugin.saveSettings();
			this.render();
		})();
	}
}

function leerPayload(e: DragEvent): DragPayload | null {
	const raw = e.dataTransfer?.getData("text/plain");
	if (!raw) return null;
	try {
		return JSON.parse(raw) as DragPayload;
	} catch {
		return null;
	}
}

function nuevoId(): string {
	return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Modal mínimo para capturar el nombre de un carril. */
class NombreCarrilModal extends Modal {
	private titulo: string;
	private valor: string;
	private onGuardar: (nombre: string) => void;

	constructor(
		plugin: GestorFuncionesPlugin,
		titulo: string,
		valor: string,
		onGuardar: (nombre: string) => void
	) {
		super(plugin.app);
		this.titulo = titulo;
		this.valor = valor;
		this.onGuardar = onGuardar;
	}

	onOpen(): void {
		this.titleEl.setText(this.titulo);
		const input = this.contentEl.createEl("input", {
			type: "text",
			cls: "gf-orgdocs-nombre-input",
			value: this.valor,
		});
		input.placeholder = "Nombre del segmento";
		const guardar = () => {
			const nombre = input.value.trim();
			if (!nombre) return;
			this.onGuardar(nombre);
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
