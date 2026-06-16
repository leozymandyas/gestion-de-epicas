import { Plugin, TFile, addIcon } from "obsidian";
import {
	CARRILES_DEFECTO,
	COLABORADOR_DEFECTO,
	COLOR_ETIQUETA_DEFECTO,
	Carril,
	DEFAULT_SETTINGS,
	DOCUMENTOS_DEFECTO,
	Etiqueta,
	GestorSettings,
	GestorSettingTab,
	OrganizacionDocsEpica,
	INCIDENCIAS_DEFECTO,
	NUM_SPRINTS_DEFECTO,
	normalizarEstado,
} from "./settings";
import {
	carpetasGestionListas,
	eliminarColaborador,
	migrarCarpetasHistorias,
	renombrarColaborador,
	renombrarTipoIncidencia,
} from "./files";
import { aplicarConfigBoveda, guardarConfigBoveda } from "./config-io";
import { registerDashboard } from "./dashboard";
import { AccionesView, VIEW_TYPE_ACCIONES } from "./acciones";
import { KanbanView, VIEW_TYPE_KANBAN } from "./kanban";
import { GestorFuncionalidadesView, VIEW_TYPE_GESTOR_FN } from "./gestor-funcionalidades";
import { RoadmapView, VIEW_TYPE_ROADMAP } from "./roadmap";
import {
	CONFIG_DOCUMENTOS,
	CONFIG_INCIDENCIAS,
	TareasColaboradorView,
	VIEW_TYPE_COLABORADORES,
	VIEW_TYPE_DOCUMENTOS,
} from "./colaboradores";
import { OrganizarDocumentosView, VIEW_TYPE_ORGANIZAR_DOCS } from "./organizar-documentos";
import { HistoriasView, VIEW_TYPE_HISTORIAS } from "./historias";
import { EtiquetarHistoriasView, VIEW_TYPE_ETIQUETAR_HISTORIAS } from "./etiquetar-historias";
import { ClasificarDocumentosView, VIEW_TYPE_CLASIFICAR_DOCS } from "./clasificar-documentos";
import {
	RECLASIFICAR_DOCS,
	RECLASIFICAR_INC,
	ReclasificarTipoView,
	VIEW_TYPE_RECLASIFICAR_DOCS,
	VIEW_TYPE_RECLASIFICAR_INC,
} from "./reclasificar-tipo";
import { MoverIncidenciasView, VIEW_TYPE_MOVER_INC } from "./mover-incidencias";
import { MoverHistoriasView, VIEW_TYPE_MOVER_HISTORIAS } from "./mover-historias";
import { ICONO_PLUGIN, ICONO_PLUGIN_SVG } from "./icono";
import {
	AsignarColaboradorModal,
	AsignarSprintModal,
	AvisoConfiguracionModal,
	CrearFuncionalidadModal,
	CrearFuncionalidadNuevaModal,
	CrearIncidenciaModal,
	CrearPendienteModal,
	CrearTareaModal,
	EditarNombreModal,
	EliminarEpicaHistoriaModal,
	MoverEpicaModal,
} from "./modals";
import { GestorEtiquetasModal } from "./etiquetas-modal";
import { registrarBotonFlotante } from "./menu-contextual";

export type TipoModal =
	| "funcionalidad"
	| "crearfn"
	| "tarea"
	| "pendiente"
	| "sprint"
	| "mover"
	| "asignar"
	| "colaboradores"
	| "configIncidencias"
	| "incidencia"
	| "editarNombre"
	| "configDocumentos"
	| "documento"
	| "eliminarEpicaHistoria";

/** Sanea el mapa de organización por carriles de "Organizar documentos". */
function sanearOrganizacionDocs(valor: unknown): Record<string, OrganizacionDocsEpica> {
	const out: Record<string, OrganizacionDocsEpica> = {};
	if (!valor || typeof valor !== "object") return out;
	for (const [slug, crudo] of Object.entries(valor as Record<string, unknown>)) {
		if (!crudo || typeof crudo !== "object") continue;
		const o = crudo as Record<string, unknown>;
		const carriles = Array.isArray(o.carriles)
			? (o.carriles as unknown[])
					.map((c) => {
						if (!c || typeof c !== "object") return null;
						const r = c as Record<string, unknown>;
						const id = String(r.id ?? "").trim();
						const nombre = String(r.nombre ?? "").trim();
						return id && nombre ? { id, nombre } : null;
					})
					.filter((c): c is { id: string; nombre: string } => c !== null)
			: [];
		const asignacion: Record<string, string> = {};
		if (o.asignacion && typeof o.asignacion === "object") {
			for (const [path, lane] of Object.entries(o.asignacion as Record<string, unknown>)) {
				asignacion[path] = String(lane);
			}
		}
		const orden = Array.isArray(o.orden) ? (o.orden as unknown[]).map(String) : [];
		out[slug] = { carriles, asignacion, orden };
	}
	return out;
}

export default class GestorFuncionesPlugin extends Plugin {
	settings: GestorSettings = DEFAULT_SETTINGS;
	/** Última config escrita a la bóveda (para no reescribir si no cambió). */
	configBovedaUltima = "";

	async onload(): Promise<void> {
		await this.loadSettings();

		// Migra la carpeta heredada "funcionalidades" → "historias" en cada épica.
		this.app.workspace.onLayoutReady(() => void migrarCarpetasHistorias(this.app));

		addIcon(ICONO_PLUGIN, ICONO_PLUGIN_SVG);

		this.addSettingTab(new GestorSettingTab(this.app, this));

		registerDashboard(this);

		// Panel lateral de acciones.
		this.registerView(VIEW_TYPE_ACCIONES, (leaf) => new AccionesView(leaf, this));
		this.addRibbonIcon(ICONO_PLUGIN, "Gestión de épicas: Panel de acciones", () =>
			void this.toggleAcciones()
		);

		// Vistas de pestaña completa; se abren desde el panel de acciones.
		this.registerView(VIEW_TYPE_KANBAN, (leaf) => new KanbanView(leaf, this));
		this.registerView(VIEW_TYPE_GESTOR_FN, (leaf) => new GestorFuncionalidadesView(leaf, this));
		this.registerView(VIEW_TYPE_ROADMAP, (leaf) => new RoadmapView(leaf, this));
		this.registerView(
			VIEW_TYPE_COLABORADORES,
			(leaf) => new TareasColaboradorView(leaf, this, CONFIG_INCIDENCIAS)
		);
		this.registerView(
			VIEW_TYPE_DOCUMENTOS,
			(leaf) => new TareasColaboradorView(leaf, this, CONFIG_DOCUMENTOS)
		);
		this.registerView(
			VIEW_TYPE_ORGANIZAR_DOCS,
			(leaf) => new OrganizarDocumentosView(leaf, this)
		);
		this.registerView(VIEW_TYPE_HISTORIAS, (leaf) => new HistoriasView(leaf, this));
		this.registerView(
			VIEW_TYPE_ETIQUETAR_HISTORIAS,
			(leaf) => new EtiquetarHistoriasView(leaf, this)
		);
		this.registerView(
			VIEW_TYPE_CLASIFICAR_DOCS,
			(leaf) => new ClasificarDocumentosView(leaf, this)
		);
		this.registerView(
			VIEW_TYPE_RECLASIFICAR_DOCS,
			(leaf) => new ReclasificarTipoView(leaf, this, RECLASIFICAR_DOCS)
		);
		this.registerView(
			VIEW_TYPE_RECLASIFICAR_INC,
			(leaf) => new ReclasificarTipoView(leaf, this, RECLASIFICAR_INC)
		);
		this.registerView(VIEW_TYPE_MOVER_INC, (leaf) => new MoverIncidenciasView(leaf, this));
		this.registerView(VIEW_TYPE_MOVER_HISTORIAS, (leaf) => new MoverHistoriasView(leaf, this));

		// Botón flotante "Gestión de épicas" sobre la nota activa: Renombrar,
		// Eliminar, Copiar ruta y Agregar link.
		registrarBotonFlotante(this);

		// Obsidian antepone el nombre del plugin en la paleta:
		// "Gestión de épicas: Crear épica", etc.
		this.addCommand({
			id: "crear-funcionalidad",
			name: "Crear épica",
			callback: () => this.abrirModal("funcionalidad"),
		});
		this.addCommand({
			id: "crear-funcionalidad-modulo",
			name: "Crear historia",
			callback: () => this.abrirModal("crearfn"),
		});
		this.addCommand({
			id: "asignar-etiquetas",
			name: "Etiquetas de historias",
			callback: () => void this.abrirEtiquetarHistorias(),
		});
		this.addCommand({
			id: "configurar-incidencias",
			name: "Configurar incidencias",
			callback: () => this.abrirModal("configIncidencias"),
		});
		this.addCommand({
			id: "crear-incidencia",
			name: "Crear incidencia",
			callback: () => this.abrirModal("incidencia"),
		});
		this.addCommand({
			id: "crear-tarea",
			name: "Crear tarea",
			callback: () => this.abrirModal("tarea"),
		});
		this.addCommand({
			id: "crear-pendiente",
			name: "Crear pendiente",
			callback: () => this.abrirModal("pendiente"),
		});
		this.addCommand({
			id: "asignar-sprints",
			name: "Asignar sprint",
			callback: () => this.abrirModal("sprint"),
		});
		this.addCommand({
			id: "editar-nombre",
			name: "Editar nombre de épica o historia",
			callback: () => this.abrirModal("editarNombre"),
		});
		this.addCommand({
			id: "mover-historia",
			name: "Historias",
			callback: () => void this.abrirHistorias(),
		});
		this.addCommand({
			id: "configurar-documentos",
			name: "Configurar documentos",
			callback: () => this.abrirModal("configDocumentos"),
		});
		this.addCommand({
			id: "crear-documento",
			name: "Crear documento",
			callback: () => this.abrirModal("documento"),
		});
		this.addCommand({
			id: "abrir-documentos",
			name: "Documentos por épica",
			callback: () => void this.abrirDocumentos(),
		});
		this.addCommand({
			id: "organizar-documentos",
			name: "Documentos por segmentos",
			callback: () => void this.abrirOrganizarDocumentos(),
		});
		this.addCommand({
			id: "clasificar-documentos",
			name: "Clasificar documentos",
			callback: () => void this.abrirClasificarDocumentos(),
		});
		this.addCommand({
			id: "reclasificar-documentos",
			name: "Reclasificar documentos",
			callback: () => void this.abrirReclasificarDocumentos(),
		});
		this.addCommand({
			id: "reclasificar-incidencias",
			name: "Reclasificar incidencias",
			callback: () => void this.abrirReclasificarIncidencias(),
		});
		this.addCommand({
			id: "mover-incidencias",
			name: "Mover incidencias entre historias",
			callback: () => void this.abrirMoverIncidencias(),
		});
		this.addCommand({
			id: "mover-historias-tablero",
			name: "Mover historias entre épicas",
			callback: () => void this.abrirMoverHistorias(),
		});
		this.addCommand({
			id: "mover-epica",
			name: "Archivar épicas",
			callback: () => this.abrirModal("mover"),
		});
		this.addCommand({
			id: "eliminar-epica-historia",
			name: "Eliminar épica o historia",
			callback: () => this.abrirModal("eliminarEpicaHistoria"),
		});
		this.addCommand({
			id: "asignar-colaborador",
			name: "Asignar colaborador",
			callback: () => this.abrirModal("asignar"),
		});
		this.addCommand({
			id: "gestion-colaboradores",
			name: "Configurar colaboradores",
			callback: () => this.abrirModal("colaboradores"),
		});
		this.addCommand({
			id: "tareas-por-colaborador",
			name: "Incidencias por colaborador",
			callback: () => void this.abrirTareasColaborador(),
		});
		this.addCommand({
			id: "abrir-tablero-kanban",
			name: "Abrir gestión de incidencias",
			callback: () => void this.abrirKanban(),
		});
		this.addCommand({
			id: "abrir-gestor-funcionalidades",
			name: "Abrir planeación",
			callback: () => void this.abrirGestorFuncionalidades(),
		});
		this.addCommand({
			id: "recargar-tablero",
			name: "Recargar tablero",
			callback: () => {
				const hoja = this.app.workspace.getLeavesOfType(VIEW_TYPE_KANBAN)[0];
				if (hoja && hoja.view instanceof KanbanView) void hoja.view.recargar();
			},
		});
		this.addCommand({
			id: "abrir-roadmap",
			name: "Abrir roadmap",
			callback: () => void this.abrirRoadmap(),
		});
	}

	abrirModal(tipo: TipoModal): void {
		if (!carpetasGestionListas(this.app)) {
			new AvisoConfiguracionModal(this).open();
			return;
		}
		switch (tipo) {
			case "funcionalidad":
				new CrearFuncionalidadModal(this).open();
				break;
			case "crearfn":
				new CrearFuncionalidadNuevaModal(this).open();
				break;
			case "tarea":
				new CrearTareaModal(this).open();
				break;
			case "pendiente":
				new CrearPendienteModal(this).open();
				break;
			case "sprint":
				new AsignarSprintModal(this).open();
				break;
			case "mover":
				new MoverEpicaModal(this).open();
				break;
			case "asignar":
				new AsignarColaboradorModal(this).open();
				break;
			case "colaboradores":
				new GestorEtiquetasModal(this, {
					titulo: "Configurar colaboradores",
					nuevoNombre: "Colaborador",
					conVisible: true,
					avisoEliminar: "Se quitará de las incidencias donde esté asignado. No se elimina ninguna carpeta.",
					alRenombrar: (ant, nue) =>
						renombrarColaborador(this.app, this.settings.carpetaAdmin, this.settings.incidencias, ant, nue),
					alEliminar: (nombre) =>
						eliminarColaborador(this.app, this.settings.carpetaAdmin, this.settings.incidencias, nombre),
					secciones: [
						{
							id: "colab",
							titulo: "Colaboradores",
							getLista: () => this.settings.colaboradores,
						},
					],
				}).open();
				break;
			case "configIncidencias":
				new GestorEtiquetasModal(this, {
					titulo: "Configurar incidencias",
					nuevoNombre: "Incidencia",
					conVisible: true,
					avisoEliminar: "Se quitará el tipo de la configuración. Las incidencias y sus carpetas se conservan.",
					alRenombrar: (ant, nue) =>
						renombrarTipoIncidencia(this.app, this.settings.carpetaAdmin, ant, nue),
					secciones: [
						{
							id: "incidencias",
							titulo: "Incidencias",
							getLista: () => this.settings.incidencias,
						},
					],
				}).open();
				break;
			case "incidencia":
				new CrearIncidenciaModal(this).open();
				break;
			case "editarNombre":
				new EditarNombreModal(this).open();
				break;
			case "configDocumentos":
				new GestorEtiquetasModal(this, {
					titulo: "Configurar documentos",
					nuevoNombre: "Documento",
					conVisible: true,
					avisoEliminar: "Se quitará el tipo de la configuración. Los documentos y sus carpetas se conservan.",
					alRenombrar: (ant, nue) =>
						renombrarTipoIncidencia(this.app, this.settings.carpetaAdmin, ant, nue),
					secciones: [
						{
							id: "documentos",
							titulo: "Documentos",
							getLista: () => this.settings.documentos,
						},
					],
				}).open();
				break;
			case "documento":
				new CrearIncidenciaModal(this, {
					titulo: "Crear documento",
					singular: "documento",
					tipos: () => this.settings.documentos,
					accionConfig: "Configurar documentos",
					conColaboradores: false,
					soloEpica: true,
				}).open();
				break;
			case "eliminarEpicaHistoria":
				new EliminarEpicaHistoriaModal(this).open();
				break;
		}
	}

	/** Abre la nota en una pestaña; si ya está abierta, va a esa pestaña en vez
	 * de duplicarla. Lo usan los tableros al pulsar una tarjeta. */
	async mostrarNota(file: TFile): Promise<void> {
		const abierta = this.app.workspace
			.getLeavesOfType("markdown")
			.find((leaf) => (leaf.view as { file?: TFile | null }).file?.path === file.path);
		if (abierta) {
			await this.app.workspace.revealLeaf(abierta);
			return;
		}
		await this.app.workspace.getLeaf("tab").openFile(file);
	}

	/** El ícono del panel de acciones alterna abrir/cerrar. */
	async toggleAcciones(): Promise<void> {
		const hojas = this.app.workspace.getLeavesOfType(VIEW_TYPE_ACCIONES);
		if (hojas.length > 0) {
			this.app.workspace.detachLeavesOfType(VIEW_TYPE_ACCIONES);
			return;
		}
		await this.abrirAcciones();
	}

	/** Abre el panel de acciones (sin alternar). */
	async abrirAcciones(): Promise<void> {
		const existente = this.app.workspace.getLeavesOfType(VIEW_TYPE_ACCIONES)[0];
		if (existente) {
			await this.app.workspace.revealLeaf(existente);
			return;
		}
		const hoja = this.app.workspace.getLeftLeaf(false);
		if (!hoja) return;
		await hoja.setViewState({ type: VIEW_TYPE_ACCIONES, active: true });
		await this.app.workspace.revealLeaf(hoja);
	}

	async abrirKanban(): Promise<void> {
		await this.abrirVistaEnPestana(VIEW_TYPE_KANBAN);
	}

	async abrirGestorFuncionalidades(): Promise<void> {
		await this.abrirVistaEnPestana(VIEW_TYPE_GESTOR_FN);
	}

	async abrirRoadmap(): Promise<void> {
		await this.abrirVistaEnPestana(VIEW_TYPE_ROADMAP);
	}

	async abrirTareasColaborador(): Promise<void> {
		await this.abrirVistaEnPestana(VIEW_TYPE_COLABORADORES);
	}

	async abrirDocumentos(): Promise<void> {
		await this.abrirVistaEnPestana(VIEW_TYPE_DOCUMENTOS);
	}

	async abrirOrganizarDocumentos(): Promise<void> {
		await this.abrirVistaEnPestana(VIEW_TYPE_ORGANIZAR_DOCS);
	}

	async abrirHistorias(): Promise<void> {
		await this.abrirVistaEnPestana(VIEW_TYPE_HISTORIAS);
	}

	async abrirEtiquetarHistorias(): Promise<void> {
		await this.abrirVistaEnPestana(VIEW_TYPE_ETIQUETAR_HISTORIAS);
	}

	async abrirClasificarDocumentos(): Promise<void> {
		await this.abrirVistaEnPestana(VIEW_TYPE_CLASIFICAR_DOCS);
	}

	async abrirReclasificarDocumentos(): Promise<void> {
		await this.abrirVistaEnPestana(VIEW_TYPE_RECLASIFICAR_DOCS);
	}

	async abrirReclasificarIncidencias(): Promise<void> {
		await this.abrirVistaEnPestana(VIEW_TYPE_RECLASIFICAR_INC);
	}

	async abrirMoverIncidencias(): Promise<void> {
		await this.abrirVistaEnPestana(VIEW_TYPE_MOVER_INC);
	}

	async abrirMoverHistorias(): Promise<void> {
		await this.abrirVistaEnPestana(VIEW_TYPE_MOVER_HISTORIAS);
	}

	/**
	 * Abre la vista como pestaña del área principal. Si quedó anclada en un
	 * panel lateral (layouts guardados de versiones anteriores), la desancla
	 * y la vuelve a abrir como pestaña.
	 */
	private async abrirVistaEnPestana(tipo: string): Promise<void> {
		const existente = this.app.workspace.getLeavesOfType(tipo)[0];
		if (existente && existente.getRoot() === this.app.workspace.rootSplit) {
			await this.app.workspace.revealLeaf(existente);
			return;
		}
		existente?.detach();
		const hoja = this.app.workspace.getLeaf("tab");
		await hoja.setViewState({ type: tipo, active: true });
		await this.app.workspace.revealLeaf(hoja);
	}

	async loadSettings(): Promise<void> {
		const guardado: unknown = await this.loadData();
		// Primera ejecución (sin data.json): se siembra el colaborador por defecto.
		const primeraVez = guardado === null || guardado === undefined;
		const data = ((guardado ?? {}) as Partial<GestorSettings> & {
			etiquetas?: Array<string | Etiqueta>;
			// Campos heredados, solo para migración:
			estados?: Array<Partial<Carril>>;
			kanban?: GestorSettings["kanban"] & { carriles?: unknown };
		});
		// Migración: las etiquetas eran strings antes de tener color.
		const etiquetas: Etiqueta[] = (data.etiquetas ?? []).map((e) =>
			typeof e === "string"
				? { nombre: e, color: COLOR_ETIQUETA_DEFECTO, visible: true }
				: {
						nombre: String(e.nombre),
						color: e.color || COLOR_ETIQUETA_DEFECTO,
						visible: e.visible === undefined ? true : Boolean(e.visible),
				  }
		);
		// Carriles del kanban (también son los estados): los por defecto siempre
		// presentes, con nombre/color/visibilidad guardados; se conservan los
		// personalizados. Migración: si no hay `carriles`, se usan los antiguos
		// `estados` para preservar los nombres renombrados.
		const guardadosCarriles: Array<Partial<Carril>> =
			(Array.isArray(data.carriles) ? data.carriles : data.estados) ?? [];
		const carriles: Carril[] = CARRILES_DEFECTO.map((def) => {
			const g = guardadosCarriles.find(
				(c) => c?.valor && normalizarEstado(String(c.valor)) === def.valor
			);
			return {
				nombre: g?.nombre ? String(g.nombre) : def.nombre,
				valor: def.valor,
				color: g?.color ? String(g.color) : def.color,
				visible: g?.visible === undefined ? def.visible : Boolean(g.visible),
			};
		});
		for (const c of guardadosCarriles) {
			const valor = c?.valor ? normalizarEstado(String(c.valor)) : "";
			if (c?.nombre && valor && !carriles.some((x) => x.valor === valor)) {
				carriles.push({
					nombre: String(c.nombre),
					valor,
					color: c.color ? String(c.color) : COLOR_ETIQUETA_DEFECTO,
					visible: c.visible === undefined ? true : Boolean(c.visible),
				});
			}
		}
		const conVisible = (c: Partial<Etiqueta>): Etiqueta => ({
			nombre: String(c.nombre),
			color: c.color || COLOR_ETIQUETA_DEFECTO,
			visible: c.visible === undefined ? true : Boolean(c.visible),
		});
		const colaboradores: Etiqueta[] = primeraVez
			? [{ ...COLABORADOR_DEFECTO }]
			: (data.colaboradores ?? []).map(conVisible).map((c) =>
					// Migración: el color por defecto antiguo ("#5082ff") quedaba fuera
					// de la paleta cerrada; se reasigna al Azul de la paleta.
					c.color.toLowerCase() === "#5082ff" ? { ...c, color: "#2D9CFF" } : c
			  );
		// Tipos de incidencia: si no hay clave guardada (usuarios previos), se siembran.
		const incidencias: Etiqueta[] =
			data.incidencias === undefined
				? INCIDENCIAS_DEFECTO.map((i) => ({ ...i }))
				: data.incidencias.map(conVisible);
		const documentos: Etiqueta[] =
			data.documentos === undefined
				? DOCUMENTOS_DEFECTO.map((d) => ({ ...d }))
				: data.documentos.map(conVisible);
		const favoritos = (data.favoritos ?? []).map(String);
		// Número de sprints configurable (mínimo 1, sin tope).
		const numCrudo = Math.trunc(Number(data.numSprints));
		const numSprints =
			Number.isFinite(numCrudo) && numCrudo >= 1 ? numCrudo : NUM_SPRINTS_DEFECTO;
		const filtro = data.kanban?.filtroSprints;
		const enRango = (v: number | undefined, defecto: number) =>
			v && v >= 1 && v <= numSprints ? v : defecto;
		const anioValido = (v: unknown): number => {
			const n = Math.trunc(Number(v));
			return Number.isFinite(n) && n >= 1970 && n <= 9999 ? n : new Date().getFullYear();
		};
		this.settings = {
			// La carpeta de épicas activas es fija desde la v6.
			carpetaAdmin: DEFAULT_SETTINGS.carpetaAdmin,
			etiquetas,
			carriles,
			colaboradores,
			incidencias,
			documentos,
			numSprints,
			favoritos,
			ordenFunc: (data.ordenFunc ?? []).map(String),
			ordenIncidenciasColab: (data.ordenIncidenciasColab ?? []).map(String),
			ordenGruposDocumentos: (data.ordenGruposDocumentos ?? []).map(String),
			organizacionDocs: sanearOrganizacionDocs(data.organizacionDocs),
			sprintActual: {
				anio: anioValido(data.sprintActual?.anio),
				sprint: enRango(data.sprintActual?.sprint, 1),
			},
			kanban: {
				tareas: { ...(data.kanban?.tareas ?? {}) },
				pendientes: { ...(data.kanban?.pendientes ?? {}) },
				ordenIncidencias: (data.kanban?.ordenIncidencias ?? []).map(String),
				filtroSprints: {
					desde: enRango(filtro?.desde, 1),
					hasta: enRango(filtro?.hasta, numSprints),
				},
			},
		};

		// Configuración compartida guardada en la bóveda: si existe, manda (para
		// usar la misma bóveda en otro equipo sin reconfigurar). Si no, se siembra.
		const aplicada = await aplicarConfigBoveda(this);
		if (!aplicada) await guardarConfigBoveda(this);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		// Refleja los cambios en el archivo de configuración de la bóveda.
		await guardarConfigBoveda(this);
	}
}
