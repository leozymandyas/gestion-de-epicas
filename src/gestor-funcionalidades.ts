import { ItemView, TAbstractFile, TFile, WorkspaceLeaf, normalizePath } from "obsidian";
import type GestorFuncionesPlugin from "./main";
import {
	FuncRef,
	carpetasGestionListas,
	guardarSprintHistoria,
	leerEtiquetasEpica,
	leerEtiquetasHistoria,
	leerSprintHistoria,
	leerSprints,
	listFuncionalidades,
	listFuncionalidadesDe,
} from "./files";
import { Etiqueta } from "./settings";
import { renderChipEtiqueta } from "./colores";
import { crearSelectorEtiquetas } from "./modals";
import { AnioPickerModal, crearSelect } from "./ui";

export const VIEW_TYPE_GESTOR_FN = "gestor-funciones-gestor-fn";

interface CardHist {
	file: TFile;
	nombre: string;
	/** Nombres de las etiquetas asignadas a la historia. */
	etiquetas: string[];
	/** Sprint asignado para el año visible (null = sin sprint). */
	sprint: number | null;
}

interface DragPayload {
	path: string;
}

/**
 * Tablero de historias de una épica: una columna por cada sprint que la épica
 * tiene asignado en el año visible (más una columna "Sin sprint"). Arrastrar una
 * historia a una columna escribe su `sprint`/`año` en el frontmatter.
 */
export class GestorFuncionalidadesView extends ItemView {
	private plugin: GestorFuncionesPlugin;
	private renderTimer: number | null = null;
	private epicaSlug = "";
	private anio = new Date().getFullYear();
	/** Filtro por etiqueta (nombres seleccionados). */
	private filtro = new Set<string>();
	/** Filtro de intervalo de sprints (igual que en el roadmap): acota columnas. */
	private desde: number;
	private hasta: number;
	private epicas: FuncRef[] = [];
	private historias: CardHist[] = [];
	/** Números de sprint que la épica tiene asignados en el año visible. */
	private sprintsEpica: number[] = [];
	/** Etiquetas (visibles) definidas en la épica. */
	private etiquetasEpica: Etiqueta[] = [];

	constructor(leaf: WorkspaceLeaf, plugin: GestorFuncionesPlugin) {
		super(leaf);
		this.plugin = plugin;
		// Sprint inicio sugerido desde el panel (el usuario puede cambiarlo).
		this.desde = Math.min(Math.max(plugin.settings.sprintActual.sprint, 1), plugin.settings.numSprints);
		this.hasta = plugin.settings.numSprints;
	}

	getViewType(): string {
		return VIEW_TYPE_GESTOR_FN;
	}

	getDisplayText(): string {
		return "Gestión de historias — Gestión de épicas";
	}

	getIcon(): string {
		return "puzzle";
	}

	async onOpen(): Promise<void> {
		const refrescar = (file: TAbstractFile) => {
			const admin = normalizePath(this.plugin.settings.carpetaAdmin.trim() || "/");
			if (file.path === admin || file.path.startsWith(admin + "/")) this.renderSoon();
		};
		this.registerEvent(this.app.vault.on("create", refrescar));
		this.registerEvent(this.app.vault.on("delete", refrescar));
		this.registerEvent(this.app.vault.on("rename", refrescar));
		await this.recargar();
	}

	/** Relee desde disco y vuelve a renderizar. */
	async recargar(): Promise<void> {
		await this.recolectar();
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

	private async recolectar(): Promise<void> {
		const admin = this.plugin.settings.carpetaAdmin.trim();
		this.epicas = admin ? listFuncionalidades(this.app, admin) : [];
		this.historias = [];
		this.sprintsEpica = [];
		this.etiquetasEpica = [];
		const ep = this.epicaActual();
		if (!ep) return;

		const sprints = (await leerSprints(this.app, ep)).filter((s) => s.anio === this.anio);
		this.sprintsEpica = [...new Set(sprints.map((s) => s.sprint))].sort((a, b) => a - b);
		this.etiquetasEpica = leerEtiquetasEpica(this.app, ep).filter((e) => e.visible !== false);

		for (const h of listFuncionalidadesDe(this.app, ep.folder)) {
			const asign = leerSprintHistoria(this.app, h.file);
			const sprint = asign && asign.anio === this.anio ? asign.sprint : null;
			this.historias.push({
				file: h.file,
				nombre: h.nombre,
				etiquetas: leerEtiquetasHistoria(this.app, h.file),
				sprint,
			});
		}
	}

	render(): void {
		const cont = this.contentEl;
		cont.empty();
		cont.addClass("gf-kanban");

		if (!carpetasGestionListas(this.app)) {
			const aviso = cont.createDiv({ cls: "gf-kanban-aviso" });
			aviso.createEl("p", {
				text: "Crea las carpetas de gestión desde el panel de acciones antes de usar el gestor.",
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
			this.filtro.clear();
			void this.recargar();
		});

		// Año.
		barra.createEl("span", { text: "Año", cls: "gf-roadmap-lbl" });
		const anioBtn = barra.createEl("button", { cls: "gf-multiselect-btn", text: `${this.anio} ▾` });
		anioBtn.addEventListener("click", () => {
			new AnioPickerModal(this.app, this.anio, (y) => {
				this.anio = y;
				void this.recargar();
			}).open();
		});

		const boardCont = cont.createDiv();
		const pintarBoard = () => {
			boardCont.empty();
			this.renderBoard(boardCont);
		};

		// Filtro de intervalo de sprints (mismo control que el roadmap): acota qué
		// columnas de sprint se muestran.
		const maxSprints = this.plugin.settings.numSprints;
		if (this.hasta > maxSprints) this.hasta = maxSprints;
		if (this.desde > maxSprints) this.desde = maxSprints;
		const opcionesSprint = (desde: number) => {
			const ops = [];
			for (let n = desde; n <= maxSprints; n++) ops.push({ valor: String(n), texto: `Sprint ${n}` });
			return ops;
		};
		const rango = barra.createDiv({ cls: "gf-roadmap-rango" });
		rango.createEl("span", { text: "Sprint inicio", cls: "gf-roadmap-lbl" });
		crearSelect({
			parent: rango,
			opciones: opcionesSprint(1),
			valor: String(this.desde),
			onChange: (v) => {
				this.desde = Number(v);
				if (this.hasta < this.desde) this.hasta = this.desde;
				finCtl.setOpciones(opcionesSprint(this.desde), String(this.hasta));
				pintarBoard();
			},
		});
		rango.createEl("span", { text: "fin", cls: "gf-roadmap-lbl" });
		const finCtl = crearSelect({
			parent: rango,
			opciones: opcionesSprint(this.desde),
			valor: String(this.hasta),
			onChange: (v) => {
				this.hasta = Number(v);
				pintarBoard();
			},
		});

		// Filtro por etiqueta (solo con épica elegida).
		if (this.epicaActual()) {
			barra.createEl("span", { text: "Etiquetas", cls: "gf-roadmap-lbl" });
			crearSelectorEtiquetas({
				parent: barra,
				etiquetas: this.etiquetasEpica,
				seleccion: this.filtro,
				textoBtn: "Filtrar por etiqueta",
				onChange: () => pintarBoard(),
			});
			// Borra solo el filtro por etiqueta.
			const borrar = barra.createEl("button", { text: "Borrar filtros", cls: "gf-recargar-btn" });
			borrar.addEventListener("click", () => {
				this.filtro.clear();
				this.render();
			});
		}

		const recargar = barra.createEl("button", { text: "Recargar", cls: "gf-recargar-btn" });
		recargar.setAttr("title", "Releer las notas desde el disco");
		recargar.addEventListener("click", () => void this.recargar());

		if (!this.epicaActual()) {
			cont.createDiv({ cls: "gf-kanban-vacio", text: "Selecciona una épica." });
			return;
		}
		pintarBoard();
	}

	private renderBoard(cont: HTMLElement): void {
		const board = cont.createDiv({ cls: "gf-kanban-board" });
		// La columna "Sin sprint" siempre está; las de sprint se acotan al rango.
		const columnas: Array<{ titulo: string; sprint: number | null }> = [
			{ titulo: "Sin sprint", sprint: null },
			...this.sprintsEpica
				.filter((n) => n >= this.desde && n <= this.hasta)
				.map((n) => ({ titulo: `Sprint ${n}`, sprint: n })),
		];
		const filtradas = this.historias.filter(
			(h) => this.filtro.size === 0 || h.etiquetas.some((e) => this.filtro.has(e))
		);

		for (const col of columnas) {
			const colEl = board.createDiv({ cls: "gf-kanban-carril" });
			colEl.addEventListener("dragover", (e) => {
				e.preventDefault();
				colEl.addClass("gf-drop");
			});
			colEl.addEventListener("dragleave", () => colEl.removeClass("gf-drop"));
			// Soltar en el área de la columna (no sobre una tarjeta): va al final.
			colEl.addEventListener("drop", (e) => {
				e.preventDefault();
				colEl.removeClass("gf-drop");
				const payload = leerPayload(e);
				if (payload) void this.soltar(payload.path, col.sprint, null);
			});

			const header = colEl.createDiv({ cls: "gf-kanban-header" });
			header.createEl("span", { cls: "gf-kanban-titulo", text: col.titulo });
			const tarjetas = this.ordenar(filtradas.filter((h) => h.sprint === col.sprint));
			header.createEl("span", { cls: "gf-kanban-conteo", text: String(tarjetas.length) });

			const cuerpo = colEl.createDiv({ cls: "gf-kanban-cuerpo" });
			for (const card of tarjetas) this.renderTarjeta(cuerpo, card, col.sprint);
		}
	}

	private renderTarjeta(cuerpo: HTMLElement, card: CardHist, sprintCol: number | null): void {
		const el = cuerpo.createDiv({ cls: "gf-kanban-card" });
		el.draggable = true;
		el.addEventListener("dragstart", (e) => {
			e.dataTransfer?.setData(
				"text/plain",
				JSON.stringify({ path: card.file.path } satisfies DragPayload)
			);
		});
		// Soltar sobre esta tarjeta: insertar la arrastrada justo antes de ella.
		el.addEventListener("dragover", (e) => {
			e.preventDefault();
			e.stopPropagation();
			el.addClass("gf-drop-card");
		});
		el.addEventListener("dragleave", () => el.removeClass("gf-drop-card"));
		el.addEventListener("drop", (e) => {
			e.preventDefault();
			e.stopPropagation();
			el.removeClass("gf-drop-card");
			const payload = leerPayload(e);
			if (payload && payload.path !== card.file.path) {
				void this.soltar(payload.path, sprintCol, card.file.path);
			}
		});

		el.createDiv({ cls: "gf-kanban-card-nombre", text: card.nombre });
		if (card.etiquetas.length > 0) {
			const chips = el.createDiv({ cls: "gf-kanban-card-chips" });
			for (const n of card.etiquetas) {
				const color = this.etiquetasEpica.find((e) => e.nombre === n)?.color ?? "#B9BEC6";
				renderChipEtiqueta(chips, n, color);
			}
		}

		el.addEventListener("click", () => void this.plugin.mostrarNota(card.file));
	}

	/** Orden manual persistido (rutas), filtrado a las historias visibles. */
	private ordenLista(): string[] {
		const vivas = new Set(this.historias.map((h) => h.file.path));
		return this.plugin.settings.ordenFunc.filter((p) => vivas.has(p));
	}

	/** Ordena las tarjetas de una columna según el orden manual; las no listadas
	 * se añaden al final por nombre. */
	private ordenar(cards: CardHist[]): CardHist[] {
		const orden = this.ordenLista();
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

	/** Reposiciona `path` antes de `beforeKey` (o al final). Reconstruye el orden
	 * de las historias visibles y conserva el de otras épicas intacto. */
	private posicionar(path: string, beforeKey: string | null): void {
		const orden = this.ordenar(this.historias)
			.map((h) => h.file.path)
			.filter((p) => p !== path);
		const pos = beforeKey ? orden.indexOf(beforeKey) : -1;
		if (pos === -1) orden.push(path);
		else orden.splice(pos, 0, path);
		const vivas = new Set(this.historias.map((h) => h.file.path));
		const otras = this.plugin.settings.ordenFunc.filter((p) => !vivas.has(p));
		this.plugin.settings.ordenFunc = [...otras, ...orden];
	}

	/** Asigna la columna (sprint, si cambia) y/o reordena dentro de ella. */
	private async soltar(
		path: string,
		sprint: number | null,
		beforeKey: string | null
	): Promise<void> {
		const h = this.historias.find((c) => c.file.path === path);
		if (!h) return;
		this.posicionar(path, beforeKey);
		if (h.sprint !== sprint) {
			h.sprint = sprint;
			await guardarSprintHistoria(this.app, h.file, sprint, this.anio);
		}
		await this.plugin.saveSettings();
		await this.recargar();
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
