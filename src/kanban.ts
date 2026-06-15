import { ItemView, Menu, TAbstractFile, TFile, WorkspaceLeaf, normalizePath } from "obsidian";
import type GestorFuncionesPlugin from "./main";
import {
	FuncRef,
	carpetasGestionListas,
	getAsignados,
	leerSprints,
	listFuncionalidades,
	listFuncionalidadesDe,
	listIncidencias,
} from "./files";
import { normalizarEstado, type Carril } from "./settings";
import { renderChipEtiqueta } from "./colores";
import { crearSelectorEtiquetas } from "./modals";
import { crearSelect } from "./ui";

export const VIEW_TYPE_KANBAN = "gestor-funciones-kanban";

interface ItemCard {
	file: TFile;
	nombre: string;
	/** Texto de contexto: nombre de la épica o "Épica › Funcionalidad". */
	contexto: string;
	/** Nombre legible del tipo de incidencia. */
	tipo: string;
	/** Colaboradores asignados (nombres). */
	colaboradores: string[];
	/** Valor de `estado` del frontmatter. */
	estado: string;
}

interface DragPayload {
	path: string;
}

export class KanbanView extends ItemView {
	private plugin: GestorFuncionesPlugin;
	private renderTimer: number | null = null;
	private cards: ItemCard[] = [];
	/** Filtros (no se persisten): por tipo de incidencia y por colaborador. */
	private filtroTipos = new Set<string>();
	private filtroColab = new Set<string>();

	constructor(leaf: WorkspaceLeaf, plugin: GestorFuncionesPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_KANBAN;
	}

	getDisplayText(): string {
		return "Gestión de incidencias — Gestión de épicas";
	}

	getIcon(): string {
		return "kanban-square";
	}

	async onOpen(): Promise<void> {
		const refrescar = (file: TAbstractFile) => {
			const admin = normalizePath(this.plugin.settings.carpetaAdmin.trim() || "/");
			if (file.path === admin || file.path.startsWith(admin + "/")) this.renderSoon();
		};
		this.registerEvent(this.app.vault.on("create", refrescar));
		this.registerEvent(this.app.vault.on("delete", refrescar));
		this.registerEvent(this.app.vault.on("rename", refrescar));
		// Sugiere el sprint inicio del panel (puede cambiarse luego en la barra).
		const s = this.plugin.settings;
		const sug = Math.min(Math.max(s.sprintActual.sprint, 1), s.numSprints);
		s.kanban.filtroSprints.desde = sug;
		if (s.kanban.filtroSprints.hasta < sug) s.kanban.filtroSprints.hasta = sug;
		await this.recargar();
	}

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

	private async recolectar(): Promise<void> {
		const admin = this.plugin.settings.carpetaAdmin.trim();
		this.cards = [];
		if (!admin) return;

		// Filtro de intervalo de sprints (persistido): si no es el rango completo,
		// solo entran incidencias de épicas/historias con sprints en ese intervalo.
		const { desde, hasta } = this.plugin.settings.kanban.filtroSprints;
		const filtrar = !(desde === 1 && hasta === this.plugin.settings.numSprints);
		const anio = new Date().getFullYear();
		const pasaSprints = async (ref: FuncRef): Promise<boolean> => {
			const sprints = await leerSprints(this.app, ref);
			return sprints.some((s) => s.anio === anio && s.sprint >= desde && s.sprint <= hasta);
		};

		const tipos = this.plugin.settings.incidencias;
		const agregar = (ref: FuncRef, contexto: string) => {
			for (const inc of listIncidencias(this.app, ref, tipos)) {
				this.cards.push({
					file: inc.file,
					nombre: inc.nombre,
					contexto,
					tipo: inc.tipoNombre,
					colaboradores: getAsignados(this.app, inc.file),
					estado: this.estadoDe(inc.file) ?? "por-hacer",
				});
			}
		};

		for (const epica of listFuncionalidades(this.app, admin)) {
			const epicaPasa = !filtrar || (await pasaSprints(epica));
			if (epicaPasa) agregar(epica, epica.nombre);
			for (const fn of listFuncionalidadesDe(this.app, epica.folder)) {
				const fnPasa = epicaPasa || (await pasaSprints(fn));
				if (fnPasa) agregar(fn, `${epica.nombre} › ${fn.nombre}`);
			}
		}
	}

	private estadoDe(file: TFile): string | undefined {
		const estado = (this.app.metadataCache.getFileCache(file)?.frontmatter as
			| Record<string, unknown>
			| undefined)?.estado;
		return estado ? String(estado) : undefined;
	}

	private carrilesVisibles(): Carril[] {
		return this.plugin.settings.carriles.filter((c) => c.visible);
	}

	/** Nombre del carril visible donde cae una incidencia según su `estado`. */
	private carrilDe(estado: string): string {
		const visibles = this.carrilesVisibles();
		const c = this.plugin.settings.carriles.find((x) => x.valor === normalizarEstado(estado));
		if (c && visibles.some((v) => v.nombre === c.nombre)) return c.nombre;
		const pend = visibles.find((v) => v.valor === "por-hacer");
		return (pend ?? visibles[0])?.nombre ?? "";
	}

	private colorTipo(nombre: string): string {
		return this.plugin.settings.incidencias.find((i) => i.nombre === nombre)?.color ?? "#B9BEC6";
	}

	private colorColab(nombre: string): string {
		return this.plugin.settings.colaboradores.find((c) => c.nombre === nombre)?.color ?? "#B9BEC6";
	}

	render(): void {
		const cont = this.contentEl;
		cont.empty();
		cont.addClass("gf-kanban");

		if (!carpetasGestionListas(this.app)) {
			const aviso = cont.createDiv({ cls: "gf-kanban-aviso" });
			aviso.createEl("p", {
				text: "Crea las carpetas de gestión desde el panel de acciones antes de usar el tablero.",
			});
			const btn = aviso.createEl("button", { text: "Abrir panel de acciones", cls: "mod-cta" });
			btn.addEventListener("click", () => void this.plugin.abrirAcciones());
			return;
		}

		const barra = cont.createDiv({ cls: "gf-roadmap-controles" });

		// Filtro de intervalo de sprints (persistido); mismo control que el roadmap.
		const filtro = this.plugin.settings.kanban.filtroSprints;
		const maxSprints = this.plugin.settings.numSprints;
		if (filtro.hasta > maxSprints) filtro.hasta = maxSprints;
		if (filtro.desde > maxSprints) filtro.desde = maxSprints;
		const opcionesSprint = (desde: number) => {
			const ops = [];
			for (let n = desde; n <= maxSprints; n++) ops.push({ valor: String(n), texto: `Sprint ${n}` });
			return ops;
		};
		const aplicarSprints = async () => {
			await this.plugin.saveSettings();
			await this.recargar();
		};
		const rango = barra.createDiv({ cls: "gf-roadmap-rango" });
		rango.createEl("span", { text: "Sprint inicio", cls: "gf-roadmap-lbl" });
		crearSelect({
			parent: rango,
			opciones: opcionesSprint(1),
			valor: String(filtro.desde),
			onChange: (v) => {
				filtro.desde = Number(v);
				if (filtro.hasta < filtro.desde) filtro.hasta = filtro.desde;
				finCtl.setOpciones(opcionesSprint(filtro.desde), String(filtro.hasta));
				void aplicarSprints();
			},
		});
		rango.createEl("span", { text: "fin", cls: "gf-roadmap-lbl" });
		const finCtl = crearSelect({
			parent: rango,
			opciones: opcionesSprint(filtro.desde),
			valor: String(filtro.hasta),
			onChange: (v) => {
				filtro.hasta = Number(v);
				void aplicarSprints();
			},
		});

		const boardCont = cont.createDiv();
		const pintarBoard = () => {
			boardCont.empty();
			this.renderBoard(boardCont);
		};

		// Filtro por tipo de incidencia.
		barra.createEl("span", { text: "Incidencia", cls: "gf-roadmap-lbl" });
		crearSelectorEtiquetas({
			parent: barra,
			etiquetas: this.plugin.settings.incidencias.filter((i) => i.visible !== false),
			seleccion: this.filtroTipos,
			textoBtn: "Filtrar por incidencia",
			textoVacio: "No hay incidencias configuradas.",
			onChange: () => pintarBoard(),
		});

		// Filtro por colaborador.
		barra.createEl("span", { text: "Colaborador", cls: "gf-roadmap-lbl" });
		crearSelectorEtiquetas({
			parent: barra,
			etiquetas: this.plugin.settings.colaboradores.filter((c) => c.visible !== false),
			seleccion: this.filtroColab,
			textoBtn: "Filtrar por colaborador",
			textoVacio: "No hay colaboradores registrados.",
			onChange: () => pintarBoard(),
		});

		// Borra solo los filtros por incidencia y por colaborador.
		const borrar = barra.createEl("button", { text: "Borrar filtros", cls: "gf-recargar-btn" });
		borrar.addEventListener("click", () => {
			this.filtroTipos.clear();
			this.filtroColab.clear();
			this.render();
		});

		const recargar = barra.createEl("button", { text: "Recargar", cls: "gf-recargar-btn" });
		recargar.setAttr("title", "Releer las notas desde el disco");
		recargar.addEventListener("click", () => void this.recargar());

		pintarBoard();
	}

	private renderBoard(cont: HTMLElement): void {
		const board = cont.createDiv({ cls: "gf-kanban-board" });
		const carriles = this.carrilesVisibles();
		if (carriles.length === 0) {
			board.createDiv({
				cls: "gf-kanban-vacio",
				text: "No hay carriles visibles. Actívalos en los ajustes del plugin.",
			});
			return;
		}
		const filtradas = this.cards.filter(
			(c) =>
				(this.filtroTipos.size === 0 || this.filtroTipos.has(c.tipo)) &&
				(this.filtroColab.size === 0 ||
					c.colaboradores.some((x) => this.filtroColab.has(x)))
		);

		for (const carril of carriles) {
			const col = board.createDiv({ cls: "gf-kanban-carril" });
			col.addEventListener("dragover", (e) => {
				e.preventDefault();
				col.addClass("gf-drop");
			});
			col.addEventListener("dragleave", () => col.removeClass("gf-drop"));
			// Soltar en el área del carril (no sobre una tarjeta): va al final.
			col.addEventListener("drop", (e) => {
				e.preventDefault();
				col.removeClass("gf-drop");
				const payload = leerPayload(e);
				if (payload) void this.soltar(payload.path, carril.valor, null);
			});

			const header = col.createDiv({ cls: "gf-kanban-header" });
			const punto = header.createSpan({ cls: "gf-kanban-dot" });
			punto.setCssStyles({ backgroundColor: carril.color });
			header.createEl("span", { cls: "gf-kanban-titulo", text: carril.nombre });
			const tarjetas = this.ordenar(
				filtradas.filter((c) => this.carrilDe(c.estado) === carril.nombre)
			);
			header.createEl("span", { cls: "gf-kanban-conteo", text: String(tarjetas.length) });

			const cuerpo = col.createDiv({ cls: "gf-kanban-cuerpo" });
			for (const card of tarjetas) this.renderTarjeta(cuerpo, card, carril);
		}
	}

	private renderTarjeta(cuerpo: HTMLElement, card: ItemCard, carrilActual: Carril): void {
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
				void this.soltar(payload.path, carrilActual.valor, card.file.path);
			}
		});

		el.createDiv({ cls: "gf-kanban-card-nombre", text: card.nombre });

		const chips = el.createDiv({ cls: "gf-kanban-card-chips" });
		renderChipEtiqueta(chips, card.tipo, this.colorTipo(card.tipo));
		for (const c of card.colaboradores) renderChipEtiqueta(chips, c, this.colorColab(c));

		if (card.contexto) el.createDiv({ cls: "gf-kanban-card-func", text: card.contexto });

		el.addEventListener("click", () => void this.plugin.mostrarNota(card.file));
		el.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			const menu = new Menu();
			for (const carril of this.carrilesVisibles()) {
				if (carril.nombre === carrilActual.nombre) continue;
				menu.addItem((item) =>
					item
						.setTitle(`Mover a: ${carril.nombre}`)
						.onClick(() => void this.soltar(card.file.path, carril.valor, null))
				);
			}
			menu.showAtMouseEvent(e);
		});
	}

	/** Orden manual persistido (rutas), filtrado a las tarjetas vivas. */
	private ordenLista(): string[] {
		const vivas = new Set(this.cards.map((c) => c.file.path));
		return this.plugin.settings.kanban.ordenIncidencias.filter((p) => vivas.has(p));
	}

	/** Ordena las tarjetas de un carril según el orden manual; las no listadas
	 * se añaden al final por nombre. */
	private ordenar(cards: ItemCard[]): ItemCard[] {
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

	/** Reposiciona `path` justo antes de `beforeKey` (o al final si es null).
	 * Reconstruye el orden de todas las tarjetas para que `beforeKey` siempre
	 * esté presente aunque haya filtros de visualización activos. */
	private posicionar(path: string, beforeKey: string | null): void {
		const k = this.plugin.settings.kanban;
		const orden = this.ordenar(this.cards)
			.map((c) => c.file.path)
			.filter((p) => p !== path);
		const pos = beforeKey ? orden.indexOf(beforeKey) : -1;
		if (pos === -1) orden.push(path);
		else orden.splice(pos, 0, path);
		k.ordenIncidencias = orden;
	}

	/** Mueve una tarjeta a un carril (si cambia) y/o la reordena dentro de él. */
	private async soltar(
		path: string,
		carrilValor: string,
		beforeKey: string | null
	): Promise<void> {
		const card = this.cards.find((c) => c.file.path === path);
		if (!card) return;
		this.posicionar(path, beforeKey);
		if (normalizarEstado(card.estado) !== carrilValor) {
			card.estado = carrilValor;
			await this.app.fileManager.processFrontMatter(
				card.file,
				(fm: Record<string, unknown>) => {
					fm.estado = carrilValor;
				}
			);
		}
		await this.plugin.saveSettings();
		this.render();
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
