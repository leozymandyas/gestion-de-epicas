import { ItemView, Modal, Notice, TAbstractFile, WorkspaceLeaf, setIcon } from "obsidian";
import type GestorFuncionesPlugin from "./main";
import {
	CARPETA_ACTIVAS,
	CARPETA_INACTIVAS,
	carpetasGestionListas,
	crearCarpetasGestion,
} from "./files";
import { ICONO_PLUGIN, crearIconoTab } from "./icono";
import { AnioPickerModal, crearSelect } from "./ui";

export const VIEW_TYPE_ACCIONES = "gestor-funciones-acciones";

interface Accion {
	id: string;
	icono: string;
	texto: string;
	accion: (plugin: GestorFuncionesPlugin) => void;
}

/** Registro completo de acciones integradas (id estable → icono, texto, callback). */
const REGISTRO: Accion[] = [
	// Épicas — administración
	{ id: "crear-epica", icono: "folder-plus", texto: "Crear épica", accion: (p) => p.abrirModal("funcionalidad") },
	{ id: "crear-funcionalidad", icono: "puzzle", texto: "Crear historia", accion: (p) => p.abrirModal("crearfn") },
	{ id: "etiquetas-epica", icono: "tags", texto: "Configurar etiquetas", accion: (p) => p.abrirModal("etiquetasEpica") },
	{ id: "asignar-etiquetas", icono: "tag", texto: "Etiquetar historias", accion: (p) => p.abrirModal("asignarEtiquetas") },
	{ id: "archivar-epica", icono: "archive", texto: "Archivar épicas", accion: (p) => p.abrirModal("mover") },
	{ id: "asignar-sprint", icono: "calendar-days", texto: "Asignar sprint", accion: (p) => p.abrirModal("sprint") },
	// Épicas — tableros
	{ id: "roadmap", icono: "map", texto: "Roadmap", accion: (p) => void p.abrirRoadmap() },
	{ id: "gestor-funcionalidades", icono: "kanban-square", texto: "Gestión de historias", accion: (p) => void p.abrirGestorFuncionalidades() },
	// Incidencias
	{ id: "configurar-incidencias", icono: "settings-2", texto: "Configurar incidencias", accion: (p) => p.abrirModal("configIncidencias") },
	{ id: "crear-incidencia", icono: "circle-dot", texto: "Crear incidencia", accion: (p) => p.abrirModal("incidencia") },
	// Colaboradores
	{ id: "colaboradores", icono: "users", texto: "Configurar colaboradores", accion: (p) => p.abrirModal("colaboradores") },
	{ id: "asignar-colaborador", icono: "user-plus", texto: "Asignar colaborador", accion: (p) => p.abrirModal("asignar") },
	// Incidencias — tableros
	{ id: "gestion-incidencias", icono: "kanban-square", texto: "Gestión de incidencias", accion: (p) => void p.abrirKanban() },
	{ id: "incidencias-por-colaborador", icono: "user-check", texto: "Incidencias por colaborador", accion: (p) => void p.abrirTareasColaborador() },
];

const POR_ID = new Map(REGISTRO.map((a) => [a.id, a]));

/** Estructura de secciones del panel; `fija` = no se puede ocultar. */
const SECCIONES_PANEL: Array<{ id: string; titulo: string; acciones: string[] }> = [
	{ id: "epicas-admin", titulo: "Administración", acciones: ["crear-epica", "crear-funcionalidad", "etiquetas-epica", "asignar-etiquetas", "archivar-epica"] },
	{ id: "epicas-tableros", titulo: "Tableros", acciones: ["roadmap", "gestor-funcionalidades"] },
	{ id: "incidencias", titulo: "Incidencias", acciones: ["configurar-incidencias", "crear-incidencia"] },
	{ id: "colaboradores", titulo: "Colaboradores", acciones: ["colaboradores", "asignar-colaborador"] },
	{ id: "incidencias-tableros", titulo: "Tableros", acciones: ["gestion-incidencias", "incidencias-por-colaborador"] },
];

/**
 * Pestañas del panel y las secciones que muestra cada una. "favoritos" es
 * especial (no agrupa secciones). Las pestañas de incidencias y colaboradores
 * se ocultan si su sección está desactivada en los ajustes.
 */
const TABS: Array<{ id: string; titulo: string; secciones: string[] }> = [
	{ id: "favoritos", titulo: "Favoritos", secciones: [] },
	{ id: "epicas", titulo: "Épicas", secciones: ["epicas-admin", "epicas-tableros"] },
	{ id: "incidencias", titulo: "Incidencias", secciones: ["incidencias", "colaboradores", "incidencias-tableros"] },
];

/** Resuelve un id de acción integrada a su acción ejecutable. */
function resolverAccion(_plugin: GestorFuncionesPlugin, id: string): Accion | null {
	return POR_ID.get(id) ?? null;
}

/** Lista de todas las acciones seleccionables del panel. */
export function listarTodasLasAcciones(_plugin: GestorFuncionesPlugin): Accion[] {
	return [...REGISTRO];
}

/** Panel lateral con los accesos del plugin, agrupados por secciones. */
export class AccionesView extends ItemView {
	private plugin: GestorFuncionesPlugin;
	/** Pestaña activa; no se persiste entre sesiones. */
	/** Pestaña activa; null hasta el primer render (se elige según haya favoritos). */
	private tabActiva: string | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: GestorFuncionesPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_ACCIONES;
	}

	getDisplayText(): string {
		return "Gestión de épicas";
	}

	getIcon(): string {
		return ICONO_PLUGIN;
	}

	async onOpen(): Promise<void> {
		const refrescar = (file: TAbstractFile) => {
			if (file.path === CARPETA_ACTIVAS || file.path === CARPETA_INACTIVAS) this.render();
		};
		this.registerEvent(this.app.vault.on("create", refrescar));
		this.registerEvent(this.app.vault.on("delete", refrescar));
		this.render();
	}

	/** Acciones de una sección del panel. */
	private accionesDeSeccion(secId: string): Accion[] {
		const sec = SECCIONES_PANEL.find((s) => s.id === secId);
		if (!sec) return [];
		const out: Accion[] = [];
		for (const id of sec.acciones) {
			const a = POR_ID.get(id);
			if (a) out.push(a);
		}
		return out;
	}

	render(): void {
		const cont = this.contentEl;
		cont.empty();
		cont.addClass("gf-acciones");

		// Hasta que existan las carpetas de gestión, solo se ofrece crearlas.
		if (!carpetasGestionListas(this.app)) {
			const btn = cont.createEl("button", { cls: "gf-accion mod-cta" });
			const icono = btn.createSpan({ cls: "gf-accion-icono" });
			setIcon(icono, "folder-plus");
			btn.createSpan({ text: "Crear carpetas de gestión" });
			btn.addEventListener("click", () => void (async () => {
				try {
					await crearCarpetasGestion(this.app);
					new Notice("Gestión de épicas: carpetas de gestión creadas.");
					this.render();
				} catch (e) {
					console.error(e);
					new Notice("Gestión de épicas: no se pudieron crear las carpetas.");
				}
			})());
			cont.createDiv({
				cls: "gf-campo-aviso",
				text: 'Se crearán "Épicas" y "Épicas archivadas" en la raíz del vault.',
			});
			return;
		}

		// Selector de "sprint en curso": permanece sobre las pestañas en todas
		// ellas y se guarda entre sesiones (sugiere filtros en roadmap/incidencias).
		this.renderSprintSelector(cont);

		// Pestaña por defecto: Favoritos si hay alguno, si no Épicas.
		if (this.tabActiva === null) {
			this.tabActiva = this.plugin.settings.favoritos.length > 0 ? "favoritos" : "epicas";
		}
		if (!TABS.some((t) => t.id === this.tabActiva)) this.tabActiva = "favoritos";
		this.renderTabs(cont);

		const contenido = cont.createDiv({ cls: "gf-tab-contenido" });
		if (this.tabActiva === "favoritos") {
			this.renderFavoritos(contenido);
			return;
		}
		const tab = TABS.find((t) => t.id === this.tabActiva);
		const conEtiqueta = (tab?.secciones.length ?? 0) > 1;
		for (const secId of tab?.secciones ?? []) {
			const sec = SECCIONES_PANEL.find((s) => s.id === secId);
			if (!sec) continue;
			this.renderSeccion(contenido, conEtiqueta ? sec.titulo : null, this.accionesDeSeccion(secId));
		}
	}

	/** Selector "Sprint en curso": año (datepicker) + sprint. Persiste en ajustes. */
	private renderSprintSelector(cont: HTMLElement): void {
		const s = this.plugin.settings;
		if (s.sprintActual.sprint > s.numSprints) s.sprintActual.sprint = s.numSprints;
		const wrap = cont.createDiv({ cls: "gf-acciones-sprint" });
		wrap.createDiv({ cls: "gf-acciones-sprint-titulo", text: "Sprint en curso:" });
		const fila = wrap.createDiv({ cls: "gf-acciones-sprint-fila" });

		const anioBtn = fila.createEl("button", {
			cls: "gf-multiselect-btn gf-acciones-anio",
			text: `${s.sprintActual.anio} ▾`,
		});
		anioBtn.addEventListener("click", (e) => {
			e.preventDefault();
			new AnioPickerModal(this.app, s.sprintActual.anio, (y) => {
				s.sprintActual.anio = y;
				anioBtn.setText(`${y} ▾`);
				void this.plugin.saveSettings();
			}).open();
		});

		const opciones = [];
		for (let n = 1; n <= s.numSprints; n++) opciones.push({ valor: String(n), texto: `Sprint ${n}` });
		const sprintWrap = fila.createDiv({ cls: "gf-acciones-sprint-sel" });
		crearSelect({
			parent: sprintWrap,
			opciones,
			valor: String(s.sprintActual.sprint),
			onChange: (v) => {
				s.sprintActual.sprint = Number(v);
				void this.plugin.saveSettings();
			},
		});
	}

	private renderTabs(cont: HTMLElement): void {
		const barra = cont.createDiv({ cls: "gf-tabs" });
		for (const tab of TABS) {
			const btn = barra.createEl("button", {
				cls: "gf-tab" + (this.tabActiva === tab.id ? " gf-tab-activa" : ""),
			});
			const icono = btn.createSpan({ cls: "gf-tab-icono" });
			crearIconoTab(icono, tab.id);
			// Favoritos es solo el icono (estrella); el resto lleva texto.
			if (tab.id !== "favoritos") btn.createSpan({ cls: "gf-tab-texto", text: tab.titulo });
			btn.setAttr("aria-label", tab.titulo);
			btn.addEventListener("click", () => {
				this.tabActiva = tab.id;
				this.render();
			});
		}
	}

	/** Contenido de la pestaña Favoritos: botón ＋ para elegir + lista elegida. */
	private renderFavoritos(cont: HTMLElement): void {
		const favs = this.plugin.settings.favoritos
			.map((id) => resolverAccion(this.plugin, id))
			.filter((a): a is Accion => a !== null);

		const barra = cont.createDiv({ cls: "gf-favoritos-barra" });
		if (favs.length === 0) {
			barra.createSpan({ cls: "gf-campo-aviso", text: "Usa el lápiz para agregar elementos" });
		}
		const add = barra.createEl("button", { cls: "gf-favoritos-add" });
		setIcon(add, "pencil");
		add.setAttr("title", "Editar favoritos");
		add.addEventListener("click", () =>
			new FavoritosPickerModal(this.plugin, () => this.render()).open()
		);

		// Se agrupan por su sección de origen, en el orden del panel.
		const renderidos = new Set<string>();
		for (const sec of SECCIONES_PANEL) {
			const ids = new Set(sec.acciones);
			const delSeccion = favs.filter((a) => ids.has(a.id));
			if (delSeccion.length === 0) continue;
			cont.createDiv({ cls: "gf-seccion-label", text: sec.titulo });
			for (const accion of delSeccion) {
				this.renderBoton(cont, accion);
				renderidos.add(accion.id);
			}
		}
		// Cualquier favorito que no pertenezca a una sección conocida, sin etiqueta.
		for (const accion of favs) {
			if (!renderidos.has(accion.id)) this.renderBoton(cont, accion);
		}
	}

	private renderSeccion(cont: HTMLElement, titulo: string | null, acciones: Accion[]): void {
		if (titulo) cont.createDiv({ cls: "gf-seccion-label", text: titulo });
		if (acciones.length === 0) {
			cont.createDiv({ cls: "gf-campo-aviso", text: "Sin elementos activos." });
			return;
		}
		for (const accion of acciones) this.renderBoton(cont, accion);
	}

	private renderBoton(cont: HTMLElement, accion: Accion): void {
		const btn = cont.createEl("button", { cls: "gf-accion" });
		const icono = btn.createSpan({ cls: "gf-accion-icono" });
		setIcon(icono, accion.icono);
		btn.createSpan({ text: accion.texto });
		btn.addEventListener("click", () => accion.accion(this.plugin));
	}
}

/** Modal para elegir qué elementos del panel son favoritos. */
class FavoritosPickerModal extends Modal {
	private plugin: GestorFuncionesPlugin;
	private onCerrar: () => void;

	constructor(plugin: GestorFuncionesPlugin, onCerrar: () => void) {
		super(plugin.app);
		this.plugin = plugin;
		this.onCerrar = onCerrar;
	}

	onOpen(): void {
		this.titleEl.setText("Favoritos");
		this.contentEl.createEl("p", {
			cls: "gf-campo-aviso",
			text: "Marca los elementos que quieres ver en la sección Favoritos.",
		});
		const lista = this.contentEl.createDiv({ cls: "gf-panel-items" });
		for (const accion of listarTodasLasAcciones(this.plugin)) {
			const fila = lista.createEl("label", { cls: "gf-chk" });
			const chk = fila.createEl("input", { type: "checkbox" });
			chk.checked = this.plugin.settings.favoritos.includes(accion.id);
			const icono = fila.createSpan({ cls: "gf-accion-icono" });
			setIcon(icono, accion.icono);
			fila.appendText(` ${accion.texto}`);
			chk.addEventListener("change", () => void (async () => {
				const favs = this.plugin.settings.favoritos;
				if (chk.checked) {
					if (!favs.includes(accion.id)) favs.push(accion.id);
				} else {
					this.plugin.settings.favoritos = favs.filter((x) => x !== accion.id);
				}
				await this.plugin.saveSettings();
			})());
		}
		const row = this.contentEl.createDiv({ cls: "gf-botones" });
		const cerrar = row.createEl("button", { text: "Cerrar", cls: "mod-cta" });
		cerrar.addEventListener("click", () => this.close());
	}

	onClose(): void {
		this.contentEl.empty();
		this.onCerrar();
	}
}
