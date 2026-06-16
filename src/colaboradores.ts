import { App, ItemView, Modal, TAbstractFile, TFile, WorkspaceLeaf, normalizePath } from "obsidian";
import type GestorFuncionesPlugin from "./main";
import {
	FuncRef,
	Incidencia,
	carpetasGestionListas,
	getAsignados,
	leerSprints,
	listDocumentos,
	listFuncionalidades,
	listFuncionalidadesDe,
	listIncidencias,
} from "./files";
import { Etiqueta, normalizarEstado } from "./settings";
import { renderChipEtiqueta } from "./colores";
import { crearSelectorEtiquetas } from "./modals";
import { crearSelect, crearMultiSelect } from "./ui";

export const VIEW_TYPE_COLABORADORES = "gestor-funciones-colaboradores";
export const VIEW_TYPE_DOCUMENTOS = "gestor-funciones-documentos";

/** Clave del grupo sin colaborador asignado. */
const SIN_ASIGNAR = "Sin asignar";

/** Configura la vista (incidencias por colaborador vs documentos). */
export interface VistaColabConfig {
	viewType: string;
	titulo: string;
	icon: string;
	/** Registro de tipos a listar (incidencias o documentos). */
	registro: (plugin: GestorFuncionesPlugin) => Etiqueta[];
	/** Si incluye las tareas/pendientes heredadas (solo incidencias). */
	incluyeTareasPendientes: boolean;
	/** Si muestra el filtro multiselect de épicas (solo documentos). */
	conEpicaFilter: boolean;
	/** Si permite marcar como hecha y filtrar completadas (solo incidencias). */
	conMarcarHecha: boolean;
	/** Agrupación: por colaborador (incidencias) o por épica/historia (documentos). */
	agruparPor: "colaborador" | "contexto";
	/** "incidencia" | "documento" (para textos). */
	singular: string;
}

export const CONFIG_INCIDENCIAS: VistaColabConfig = {
	viewType: VIEW_TYPE_COLABORADORES,
	titulo: "Incidencias por colaborador",
	icon: "users",
	registro: (p) => p.settings.incidencias,
	incluyeTareasPendientes: true,
	conEpicaFilter: false,
	conMarcarHecha: true,
	agruparPor: "colaborador",
	singular: "incidencia",
};

export const CONFIG_DOCUMENTOS: VistaColabConfig = {
	viewType: VIEW_TYPE_DOCUMENTOS,
	titulo: "Documentos",
	icon: "file-text",
	registro: (p) => p.settings.documentos,
	incluyeTareasPendientes: false,
	conEpicaFilter: true,
	conMarcarHecha: false,
	agruparPor: "contexto",
	singular: "documento",
};

interface IncidenciaAsignada extends Incidencia {
	/** Texto de contexto (épica o "Épica › Historia"). */
	contexto: string;
	/** Nombre de la épica de nivel superior (para el filtro de épicas). */
	epicaNombre: string;
}

export class TareasColaboradorView extends ItemView {
	private plugin: GestorFuncionesPlugin;
	private cfg: VistaColabConfig;
	private renderTimer: number | null = null;
	private seleccionFiltro = new Set<string>();
	private tiposFiltro = new Set<string>();
	private desde = 1;
	private hasta: number;
	/** Filtro de épicas (valores seleccionados). Todas marcadas por defecto. */
	private epicaSeleccion = new Set<string>();
	private epicaConocidas = new Set<string>();
	/** Mostrar incidencias completadas (tachadas). Marcado por defecto. */
	private verCompletadas = true;
	/** Grupos a pintar (por colaborador o por épica/historia, según config). */
	private grupos: Array<{
		clave: string;
		color?: string;
		conProgreso: boolean;
		/** Solo en modo colaborador: clave del filtro (nombre o "Sin asignar"). */
		filtroClave?: string;
		items: IncidenciaAsignada[];
	}> = [];

	constructor(leaf: WorkspaceLeaf, plugin: GestorFuncionesPlugin, cfg: VistaColabConfig) {
		super(leaf);
		this.plugin = plugin;
		this.cfg = cfg;
		this.hasta = plugin.settings.numSprints;
	}

	getViewType(): string {
		return this.cfg?.viewType ?? VIEW_TYPE_COLABORADORES;
	}

	getDisplayText(): string {
		return `${this.cfg?.titulo ?? "Colaboradores"} — Gestión de épicas`;
	}

	getIcon(): string {
		return this.cfg?.icon ?? "users";
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
			const s = this.plugin.settings;
			const sprint = s.sprintActual?.sprint ?? 1;
			this.desde = Math.min(Math.max(sprint, 1), s.numSprints || 1);
			if (this.hasta < this.desde) this.hasta = this.desde;
			await this.recargar();
		} catch (e) {
			console.error("gestion-de-epicas: error en onOpen", e);
			this.render();
		}
	}

	private renderSoon(): void {
		if (this.renderTimer !== null) window.clearTimeout(this.renderTimer);
		this.renderTimer = window.setTimeout(() => {
			this.renderTimer = null;
			void this.recargar();
		}, 150);
	}

	async recargar(): Promise<void> {
		try {
			await this.recolectar();
		} catch (e) {
			console.error("gestion-de-epicas: error al recolectar", e);
		}
		this.render();
	}

	/** Renderiza protegido: ante cualquier error muestra el mensaje en vez de
	 * dejar la pestaña en blanco. */
	render(): void {
		try {
			this.renderInterno();
		} catch (e) {
			console.error("gestion-de-epicas: error al renderizar", e);
			this.contentEl.empty();
			this.contentEl.createEl("p", {
				cls: "gf-kanban-vacio",
				text: `Error al cargar la vista: ${e instanceof Error ? e.message : String(e)}`,
			});
		}
	}

	private listar(ref: FuncRef): Incidencia[] {
		return this.cfg.incluyeTareasPendientes
			? listIncidencias(this.app, ref, this.cfg.registro(this.plugin))
			: listDocumentos(this.app, ref, this.cfg.registro(this.plugin));
	}

	private async recolectar(): Promise<void> {
		this.grupos = [];
		const admin = this.plugin.settings.carpetaAdmin.trim();
		if (!admin) return;

		const visibles = this.plugin.settings.colaboradores.filter((c) => c.visible !== false);
		const nombresVisibles = new Set(visibles.map((c) => c.nombre));
		// Modo colaborador: un grupo por colaborador (en orden) + "sin asignar".
		const porColaborador = new Map<string, IncidenciaAsignada[]>();
		for (const colab of visibles) porColaborador.set(colab.nombre, []);
		const sinAsignar: IncidenciaAsignada[] = [];
		// Modo contexto: un grupo por épica/historia (orden de aparición).
		const porContexto = new Map<string, IncidenciaAsignada[]>();

		const maxSprints = this.plugin.settings.numSprints;
		const filtrar = !(this.desde === 1 && this.hasta === maxSprints);
		const anio = new Date().getFullYear();
		const pasaSprints = async (ref: FuncRef): Promise<boolean> => {
			const sprints = await leerSprints(this.app, ref);
			return sprints.some((s) => s.anio === anio && s.sprint >= this.desde && s.sprint <= this.hasta);
		};

		const recoger = (ref: FuncRef, contexto: string, epicaNombre: string) => {
			if (!this.epicaConocidas.has(epicaNombre)) {
				this.epicaConocidas.add(epicaNombre);
				this.epicaSeleccion.add(epicaNombre);
			}
			for (const inc of this.listar(ref)) {
				const item: IncidenciaAsignada = { ...inc, contexto, epicaNombre };
				if (this.cfg.agruparPor === "contexto") {
					const lista = porContexto.get(contexto) ?? [];
					lista.push(item);
					porContexto.set(contexto, lista);
					continue;
				}
				// Modo colaborador: solo asignados activos; si no queda ninguno, va
				// a "sin asignar" (para que nunca desaparezca).
				const asignados = getAsignados(this.app, inc.file).filter((n) => nombresVisibles.has(n));
				if (asignados.length === 0) {
					sinAsignar.push(item);
					continue;
				}
				for (const nombre of asignados) {
					const lista = porColaborador.get(nombre) ?? [];
					lista.push(item);
					porColaborador.set(nombre, lista);
				}
			}
		};

		for (const epica of listFuncionalidades(this.app, admin)) {
			const epicaPasa = !filtrar || (await pasaSprints(epica));
			if (epicaPasa) recoger(epica, epica.nombre, epica.nombre);
			for (const fn of listFuncionalidadesDe(this.app, epica.folder)) {
				const fnPasa = epicaPasa || (await pasaSprints(fn));
				if (fnPasa) recoger(fn, `${epica.nombre} › ${fn.nombre}`, epica.nombre);
			}
		}

		if (this.cfg.agruparPor === "contexto") {
			for (const clave of [...porContexto.keys()].sort((a, b) => a.localeCompare(b, "es"))) {
				this.grupos.push({ clave, conProgreso: false, items: porContexto.get(clave) ?? [] });
			}
		} else {
			for (const colab of visibles) {
				this.grupos.push({
					clave: colab.nombre,
					color: colab.color,
					conProgreso: true,
					filtroClave: colab.nombre,
					items: porColaborador.get(colab.nombre) ?? [],
				});
			}
			this.grupos.push({
				clave: "Incidencias sin asignar",
				conProgreso: false,
				filtroClave: SIN_ASIGNAR,
				items: sinAsignar,
			});
		}
	}

	private renderInterno(): void {
		const cont = this.contentEl;
		cont.empty();
		cont.addClass("gf-colab");

		if (!this.cfg) {
			cont.createEl("p", { cls: "gf-kanban-vacio", text: "Vista sin configurar." });
			return;
		}

		if (!carpetasGestionListas(this.app)) {
			const aviso = cont.createDiv({ cls: "gf-kanban-aviso" });
			aviso.createEl("p", {
				text: "Crea las carpetas de gestión desde el panel de acciones antes de continuar.",
			});
			const btn = aviso.createEl("button", { text: "Abrir panel de acciones", cls: "mod-cta" });
			btn.addEventListener("click", () => void this.plugin.abrirAcciones());
			return;
		}

		const plural = this.cfg.singular === "documento" ? "documentos" : "incidencias";
		const barra = cont.createDiv({ cls: "gf-roadmap-controles" });
		const cuerpo = cont.createDiv();

		const pasaTipo = (inc: IncidenciaAsignada) =>
			this.tiposFiltro.size === 0 || this.tiposFiltro.has(inc.tipoNombre);
		const pasaEpica = (inc: IncidenciaAsignada) =>
			!this.cfg.conEpicaFilter || this.epicaSeleccion.has(inc.epicaNombre);
		const visiblesDe = (lista: IncidenciaAsignada[]) =>
			lista.filter((i) => pasaTipo(i) && pasaEpica(i));

		const renderCuerpo = () => {
			cuerpo.empty();
			const filtroColab = this.seleccionFiltro;
			let algo = false;

			for (const grupo of this.grupos) {
				// En modo colaborador, el filtro de colaborador decide qué grupos se ven.
				if (
					this.cfg.agruparPor === "colaborador" &&
					filtroColab.size > 0 &&
					!(grupo.filtroClave && filtroColab.has(grupo.filtroClave))
				) {
					continue;
				}
				const items = visiblesDe(grupo.items);
				// Los grupos vacíos solo se muestran en modo colaborador (cada
				// colaborador tiene su tarjeta aunque no tenga elementos).
				if (items.length === 0 && this.cfg.agruparPor === "contexto") continue;
				if (items.length === 0 && grupo.filtroClave === SIN_ASIGNAR) continue;
				this.renderTarjetaGrupo(cuerpo, grupo.clave, items, grupo.color, grupo.conProgreso);
				algo = true;
			}

			if (!algo) {
				cuerpo.createEl("em", {
					cls: "gf-kanban-vacio",
					text: `No hay ${plural} para mostrar.`,
				});
			}
		};

		// Filtro de intervalo de sprints (mismo control que el roadmap).
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
				void this.recargar();
			},
		});
		rango.createEl("span", { text: "fin", cls: "gf-roadmap-lbl" });
		const finCtl = crearSelect({
			parent: rango,
			opciones: opcionesSprint(this.desde),
			valor: String(this.hasta),
			onChange: (v) => {
				this.hasta = Number(v);
				void this.recargar();
			},
		});

		// Filtro de épicas (solo documentos): select con checks, todas por defecto.
		if (this.cfg.conEpicaFilter) {
			barra.createEl("span", { text: "Épica", cls: "gf-roadmap-lbl" });
			const opcionesEpica = [...this.epicaConocidas]
				.sort((a, b) => a.localeCompare(b, "es"))
				.map((n) => ({ valor: n, texto: n }));
			crearMultiSelect({
				parent: barra,
				etiqueta: "Épicas",
				opciones: opcionesEpica,
				seleccion: this.epicaSeleccion,
				onChange: () => renderCuerpo(),
			});
		}

		// Filtro por tipo.
		const etqTipo = this.cfg.singular === "documento" ? "Documento" : "Incidencia";
		barra.createEl("span", { text: etqTipo, cls: "gf-roadmap-lbl" });
		crearSelectorEtiquetas({
			parent: barra,
			etiquetas: this.cfg.registro(this.plugin).filter((i) => i.visible !== false),
			seleccion: this.tiposFiltro,
			textoBtn: `Filtrar por ${this.cfg.singular}`,
			textoVacio: `No hay tipos de ${this.cfg.singular}.`,
			onChange: () => renderCuerpo(),
		});

		// Filtro por colaborador (solo en modo colaborador; los documentos no lo tienen).
		if (this.cfg.agruparPor === "colaborador") {
			const colabsFiltro: Etiqueta[] = [
				...this.plugin.settings.colaboradores.filter((c) => c.visible !== false),
				{ nombre: SIN_ASIGNAR, color: "#B9BEC6" },
			];
			barra.createEl("span", { text: "Colaborador", cls: "gf-roadmap-lbl" });
			crearSelectorEtiquetas({
				parent: barra,
				etiquetas: colabsFiltro,
				seleccion: this.seleccionFiltro,
				textoBtn: "Filtrar por colaborador",
				textoVacio: "No hay colaboradores registrados.",
				onChange: () => renderCuerpo(),
			});
		}

		// Ver completadas (solo incidencias).
		if (this.cfg.conMarcarHecha) {
			const verLabel = barra.createEl("label", { cls: "gf-chk" });
			const verChk = verLabel.createEl("input", { type: "checkbox" });
			verChk.checked = this.verCompletadas;
			verLabel.appendText(" Ver completadas");
			verChk.addEventListener("change", () => {
				this.verCompletadas = verChk.checked;
				renderCuerpo();
			});
		}

		const borrar = barra.createEl("button", { text: "Borrar filtros", cls: "gf-roadmap-recargar" });
		borrar.addEventListener("click", () => {
			this.tiposFiltro.clear();
			this.seleccionFiltro.clear();
			this.render();
		});

		const recargar = barra.createEl("button", { text: "Recargar", cls: "gf-roadmap-recargar" });
		recargar.addEventListener("click", () => void this.recargar());

		renderCuerpo();
	}

	private colorTipo(nombre: string): string {
		return this.cfg.registro(this.plugin).find((i) => i.nombre === nombre)?.color ?? "#B9BEC6";
	}

	private renderTarjetaGrupo(
		cuerpo: HTMLElement,
		titulo: string,
		incidencias: IncidenciaAsignada[],
		color: string | undefined,
		conProgreso: boolean
	): void {
		const tarjeta = cuerpo.createDiv({ cls: "gf-colab-card" });

		const head = tarjeta.createDiv({ cls: "gf-colab-head" });
		if (color) {
			const punto = head.createDiv({ cls: "gf-colab-punto" });
			punto.setCssStyles({ backgroundColor: color });
		}
		head.createEl("span", { text: titulo, cls: "gf-colab-nombre" });

		if (conProgreso) {
			const hechas = incidencias.filter((i) => this.estadoDe(i.file) === "completado").length;
			const total = incidencias.length;
			const pct = total > 0 ? Math.round((hechas / total) * 100) : 0;
			head.createEl("span", {
				cls: "gf-colab-conteo",
				text: total > 0 ? `${hechas} de ${total} hechas (${pct}%)` : "Sin elementos",
			});
			if (total > 0) {
				const barraProg = tarjeta.createDiv({ cls: "gf-kanban-progreso-barra" });
				const relleno = barraProg.createDiv({ cls: "gf-kanban-progreso-relleno" });
				relleno.setCssStyles({ width: `${pct}%` });
			}
		} else {
			head.createEl("span", { cls: "gf-colab-conteo", text: `${incidencias.length}` });
		}

		// Solo en incidencias: las completadas se ocultan salvo "ver completadas".
		// En documentos no se filtra por estado.
		const aMostrar =
			this.cfg.conMarcarHecha && !this.verCompletadas
				? incidencias.filter((i) => this.estadoDe(i.file) !== "completado")
				: incidencias;
		if (aMostrar.length > 0) {
			const ul = tarjeta.createEl("ul", { cls: "gf-colab-lista" });
			for (const inc of aMostrar) {
				const completado = this.estadoDe(inc.file) === "completado";
				const li = ul.createEl("li", { cls: completado ? "gf-colab-hecha" : "" });

				if (this.cfg.conMarcarHecha) {
					const chk = li.createEl("input", { type: "checkbox", cls: "gf-colab-chk" });
					chk.checked = completado;
					chk.addEventListener("change", () => {
						if (chk.checked) {
							new ConfirmacionModal(
								this.app,
								"Marcar como hecha",
								"Esta incidencia se marcará como hecha también en el tablero de incidencias. ¿Continuar?",
								() => void this.marcarEstado(inc.file, "completado"),
								() => {
									chk.checked = false;
								}
							).open();
						} else {
							void this.marcarEstado(inc.file, "por-hacer");
						}
					});
				}

				renderChipEtiqueta(li, inc.tipoNombre, this.colorTipo(inc.tipoNombre));
				const a = li.createEl("a", { cls: "internal-link", text: inc.nombre });
				a.addEventListener("click", (e) => {
					e.preventDefault();
					void this.app.workspace.getLeaf(false).openFile(inc.file);
				});
				li.appendText(` — ${inc.contexto} · ${this.estadoLegible(inc.file)}`);
			}
		}
	}

	private async marcarEstado(file: TFile, estado: string): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			fm.estado = estado;
		});
		await this.recargar();
	}

	private estadoDe(file: TFile): string {
		const estado = (this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined)?.estado;
		return estado ? normalizarEstado(String(estado)) : "por-hacer";
	}

	private estadoLegible(file: TFile): string {
		const v = this.estadoDe(file);
		return this.plugin.settings.carriles.find((e) => e.valor === v)?.nombre ?? v;
	}
}

/** Modal de confirmación con advertencia (aceptar / cancelar). */
class ConfirmacionModal extends Modal {
	constructor(
		app: App,
		private titulo: string,
		private mensaje: string,
		private onOk: () => void,
		private onCancel: () => void
	) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText(this.titulo);
		this.contentEl.createEl("p", { text: this.mensaje });
		const row = this.contentEl.createDiv({ cls: "gf-botones" });
		const cancelar = row.createEl("button", { text: "Cancelar" });
		cancelar.addEventListener("click", () => {
			this.onCancel();
			this.close();
		});
		const ok = row.createEl("button", { text: "Marcar como hecha", cls: "mod-cta" });
		ok.addEventListener("click", () => {
			this.onOk();
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
