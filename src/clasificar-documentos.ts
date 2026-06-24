import { ItemView, Notice, TAbstractFile, WorkspaceLeaf, normalizePath } from "obsidian";
import type GestorFuncionesPlugin from "./main";
import {
	DocSinClasificar,
	FuncRef,
	carpetasGestionListas,
	clasificarComoDocumento,
	listFuncionalidadesVisibles,
	listSinClasificar,
} from "./files";
import { ETIQUETA_COLORES, renderChipEtiqueta } from "./colores";
import { crearMultiSelect } from "./ui";
import { menuNotaEnEvento } from "./menu-contextual";

export const VIEW_TYPE_CLASIFICAR_DOCS = "gestor-funciones-clasificar-docs";

/**
 * Vista de clasificación de documentos. Carril "Documentos sin clasificar" con
 * los .md sueltos dentro de las épicas, y un carril por tipo de documento. La
 * clasificación es PROVISIONAL: se arrastran los documentos entre carriles
 * libremente y solo se aplica (mueve los archivos) al pulsar "Guardar". Los
 * carriles de tipo no muestran documentos ya clasificados; solo los que se están
 * clasificando ahora.
 */
export class ClasificarDocumentosView extends ItemView {
	private plugin: GestorFuncionesPlugin;
	private renderTimer: number | null = null;
	private epicas: FuncRef[] = [];
	private sinClasificar: DocSinClasificar[] = [];
	/** Clasificación provisional sin guardar: ruta del .md → nombre del tipo. */
	private asignacion = new Map<string, string>();
	/** Filtro por épica (nombres). Por defecto, épicas con documentos sin clasificar. */
	private epicaSeleccion = new Set<string>();
	private epicaInit = false;
	/** Ruta del documento en arrastre. */
	private arrastre: string | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: GestorFuncionesPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_CLASIFICAR_DOCS;
	}

	getDisplayText(): string {
		return "Clasificar documentos — Gestión de épicas";
	}

	getIcon(): string {
		return "folder-search";
	}

	async onOpen(): Promise<void> {
		const refrescar = (file: TAbstractFile) => {
			const admin = normalizePath(this.plugin.settings.carpetaAdmin.trim() || "/");
			if (file.path === admin || file.path.startsWith(admin + "/")) this.renderSoon();
		};
		this.registerEvent(this.app.vault.on("create", refrescar));
		this.registerEvent(this.app.vault.on("delete", refrescar));
		this.registerEvent(this.app.vault.on("rename", refrescar));
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

	private recolectar(): void {
		const admin = this.plugin.settings.carpetaAdmin.trim();
		this.epicas = admin
			? listFuncionalidadesVisibles(this.app, admin, this.plugin.settings.epicasOcultas)
			: [];
		this.sinClasificar = [];
		const incTipos = this.plugin.settings.incidencias;
		const docTipos = this.plugin.settings.documentos;
		const conSueltos = new Set<string>();
		for (const ep of this.epicas) {
			const sueltos = listSinClasificar(this.app, ep, incTipos, docTipos);
			if (sueltos.length > 0) conSueltos.add(ep.nombre);
			this.sinClasificar.push(...sueltos);
		}
		// Conserva la clasificación provisional solo de documentos que aún existen
		// como "sin clasificar" (los guardados o borrados se descartan).
		const paths = new Set(this.sinClasificar.map((d) => d.file.path));
		for (const k of [...this.asignacion.keys()]) if (!paths.has(k)) this.asignacion.delete(k);
		// Quita del filtro épicas que ya no existen.
		const vivos = new Set(this.epicas.map((e) => e.nombre));
		for (const n of [...this.epicaSeleccion]) if (!vivos.has(n)) this.epicaSeleccion.delete(n);
		if (!this.epicaInit) {
			this.epicaInit = true;
			this.epicaSeleccion = new Set(conSueltos);
		}
	}

	/** Color estable de la paleta para una épica (derivado de su nombre). */
	private colorEpica(nombre: string): string {
		let h = 0;
		for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) >>> 0;
		return ETIQUETA_COLORES[h % ETIQUETA_COLORES.length].color;
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
		barra.createEl("span", { text: "Épica", cls: "gf-roadmap-lbl" });
		crearMultiSelect({
			parent: barra,
			etiqueta: "Épicas",
			opciones: this.epicas
				.map((e) => ({ valor: e.nombre, texto: e.nombre }))
				.sort((a, b) => a.texto.localeCompare(b.texto, "es")),
			seleccion: this.epicaSeleccion,
			onChange: () => this.render(),
		});

		// Botón de guardado visible: aplica la clasificación provisional.
		const pendientes = this.asignacion.size;
		const guardar = barra.createEl("button", {
			cls: "mod-cta",
			text: pendientes > 0 ? `Guardar (${pendientes})` : "Guardar",
		});
		guardar.disabled = pendientes === 0;
		guardar.addEventListener("click", () => void this.guardar());

		const recargar = barra.createEl("button", { text: "Recargar", cls: "gf-roadmap-recargar" });
		recargar.addEventListener("click", () => this.recargar());

		const cuerpo = cont.createDiv();
		const pasaEpica = (nombre: string) =>
			this.epicaSeleccion.size === 0 || this.epicaSeleccion.has(nombre);
		const visibles = this.sinClasificar.filter((d) => pasaEpica(d.epica.nombre));

		// Carril "Documentos sin clasificar": los que no tienen asignación provisional.
		this.renderCarril(
			cuerpo,
			"Documentos sin clasificar",
			null,
			null,
			visibles.filter((d) => !this.asignacion.has(d.file.path))
		);

		// Un carril por tipo de documento, con los que se están clasificando ahora.
		for (const tipo of this.plugin.settings.documentos.filter((t) => t.visible !== false)) {
			this.renderCarril(
				cuerpo,
				tipo.nombre,
				tipo.color,
				tipo.nombre,
				visibles.filter((d) => this.asignacion.get(d.file.path) === tipo.nombre)
			);
		}
	}

	private renderCarril(
		cuerpo: HTMLElement,
		titulo: string,
		color: string | null,
		tipoDestino: string | null,
		docs: DocSinClasificar[]
	): void {
		const tarjeta = cuerpo.createDiv({ cls: "gf-colab-card" });
		// Zona de soltado: reasigna provisionalmente el documento a este carril.
		tarjeta.addEventListener("dragover", (e) => {
			if (!this.arrastre) return;
			e.preventDefault();
			tarjeta.addClass("gf-drop-card");
		});
		tarjeta.addEventListener("dragleave", () => tarjeta.removeClass("gf-drop-card"));
		tarjeta.addEventListener("drop", (e) => {
			if (!this.arrastre) return;
			e.preventDefault();
			tarjeta.removeClass("gf-drop-card");
			this.soltar(this.arrastre, tipoDestino);
		});

		const head = tarjeta.createDiv({ cls: "gf-colab-head" });
		if (color) {
			const punto = head.createDiv({ cls: "gf-colab-punto" });
			punto.setCssStyles({ backgroundColor: color });
		}
		head.createEl("span", { text: titulo, cls: "gf-colab-nombre" });
		head.createEl("span", { cls: "gf-colab-conteo", text: String(docs.length) });

		if (docs.length === 0) {
			tarjeta.createEl("em", {
				cls: "gf-kanban-vacio",
				text: tipoDestino === null ? "No hay documentos sin clasificar." : "Arrastra aquí.",
			});
			return;
		}
		const ul = tarjeta.createEl("ul", { cls: "gf-colab-lista" });
		for (const d of docs) {
			const li = ul.createEl("li", { cls: "gf-arrastrable" });
			li.addEventListener("contextmenu", (e) => {
				e.preventDefault();
				menuNotaEnEvento(this.plugin, d.file, e);
			});
			li.draggable = true;
			li.addEventListener("dragstart", () => {
				this.arrastre = d.file.path;
			});
			li.addEventListener("dragend", () => {
				this.arrastre = null;
			});
			renderChipEtiqueta(li, d.epica.nombre, this.colorEpica(d.epica.nombre));
			const a = li.createEl("a", { cls: "internal-link", text: d.nombre });
			a.addEventListener("click", (e) => {
				e.preventDefault();
				void this.plugin.mostrarNota(d.file);
			});
			li.createSpan({ cls: "gf-campo-aviso", text: ` ${d.rutaRelativa}` });
			li.createSpan({
				cls: "gf-campo-aviso",
				text: ` · ${new Date(d.ctime).toLocaleString("es")}`,
			});
		}
	}

	/** Cambia la asignación provisional (tipoDestino null = sin clasificar). */
	private soltar(path: string, tipoDestino: string | null): void {
		if (!this.sinClasificar.some((d) => d.file.path === path)) return;
		if (tipoDestino === null) this.asignacion.delete(path);
		else this.asignacion.set(path, tipoDestino);
		this.render();
	}

	/** Aplica la clasificación provisional: mueve cada documento a su tipo. */
	private async guardar(): Promise<void> {
		const entradas = [...this.asignacion.entries()];
		if (entradas.length === 0) return;
		let aplicados = 0;
		for (const [path, tipoNombre] of entradas) {
			const d = this.sinClasificar.find((x) => x.file.path === path);
			if (!d) continue;
			try {
				await clasificarComoDocumento(this.app, d.file, d.epica, tipoNombre);
				aplicados++;
			} catch (e) {
				console.error("gestion-de-epicas: error al clasificar documento", e);
			}
		}
		this.asignacion.clear();
		new Notice(`Gestión de épicas: ${aplicados} documento(s) clasificado(s).`);
		this.recargar();
	}
}
