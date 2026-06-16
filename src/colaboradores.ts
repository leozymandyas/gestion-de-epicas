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
	titulo: "Documentos por épica",
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
	/** Si ya se aplicó la selección por defecto del filtro de colaborador. */
	private filtroColabInit = false;
	private tiposFiltro = new Set<string>();
	private desde = 1;
	private hasta: number;
	/** Filtro de épicas (valores seleccionados). Todas marcadas por defecto. */
	private epicaSeleccion = new Set<string>();
	private epicaConocidas = new Set<string>();
	/** Mostrar incidencias completadas (tachadas). Marcado por defecto. */
	private verCompletadas = true;
	/** Arrastre en curso (reordenar tarjetas de colaborador o incidencias). Para
	 * items, `origen` es el grupo (colaborador) desde el que se arrastra. */
	private arrastre: { tipo: "grupo" | "item"; valor: string; origen?: string } | null = null;
	/** Grupos a pintar (por colaborador o por épica/historia, según config). */
	private grupos: Array<{
		clave: string;
		color?: string;
		conProgreso: boolean;
		/** Solo en modo colaborador: clave del filtro (nombre o "Sin asignar"). */
		filtroClave?: string;
		/** Solo en modo contexto (documentos): la épica/historia del grupo. */
		ref?: FuncRef;
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
			// Cambios de frontmatter (p. ej. marcar como hecha) → refrescar con la
			// caché ya actualizada.
			this.registerEvent(this.app.metadataCache.on("changed", (file) => refrescar(file)));
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
		this.aplicarFiltroColabPorDefecto();
		this.render();
	}

	/** La primera vez (modo colaborador) deja marcados en el filtro solo los
	 * colaboradores que tienen incidencias asignadas + "Sin asignar". Después
	 * respeta lo que elija el usuario. */
	private aplicarFiltroColabPorDefecto(): void {
		if (this.cfg.agruparPor !== "colaborador" || this.filtroColabInit) return;
		this.filtroColabInit = true;
		for (const g of this.grupos) {
			if (g.filtroClave && g.filtroClave !== SIN_ASIGNAR && g.items.length > 0) {
				this.seleccionFiltro.add(g.filtroClave);
			}
		}
		this.seleccionFiltro.add(SIN_ASIGNAR);
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
		const refPorContexto = new Map<string, FuncRef>();

		const maxSprints = this.plugin.settings.numSprints;
		const filtrar = !(this.desde === 1 && this.hasta === maxSprints);
		const anio = new Date().getFullYear();
		const pasaSprints = async (ref: FuncRef): Promise<boolean> => {
			const sprints = await leerSprints(this.app, ref);
			return sprints.some((s) => s.anio === anio && s.sprint >= this.desde && s.sprint <= this.hasta);
		};

		const recoger = (ref: FuncRef, contexto: string, epicaNombre: string) => {
			refPorContexto.set(contexto, ref);
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
			// Orden manual guardado; las no listadas, alfabéticas al final.
			const orden = this.plugin.settings.ordenGruposDocumentos;
			const idx = new Map(orden.map((c, i) => [c, i] as const));
			const claves = [...porContexto.keys()].sort((a, b) => {
				const ia = idx.get(a);
				const ib = idx.get(b);
				if (ia !== undefined && ib !== undefined) return ia - ib;
				if (ia !== undefined) return -1;
				if (ib !== undefined) return 1;
				return a.localeCompare(b, "es");
			});
			for (const clave of claves) {
				this.grupos.push({
					clave,
					conProgreso: false,
					filtroClave: clave,
					ref: refPorContexto.get(clave),
					items: porContexto.get(clave) ?? [],
				});
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
				const items = this.ordenarItems(visiblesDe(grupo.items));
				// Los grupos vacíos solo se muestran en modo colaborador (cada
				// colaborador tiene su tarjeta aunque no tenga elementos).
				if (items.length === 0 && this.cfg.agruparPor === "contexto") continue;
				if (items.length === 0 && grupo.filtroClave === SIN_ASIGNAR) continue;
				// Tarjetas reordenables: colaboradores (no "Sin asignar") y, en
				// documentos, las épicas/historias.
				const dragClave =
					grupo.filtroClave && grupo.filtroClave !== SIN_ASIGNAR
						? grupo.filtroClave
						: undefined;
				this.renderTarjetaGrupo(cuerpo, grupo.clave, items, grupo.color, grupo.conProgreso, dragClave, grupo.filtroClave, grupo.ref);
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
		conProgreso: boolean,
		dragClave?: string,
		grupoFiltro?: string,
		ref?: FuncRef
	): void {
		// Solo en modo colaborador se puede reasignar arrastrando incidencias entre
		// carriles (cada carril es un colaborador, o "Sin asignar").
		const reasignable = this.cfg.agruparPor === "colaborador";
		const tarjeta = cuerpo.createDiv({ cls: "gf-colab-card" });

		// Soltar una incidencia en el carril (no sobre otra) la reasigna a este
		// colaborador (o la deja sin asignar). Pide confirmación.
		if (reasignable) {
			tarjeta.addEventListener("dragover", (e) => {
				if (this.arrastre?.tipo !== "item" || this.arrastre.origen === grupoFiltro) return;
				e.preventDefault();
				tarjeta.addClass("gf-drop-card");
			});
			tarjeta.addEventListener("dragleave", () => tarjeta.removeClass("gf-drop-card"));
			tarjeta.addEventListener("drop", (e) => {
				if (this.arrastre?.tipo !== "item" || this.arrastre.origen === grupoFiltro) return;
				e.preventDefault();
				tarjeta.removeClass("gf-drop-card");
				this.confirmarReasignar(this.arrastre.valor, grupoFiltro);
			});
		}

		const head = tarjeta.createDiv({ cls: "gf-colab-head" });
		if (color) {
			const punto = head.createDiv({ cls: "gf-colab-punto" });
			punto.setCssStyles({ backgroundColor: color });
		}
		if (ref) {
			// Modo contexto (documentos): el título abre la nota de la épica/historia
			// y se muestran sus colaboradores asignados.
			const tituloEl = head.createEl("a", { text: titulo, cls: "gf-colab-nombre internal-link" });
			tituloEl.addEventListener("click", (e) => {
				e.preventDefault();
				void this.plugin.mostrarNota(ref.file);
			});
			for (const c of getAsignados(this.app, ref.file).filter((n) =>
				this.plugin.settings.colaboradores.some((x) => x.nombre === n && x.visible !== false)
			)) {
				const colColor = this.plugin.settings.colaboradores.find((x) => x.nombre === c)?.color ?? "#B9BEC6";
				renderChipEtiqueta(head, c, colColor);
			}
		} else {
			head.createEl("span", { text: titulo, cls: "gf-colab-nombre" });
		}

		// Reordenar tarjetas de colaborador: la cabecera es el asa de arrastre y la
		// tarjeta es zona de soltado (inserta la arrastrada antes de esta).
		if (dragClave) {
			head.addClass("gf-arrastrable");
			head.draggable = true;
			head.addEventListener("dragstart", () => {
				this.arrastre = { tipo: "grupo", valor: dragClave };
			});
			head.addEventListener("dragend", () => {
				this.arrastre = null;
			});
			tarjeta.addEventListener("dragover", (e) => {
				if (this.arrastre?.tipo !== "grupo") return;
				e.preventDefault();
				tarjeta.addClass("gf-drop-card");
			});
			tarjeta.addEventListener("dragleave", () => tarjeta.removeClass("gf-drop-card"));
			tarjeta.addEventListener("drop", (e) => {
				if (this.arrastre?.tipo !== "grupo") return;
				e.preventDefault();
				tarjeta.removeClass("gf-drop-card");
				const origen = this.arrastre.valor;
				if (origen !== dragClave) void this.moverGrupo(origen, dragClave);
			});
		}

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

				// Reordenar elementos dentro de la tarjeta (arrastrar uno sobre otro).
				{
					li.draggable = true;
					li.addClass("gf-arrastrable");
					li.addEventListener("dragstart", (e) => {
						this.arrastre = { tipo: "item", valor: inc.file.path, origen: grupoFiltro };
						e.stopPropagation();
					});
					li.addEventListener("dragend", () => {
						this.arrastre = null;
					});
					li.addEventListener("dragover", (e) => {
						if (this.arrastre?.tipo !== "item") return;
						e.preventDefault();
						e.stopPropagation();
						li.addClass("gf-drop-card");
					});
					li.addEventListener("dragleave", () => li.removeClass("gf-drop-card"));
					li.addEventListener("drop", (e) => {
						if (this.arrastre?.tipo !== "item") return;
						e.preventDefault();
						e.stopPropagation();
						li.removeClass("gf-drop-card");
						const origen = this.arrastre.valor;
						// Distinto carril (colaborador): reasignar; mismo carril: reordenar.
						if (reasignable && this.arrastre.origen !== grupoFiltro) {
							this.confirmarReasignar(origen, grupoFiltro);
						} else if (origen !== inc.file.path) {
							void this.moverItem(origen, inc.file.path);
						}
					});
				}

				if (this.cfg.conMarcarHecha) {
					const chk = li.createEl("input", { type: "checkbox", cls: "gf-colab-chk" });
					chk.checked = completado;
					chk.addEventListener("change", () => {
						if (chk.checked) {
							new ConfirmacionModal(
								this.app,
								"Marcar como hecha",
								"¿Marcar esta incidencia como hecha? Su estado pasará a completado.",
								"Marcar como hecha",
								() => void this.marcarEstado(inc.file, "completado"),
								() => {
									chk.checked = false;
								}
							).open();
						} else {
							new ConfirmacionModal(
								this.app,
								"Marcar como pendiente",
								"¿Quitar el estado de completado de esta incidencia? Volverá a Por hacer.",
								"Marcar como pendiente",
								() => void this.marcarEstado(inc.file, "por-hacer"),
								() => {
									chk.checked = true;
								}
							).open();
						}
					});
				}

				renderChipEtiqueta(li, inc.tipoNombre, this.colorTipo(inc.tipoNombre));
				const a = li.createEl("a", { cls: "internal-link", text: inc.nombre });
				a.addEventListener("click", (e) => {
					e.preventDefault();
					// Si la nota ya está abierta, va a esa pestaña en vez de duplicarla.
					void this.plugin.mostrarNota(inc.file);
				});
				// En documentos el contexto ya es el título del grupo; en
				// incidencias mostramos solo la épica/historia (sin el estado).
				if (this.cfg.agruparPor === "colaborador") {
					li.appendText(` — ${inc.contexto}`);
				}
			}
		}
	}

	private async marcarEstado(file: TFile, estado: string): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			fm.estado = estado;
		});
		// No recargamos aquí: la caché de metadatos aún puede estar desfasada. El
		// evento metadataCache "changed" dispara el refresco con el estado ya nuevo.
	}

	private estadoDe(file: TFile): string {
		const estado = (this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined)?.estado;
		return estado ? normalizarEstado(String(estado)) : "por-hacer";
	}

	// ===== Reordenamiento manual =====

	/** Ordena las incidencias según el orden manual guardado; las no listadas
	 * conservan su orden de recolección. */
	private ordenarItems(items: IncidenciaAsignada[]): IncidenciaAsignada[] {
		const orden = this.plugin.settings.ordenIncidenciasColab;
		const idx = new Map(orden.map((p, i) => [p, i] as const));
		return [...items].sort((a, b) => {
			const ia = idx.get(a.file.path);
			const ib = idx.get(b.file.path);
			if (ia !== undefined && ib !== undefined) return ia - ib;
			if (ia !== undefined) return -1;
			if (ib !== undefined) return 1;
			return 0;
		});
	}

	/** Reubica `path` antes de `beforeKey` en el orden manual de incidencias.
	 * Reconstruye con todas las incidencias visibles para que el orden sea estable. */
	private async moverItem(path: string, beforeKey: string): Promise<void> {
		const orden = this.plugin.settings.ordenIncidenciasColab;
		const idx = new Map(orden.map((p, i) => [p, i] as const));
		const todas = [...new Set(this.grupos.flatMap((g) => g.items.map((i) => i.file.path)))].sort(
			(a, b) => {
				const ia = idx.get(a);
				const ib = idx.get(b);
				if (ia !== undefined && ib !== undefined) return ia - ib;
				if (ia !== undefined) return -1;
				if (ib !== undefined) return 1;
				return 0;
			}
		);
		const lista = todas.filter((p) => p !== path);
		const pos = lista.indexOf(beforeKey);
		if (pos === -1) lista.push(path);
		else lista.splice(pos, 0, path);
		this.plugin.settings.ordenIncidenciasColab = lista;
		await this.plugin.saveSettings();
		await this.recargar();
	}

	/** Reordena las tarjetas moviendo `clave` antes de `beforeClave`. En modo
	 * colaborador reordena settings.colaboradores; en documentos, el orden de
	 * grupos (épica/historia) guardado. */
	private async moverGrupo(clave: string, beforeClave: string): Promise<void> {
		if (this.cfg.agruparPor === "contexto") {
			// Parte del orden actual de los grupos (ya ordenados) para que sea estable.
			const actuales = this.grupos.map((g) => g.clave);
			const orden = actuales.filter((c) => c !== clave);
			const pos = orden.indexOf(beforeClave);
			if (pos === -1) orden.push(clave);
			else orden.splice(pos, 0, clave);
			this.plugin.settings.ordenGruposDocumentos = orden;
			await this.plugin.saveSettings();
			await this.recargar();
			return;
		}
		const cols = this.plugin.settings.colaboradores;
		const i = cols.findIndex((c) => c.nombre === clave);
		if (i < 0) return;
		const [item] = cols.splice(i, 1);
		const pos = cols.findIndex((c) => c.nombre === beforeClave);
		if (pos === -1) cols.push(item);
		else cols.splice(pos, 0, item);
		await this.plugin.saveSettings();
		await this.recargar();
	}

	/** Pide confirmación y reasigna (reemplaza) la incidencia al colaborador del
	 * carril destino; si el destino es "Sin asignar", la deja sin colaboradores. */
	private confirmarReasignar(path: string, destino: string | undefined): void {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return;
		const colaborador = !destino || destino === SIN_ASIGNAR ? null : destino;
		const mensaje = colaborador
			? `¿Reasignar esta incidencia a "${colaborador}"? Se reemplazarán los colaboradores que tenga asignados.`
			: "¿Quitar el colaborador asignado a esta incidencia?";
		new ConfirmacionModal(
			this.app,
			"Reasignar incidencia",
			mensaje,
			colaborador ? "Reasignar" : "Quitar colaborador",
			() => void this.reasignar(file, colaborador),
			() => {
				/* cancelado: no hace nada */
			}
		).open();
	}

	private async reasignar(file: TFile, colaborador: string | null): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			if (colaborador) fm.asignados = [colaborador];
			else delete fm.asignados;
		});
		// El evento metadataCache "changed" refresca la vista con el dato nuevo.
	}
}

/** Modal de confirmación con aceptar / cancelar. Si se cierra con Escape o la X,
 * se considera cancelado (para revertir el checkbox). */
class ConfirmacionModal extends Modal {
	private resuelto = false;

	constructor(
		app: App,
		private titulo: string,
		private mensaje: string,
		private textoOk: string,
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
			this.resuelto = true;
			this.onCancel();
			this.close();
		});
		const ok = row.createEl("button", { text: this.textoOk, cls: "mod-cta" });
		ok.addEventListener("click", () => {
			this.resuelto = true;
			this.onOk();
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.resuelto) this.onCancel();
	}
}
