import { App, PluginSettingTab, Setting } from "obsidian";
import type GestorFuncionesPlugin from "./main";
import { CARPETA_ACTIVAS, eliminarEtiquetaSprint, renombrarEtiquetaSprint } from "./files";
import { slugify } from "./utils";
import { ExportarConfigModal, ImportarConfigModal } from "./config-io";
import { GestorEtiquetasModal } from "./etiquetas-modal";

export interface KanbanState {
	/** Ruta relativa de la tarea (sin .md) → nombre del carril donde está su tarjeta. */
	tareas: Record<string, string>;
	pendientes: Record<string, string>;
	/** Orden manual de las tarjetas dentro de su carril (rutas en orden). */
	ordenIncidencias: string[];
	/** Filtro de intervalo de sprints; se conserva entre sesiones. */
	filtroSprints: { desde: number; hasta: number };
}

export interface Etiqueta {
	nombre: string;
	/** Color en formato hex (#rrggbb). */
	color: string;
	/** Visibilidad (usada por las etiquetas de sprint); ausente = visible. */
	visible?: boolean;
}

/**
 * Carril del kanban. Es también el "estado" de épicas y funcionalidades: su
 * `valor` se escribe en el frontmatter `estado`. Aplica a todos los tableros.
 */
export interface Carril {
	nombre: string;
	/** Valor que se escribe en el frontmatter `estado`; estable al renombrar. */
	valor: string;
	/** Color del punto del carril. */
	color: string;
	/** Si la columna se muestra en los tableros kanban. */
	visible: boolean;
}

export interface GestorSettings {
	carpetaAdmin: string;
	/** Etiquetas de sprint (se usan al asignar sprints y en el roadmap). */
	etiquetas: Etiqueta[];
	/** Carriles del kanban; también son los estados de épicas/funcionalidades. */
	carriles: Carril[];
	/** Personas asignables a incidencias; mismo formato que las etiquetas. */
	colaboradores: Etiqueta[];
	/** Tipos de incidencia configurables (mismo formato que las etiquetas). */
	incidencias: Etiqueta[];
	/** Tipos de documento configurables (subsistema paralelo a incidencias). */
	documentos: Etiqueta[];
	/** Número de sprints que se manejan (1..N). Limita roadmap, filtros y asignación. */
	numSprints: number;
	/** IDs de acciones marcadas como favoritas (cualquier elemento del panel). */
	favoritos: string[];
	/** Orden manual de las tarjetas en el gestor de funcionalidades (rutas en orden). */
	ordenFunc: string[];
	/** Orden manual de las incidencias en "Incidencias por colaborador" (rutas). */
	ordenIncidenciasColab: string[];
	/** Orden manual de las tarjetas (épica/historia) en el tablero de documentos. */
	ordenGruposDocumentos: string[];
	/** Sprint en curso elegido en el panel; sugiere filtros en roadmap/incidencias. */
	sprintActual: { anio: number; sprint: number };
	kanban: KanbanState;
}

/** Número de sprints por defecto (sin tope máximo). */
export const NUM_SPRINTS_DEFECTO = 24;

export const COLOR_ETIQUETA_DEFECTO = "#5082ff";

/** Colaborador sembrado en la primera ejecución; editable y eliminable. */
export const COLABORADOR_DEFECTO: Etiqueta = { nombre: "Yo", color: COLOR_ETIQUETA_DEFECTO };

/** Tipos de incidencia sembrados por defecto; editables y eliminables. */
export const INCIDENCIAS_DEFECTO: Etiqueta[] = [
	{ nombre: "Tarea", color: "#2D9CFF", visible: true },
	{ nombre: "Pendiente", color: "#FF9F2E", visible: true },
	{ nombre: "Bug", color: "#FA4D56", visible: true },
];

/** Tipos de documento sembrados por defecto; editables y eliminables. */
export const DOCUMENTOS_DEFECTO: Etiqueta[] = [
	{ nombre: "Documento", color: "#2D9CFF", visible: true },
	{ nombre: "Apunte de reunión", color: "#C950E8", visible: true },
	{ nombre: "Regla de negocio", color: "#2BC275", visible: true },
];

/** Carriles por defecto: no pueden eliminarse (sí ocultarse). Sus valores
 * conservan la convención de frontmatter existente. */
export const CARRILES_DEFECTO: Carril[] = [
	{ nombre: "Backlog", valor: "backlog", color: "#B9BEC6", visible: true },
	{ nombre: "Por hacer", valor: "por-hacer", color: "#FFC93C", visible: true },
	{ nombre: "En progreso", valor: "en-progreso", color: "#2D9CFF", visible: true },
	{ nombre: "Hecho", valor: "completado", color: "#2BC275", visible: true },
];

/** Valores de `estado` heredados → su equivalente actual (migración suave de
 * notas y configuraciones antiguas; p. ej. "pendiente" pasó a "por-hacer"). */
const ESTADO_LEGACY: Record<string, string> = { pendiente: "por-hacer" };

export function normalizarEstado(valor: string): string {
	return ESTADO_LEGACY[valor] ?? valor;
}

export const DEFAULT_SETTINGS: GestorSettings = {
	carpetaAdmin: CARPETA_ACTIVAS,
	etiquetas: [],
	carriles: CARRILES_DEFECTO.map((c) => ({ ...c })),
	colaboradores: [{ ...COLABORADOR_DEFECTO }],
	incidencias: INCIDENCIAS_DEFECTO.map((i) => ({ ...i })),
	documentos: DOCUMENTOS_DEFECTO.map((i) => ({ ...i })),
	numSprints: NUM_SPRINTS_DEFECTO,
	favoritos: [],
	ordenFunc: [],
	ordenIncidenciasColab: [],
	ordenGruposDocumentos: [],
	sprintActual: { anio: new Date().getFullYear(), sprint: 1 },
	kanban: {
		tareas: {},
		pendientes: {},
		ordenIncidencias: [],
		filtroSprints: { desde: 1, hasta: NUM_SPRINTS_DEFECTO },
	},
};

export function esCarrilDefecto(carril: Carril): boolean {
	return CARRILES_DEFECTO.some((c) => c.valor === carril.valor);
}

export class GestorSettingTab extends PluginSettingTab {
	plugin: GestorFuncionesPlugin;

	constructor(app: App, plugin: GestorFuncionesPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName("Configuración del Sprint").setHeading();
		this.renderSprintCard(containerEl);

		this.renderTarjeta(
			"Carriles Kanban",
			"Aquí puedes configurar los carriles que aparecen en los tableros kanban.",
			[
				{
					texto: "Configurar carriles…",
					onClick: () =>
						new GestorEtiquetasModal(this.plugin, {
							titulo: "Carriles Kanban",
							nuevoNombre: "Nuevo carril",
							conVisible: true,
							tituloVisible: "Mostrar este carril en los tableros kanban",
							puedeEliminar: (et) => !esCarrilDefecto(et as Carril),
							nuevoItem: (nombre, color): Carril => ({
								nombre,
								valor: slugify(nombre) || nombre,
								color,
								visible: true,
							}),
							secciones: [
								{
									id: "carriles",
									titulo: "Carriles",
									getLista: () => this.plugin.settings.carriles,
								},
							],
						}).open(),
				},
			]
		);

		this.renderTarjeta(
			"Importar / exportar configuración",
			"Descarga o carga la configuración del plugin en un archivo .json.",
			[
				{ texto: "Exportar…", onClick: () => new ExportarConfigModal(this.plugin).open() },
				{
					texto: "Importar…",
					onClick: () =>
						new ImportarConfigModal(this.plugin, () => this.display()).open(),
				},
			]
		);

		new Setting(containerEl)
			.setName("Apoyar el desarrollo")
			.setDesc("Si este plugin te resulta útil, puedes invitarme un café.")
			.addButton((btn) =>
				btn
					.setButtonText("Buy Me a Coffee")
					.setCta()
					.onClick(() => {
						window.open("https://buymeacoffee.com/leonardoruano");
					})
			);
	}

	/** Tarjeta con título, descripción a la izquierda y botones a la derecha. */
	private renderTarjeta(
		titulo: string,
		desc: string,
		acciones: Array<{ texto: string; onClick: () => void }>
	): void {
		new Setting(this.containerEl).setName(titulo).setHeading();
		const card = this.containerEl.createDiv({ cls: "gf-sprint-card" });
		const fila = card.createDiv({ cls: "gf-card-fila" });
		fila.createEl("span", { cls: "gf-card-desc", text: desc });
		for (const a of acciones) {
			const btn = fila.createEl("button", { cls: "gf-sprint-card-btn", text: a.texto });
			btn.addEventListener("click", a.onClick);
		}
	}

	// ----- Configuración del Sprint (tarjeta) -----

	/** Tarjeta que reúne el número de sprints y el acceso a las etiquetas de
	 * sprint, con un estilo de bloque destacado. */
	private renderSprintCard(cont: HTMLElement): void {
		const card = cont.createDiv({ cls: "gf-sprint-card" });
		card.createEl("p", {
			cls: "gf-sprint-card-desc",
			text:
				`Aquí puedes configurar el número de sprints que se incluyen en tu roadmap. ` +
				`Las etiquetas que agregues pueden asignarse a cada sprint para identificarlos ` +
				`visualmente.`,
		});

		const fila = card.createDiv({ cls: "gf-sprint-card-fila" });
		fila.createEl("label", { cls: "gf-sprint-card-label", text: "Número de sprints" });

		const input = fila.createEl("input", { type: "number", cls: "gf-sprint-card-input" });
		input.min = "1";
		input.value = String(this.plugin.settings.numSprints);
		const guardar = async () => {
			let n = Math.trunc(Number(input.value));
			if (!Number.isFinite(n) || n < 1) n = 1;
			input.value = String(n);
			this.plugin.settings.numSprints = n;
			// El filtro de sprints del tablero no puede exceder el nuevo tope.
			const f = this.plugin.settings.kanban.filtroSprints;
			if (f.hasta > n) f.hasta = n;
			if (f.desde > n) f.desde = n;
			await this.plugin.saveSettings();
		};
		input.addEventListener("change", () => void guardar());

		const btn = fila.createEl("button", {
			cls: "gf-sprint-card-btn",
			text: "Configurar equipos…",
		});
		btn.addEventListener("click", () =>
			new GestorEtiquetasModal(this.plugin, {
				titulo: "Configurar equipos",
				conVisible: true,
				avisoEliminar: "Se quitará de todos los sprints donde esté asignada. No se elimina ninguna carpeta.",
				alRenombrar: (ant, nue) =>
					renombrarEtiquetaSprint(this.plugin.app, this.plugin.settings.carpetaAdmin, ant, nue),
				alEliminar: (nombre) =>
					eliminarEtiquetaSprint(this.plugin.app, this.plugin.settings.carpetaAdmin, nombre),
				secciones: [
					{
						id: "sprint",
						titulo: "Etiquetas de sprint",
						getLista: () => this.plugin.settings.etiquetas,
					},
				],
			}).open()
		);
	}
}
