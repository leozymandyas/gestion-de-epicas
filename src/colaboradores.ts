import { ItemView, TAbstractFile, TFile, WorkspaceLeaf, normalizePath } from "obsidian";
import type GestorFuncionesPlugin from "./main";
import {
	FuncRef,
	Incidencia,
	carpetasGestionListas,
	getAsignados,
	leerSprints,
	listFuncionalidades,
	listFuncionalidadesDe,
	listIncidencias,
} from "./files";
import { Etiqueta, normalizarEstado } from "./settings";
import { renderChipEtiqueta } from "./colores";
import { crearSelectorEtiquetas } from "./modals";
import { crearSelect } from "./ui";

export const VIEW_TYPE_COLABORADORES = "gestor-funciones-colaboradores";

/** Clave del grupo de incidencias sin colaborador asignado. */
const SIN_ASIGNAR = "Sin asignar";

interface IncidenciaAsignada extends Incidencia {
	epica: string;
}

export class TareasColaboradorView extends ItemView {
	private plugin: GestorFuncionesPlugin;
	private renderTimer: number | null = null;
	/** Colaboradores (o "Sin asignar") seleccionados en el filtro; vacío = todos. */
	private seleccionFiltro = new Set<string>();
	/** Tipos de incidencia (nombre) seleccionados en el filtro; vacío = todos. */
	private tiposFiltro = new Set<string>();
	/** Filtro de intervalo de sprints (igual que en Gestión de incidencias). */
	private desde = 1;
	private hasta: number;
	/** Datos recogidos (ya filtrados por sprint) listos para pintar. */
	private porColaborador = new Map<string, IncidenciaAsignada[]>();
	private sinAsignar: IncidenciaAsignada[] = [];

	constructor(leaf: WorkspaceLeaf, plugin: GestorFuncionesPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.hasta = plugin.settings.numSprints;
	}

	getViewType(): string {
		return VIEW_TYPE_COLABORADORES;
	}

	getDisplayText(): string {
		return "Incidencias por colaborador — Gestión de épicas";
	}

	getIcon(): string {
		return "users";
	}

	async onOpen(): Promise<void> {
		const refrescar = (file: TAbstractFile) => {
			const admin = normalizePath(this.plugin.settings.carpetaAdmin.trim() || "/");
			if (file.path === admin || file.path.startsWith(admin + "/")) this.renderSoon();
		};
		this.registerEvent(this.app.vault.on("create", refrescar));
		this.registerEvent(this.app.vault.on("delete", refrescar));
		this.registerEvent(this.app.vault.on("rename", refrescar));
		// Sprint inicio sugerido desde el panel (el usuario puede cambiarlo).
		const s = this.plugin.settings;
		this.desde = Math.min(Math.max(s.sprintActual.sprint, 1), s.numSprints);
		if (this.hasta < this.desde) this.hasta = this.desde;
		await this.recargar();
	}

	private renderSoon(): void {
		if (this.renderTimer !== null) window.clearTimeout(this.renderTimer);
		this.renderTimer = window.setTimeout(() => {
			this.renderTimer = null;
			void this.recargar();
		}, 150);
	}

	/** Relee desde disco (aplicando el filtro de sprints) y vuelve a renderizar. */
	async recargar(): Promise<void> {
		await this.recolectar();
		this.render();
	}

	private async recolectar(): Promise<void> {
		// Solo se consideran los colaboradores activos (con el check marcado).
		const visibles = this.plugin.settings.colaboradores.filter((c) => c.visible !== false);
		const nombresVisibles = new Set(visibles.map((c) => c.nombre));
		this.porColaborador = new Map<string, IncidenciaAsignada[]>();
		for (const colab of visibles) {
			this.porColaborador.set(colab.nombre, []);
		}
		this.sinAsignar = [];

		const admin = this.plugin.settings.carpetaAdmin.trim();
		if (!admin) return;

		// Filtro de intervalo de sprints: si no es el rango completo, solo entran
		// incidencias de épicas/historias con sprints en ese intervalo (año actual).
		const maxSprints = this.plugin.settings.numSprints;
		const filtrar = !(this.desde === 1 && this.hasta === maxSprints);
		const anio = new Date().getFullYear();
		const pasaSprints = async (ref: FuncRef): Promise<boolean> => {
			const sprints = await leerSprints(this.app, ref);
			return sprints.some((s) => s.anio === anio && s.sprint >= this.desde && s.sprint <= this.hasta);
		};

		const recoger = (ref: FuncRef, origen: string) => {
			for (const inc of listIncidencias(this.app, ref, this.plugin.settings.incidencias)) {
				const asignados = getAsignados(this.app, inc.file);
				if (asignados.length === 0) {
					this.sinAsignar.push({ ...inc, epica: origen });
					continue;
				}
				// Las asignaciones a colaboradores desactivados se ignoran.
				for (const nombre of asignados) {
					if (!nombresVisibles.has(nombre)) continue;
					const lista = this.porColaborador.get(nombre) ?? [];
					lista.push({ ...inc, epica: origen });
					this.porColaborador.set(nombre, lista);
				}
			}
		};

		for (const epica of listFuncionalidades(this.app, admin)) {
			const epicaPasa = !filtrar || (await pasaSprints(epica));
			if (epicaPasa) recoger(epica, epica.nombre);
			for (const fn of listFuncionalidadesDe(this.app, epica.folder)) {
				const fnPasa = epicaPasa || (await pasaSprints(fn));
				if (fnPasa) recoger(fn, `${epica.nombre} › ${fn.nombre}`);
			}
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
		const cuerpo = cont.createDiv();

		const pasaTipo = (inc: IncidenciaAsignada) =>
			this.tiposFiltro.size === 0 || this.tiposFiltro.has(inc.tipoNombre);

		const renderCuerpo = () => {
			cuerpo.empty();
			const filtroColab = this.seleccionFiltro;
			let algo = false;

			const nombres = [...this.porColaborador.keys()]
				.filter((n) => filtroColab.size === 0 || filtroColab.has(n))
				.sort((a, b) => a.localeCompare(b, "es"));

			for (const nombre of nombres) {
				const incidencias = (this.porColaborador.get(nombre) ?? []).filter(pasaTipo);
				const color = this.plugin.settings.colaboradores.find((c) => c.nombre === nombre)?.color;
				this.renderTarjetaGrupo(cuerpo, nombre, incidencias, color, true);
				algo = true;
			}

			// Grupo "Incidencias sin asignar".
			const mostrarSin = filtroColab.size === 0 || filtroColab.has(SIN_ASIGNAR);
			const sinFiltradas = this.sinAsignar.filter(pasaTipo);
			if (mostrarSin && sinFiltradas.length > 0) {
				this.renderTarjetaGrupo(cuerpo, "Incidencias sin asignar", sinFiltradas, undefined, false);
				algo = true;
			}

			if (!algo) {
				cuerpo.createEl("em", {
					cls: "gf-kanban-vacio",
					text: "No hay incidencias para mostrar.",
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

		// Filtro por incidencia.
		barra.createEl("span", { text: "Incidencia", cls: "gf-roadmap-lbl" });
		crearSelectorEtiquetas({
			parent: barra,
			etiquetas: this.plugin.settings.incidencias.filter((i) => i.visible !== false),
			seleccion: this.tiposFiltro,
			textoBtn: "Filtrar por incidencia",
			onChange: () => renderCuerpo(),
		});

		// Filtro por colaborador (incluye "Sin asignar").
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

		// Borra solo los filtros por incidencia y por colaborador.
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
		return this.plugin.settings.incidencias.find((i) => i.nombre === nombre)?.color ?? "#B9BEC6";
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
				text: total > 0 ? `${hechas} de ${total} hechas (${pct}%)` : "Sin incidencias",
			});
			if (total > 0) {
				const barraProg = tarjeta.createDiv({ cls: "gf-kanban-progreso-barra" });
				const relleno = barraProg.createDiv({ cls: "gf-kanban-progreso-relleno" });
				relleno.setCssStyles({ width: `${pct}%` });
			}
		} else {
			head.createEl("span", { cls: "gf-colab-conteo", text: `${incidencias.length}` });
		}

		if (incidencias.length > 0) {
			const ul = tarjeta.createEl("ul", { cls: "gf-colab-lista" });
			for (const inc of incidencias) {
				const li = ul.createEl("li");
				renderChipEtiqueta(li, inc.tipoNombre, this.colorTipo(inc.tipoNombre));
				const a = li.createEl("a", { cls: "internal-link", text: inc.nombre });
				a.addEventListener("click", (e) => {
					e.preventDefault();
					void this.app.workspace.getLeaf(false).openFile(inc.file);
				});
				li.appendText(` — ${inc.epica} · ${this.estadoLegible(inc.file)}`);
			}
		}
	}

	private estadoDe(file: TFile): string {
		const estado = (this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined)?.estado;
		return estado ? String(estado) : "pendiente";
	}

	private estadoLegible(file: TFile): string {
		const valor = this.estadoDe(file);
		const v = normalizarEstado(valor);
		return this.plugin.settings.carriles.find((e) => e.valor === v)?.nombre ?? valor;
	}
}
