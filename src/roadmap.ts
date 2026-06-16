import { ItemView, WorkspaceLeaf } from "obsidian";
import type GestorFuncionesPlugin from "./main";
import {
	EtiquetaSprint,
	FuncRef,
	getAsignados,
	leerSprints,
	listFuncionalidades,
	listFuncionalidadesDe,
} from "./files";
import { renderChipEtiqueta } from "./colores";
import { AsignarSprintModal, crearSelectorEtiquetas } from "./modals";
import { AnioPickerModal, crearSelect, habilitarScrollHorizontal } from "./ui";

export const VIEW_TYPE_ROADMAP = "gestor-funciones-roadmap";

interface CeldaSprint {
	etiquetas: EtiquetaSprint[];
}

interface FilaRoadmap {
	ref: FuncRef;
	tipo: "epica" | "funcionalidad";
	/** Para funcionalidades: slug de su épica (para precargar el modal). */
	epicaSlug: string;
	etiqueta: string;
	/** número de sprint → etiquetas y número de elementos en el año visible. */
	porSprint: Map<number, CeldaSprint>;
}

export class RoadmapView extends ItemView {
	private plugin: GestorFuncionesPlugin;
	private anio = new Date().getFullYear();
	private desde: number;
	private hasta: number;
	/** Filtro por colaborador (nombres seleccionados); vacío = todos. */
	private filtroColab = new Set<string>();
	/** Mostrar también las épicas sin sprints asignados (del año seleccionado). */
	private verTodas = false;

	constructor(leaf: WorkspaceLeaf, plugin: GestorFuncionesPlugin) {
		super(leaf);
		this.plugin = plugin;
		// Sprint inicio sugerido desde el panel (el usuario puede cambiarlo).
		this.desde = Math.min(Math.max(plugin.settings.sprintActual.sprint, 1), plugin.settings.numSprints);
		this.hasta = plugin.settings.numSprints;
	}

	getViewType(): string {
		return VIEW_TYPE_ROADMAP;
	}

	getDisplayText(): string {
		return "Roadmap — Gestión de épicas";
	}

	getIcon(): string {
		return "map";
	}

	async onOpen(): Promise<void> {
		await this.render();
	}

	private async datos(): Promise<FilaRoadmap[]> {
		const filas: FilaRoadmap[] = [];
		const admin = this.plugin.settings.carpetaAdmin.trim();
		if (!admin) return filas;

		const agregar = async (
			ref: FuncRef,
			tipo: FilaRoadmap["tipo"],
			epicaSlug: string,
			etiqueta: string
		) => {
			const todos = await leerSprints(this.app, ref);
			const sprints = todos.filter((s) => s.anio === this.anio);
			if (sprints.length === 0) {
				// "Ver todas": solo épicas, y solo si no tienen sprints en NINGÚN año
				// (sin agendar). Las que tienen sprints en otros años no son de este año.
				if (!this.verTodas || tipo !== "epica" || todos.length > 0) return;
			}
			const porSprint = new Map<number, CeldaSprint>();
			for (const s of sprints) {
				porSprint.set(s.sprint, { etiquetas: s.etiquetas });
			}
			filas.push({ ref, tipo, epicaSlug, etiqueta, porSprint });
		};

		for (const epica of listFuncionalidades(this.app, admin)) {
			await agregar(epica, "epica", epica.slug, epica.nombre);
			for (const fn of listFuncionalidadesDe(this.app, epica.folder)) {
				await agregar(fn, "funcionalidad", epica.slug, `${epica.nombre} › ${fn.nombre}`);
			}
		}
		return filas;
	}

	async render(): Promise<void> {
		const cont = this.contentEl;
		cont.empty();
		cont.addClass("gf-roadmap");

		const filas = await this.datos();

		const maxSprints = this.plugin.settings.numSprints;
		if (this.hasta > maxSprints) this.hasta = maxSprints;
		if (this.desde > maxSprints) this.desde = maxSprints;

		const barra = cont.createDiv({ cls: "gf-roadmap-controles" });

		// Año: botón que abre un selector de años tipo calendario.
		barra.createEl("span", { text: "Año", cls: "gf-roadmap-lbl" });
		const anioBtn = barra.createEl("button", { cls: "gf-multiselect-btn", text: `${this.anio} ▾` });
		anioBtn.addEventListener("click", () => {
			new AnioPickerModal(this.app, this.anio, (y) => {
				this.anio = y;
				void this.render();
			}).open();
		});

		// Filtro de sprints por rango: dos desplegables (inicio / fin) que abren
		// siempre hacia abajo.
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
				pintarTabla();
			},
		});
		rango.createEl("span", { text: "fin", cls: "gf-roadmap-lbl" });
		const finCtl = crearSelect({
			parent: rango,
			opciones: opcionesSprint(this.desde),
			valor: String(this.hasta),
			onChange: (v) => {
				this.hasta = Number(v);
				pintarTabla();
			},
		});

		// Filtro por colaborador (asignados a la épica/historia).
		barra.createEl("span", { text: "Colaborador", cls: "gf-roadmap-lbl" });
		crearSelectorEtiquetas({
			parent: barra,
			etiquetas: this.plugin.settings.colaboradores.filter((c) => c.visible !== false),
			seleccion: this.filtroColab,
			textoBtn: "Filtrar por colaborador",
			textoVacio: "No hay colaboradores registrados.",
			onChange: () => pintarTabla(),
		});
		// Ver todas las épicas (incluye las que no tienen sprints en el año).
		const verLabel = barra.createEl("label", { cls: "gf-chk" });
		const verChk = verLabel.createEl("input", { type: "checkbox" });
		verChk.checked = this.verTodas;
		verLabel.appendText(" Ver todas las épicas");
		verChk.addEventListener("change", () => {
			this.verTodas = verChk.checked;
			void this.render();
		});

		const borrar = barra.createEl("button", { text: "Borrar filtros", cls: "gf-roadmap-recargar" });
		borrar.addEventListener("click", () => {
			this.filtroColab.clear();
			void this.render();
		});

		const recargar = barra.createEl("button", { text: "Recargar", cls: "gf-roadmap-recargar" });
		recargar.addEventListener("click", () => void this.render());

		const tablaCont = cont.createDiv();

		const pintarTabla = () => {
			tablaCont.empty();
			const visibles = filas.filter(
				(f) =>
					this.filtroColab.size === 0 ||
					getAsignados(this.app, f.ref.file).some((c) => this.filtroColab.has(c))
			);
			if (visibles.length === 0) {
				tablaCont.createEl("p", {
					cls: "gf-kanban-vacio",
					text: "No hay épicas con sprints asignados para los filtros seleccionados.",
				});
				return;
			}
			const wrap = tablaCont.createDiv({ cls: "gf-roadmap-tabla-wrap" });
			habilitarScrollHorizontal(wrap);
			const tabla = wrap.createEl("table", { cls: "gf-roadmap-tabla" });
			const trh = tabla.createEl("thead").createEl("tr");
			trh.createEl("th", { text: "Épica", cls: "gf-roadmap-th-epica" });
			for (let n = this.desde; n <= this.hasta; n++) {
				trh.createEl("th", { text: String(n) });
			}
			const tbody = tabla.createEl("tbody");
			for (const fila of visibles) this.renderFila(tbody, fila);
		};

		pintarTabla();
	}

	private renderFila(tbody: HTMLElement, fila: FilaRoadmap): void {
		const tr = tbody.createEl("tr");
		const tdNombre = tr.createEl("td", { cls: "gf-roadmap-epica" });
		const a = tdNombre.createEl("a", { cls: "internal-link", text: fila.etiqueta });
		if (fila.tipo === "funcionalidad") a.addClass("gf-roadmap-fn");
		a.addEventListener("click", (e) => {
			e.preventDefault();
			void this.app.workspace.getLeaf(false).openFile(fila.ref.file);
		});

		// Colaboradores asignados a la épica/historia (su nota principal).
		const colabs = getAsignados(this.app, fila.ref.file).filter((n) =>
			this.plugin.settings.colaboradores.some((c) => c.nombre === n && c.visible !== false)
		);
		if (colabs.length > 0) {
			const chips = tdNombre.createDiv({ cls: "gf-roadmap-colabs" });
			for (const c of colabs) {
				const color =
					this.plugin.settings.colaboradores.find((x) => x.nombre === c)?.color ?? "#B9BEC6";
				renderChipEtiqueta(chips, c, color);
			}
		}

		for (let n = this.desde; n <= this.hasta; n++) {
			const td = tr.createEl("td", { cls: "gf-roadmap-celda" });
			const celda = fila.porSprint.get(n);
			if (!celda) continue;
			const { etiquetas } = celda;
			td.addClass("gf-roadmap-on");
			td.setAttr(
				"title",
				etiquetas.length > 0 ? etiquetas.map((e) => e.nombre).join(", ") : `Sprint ${n}`
			);
			// El bloque toma el color configurado de la primera etiqueta.
			const colorPrimera = etiquetas[0] ? this.colorDe(etiquetas[0].nombre) : undefined;
			if (colorPrimera) td.setCssStyles({ backgroundColor: conAlpha(colorPrimera, 0.25) });
			const bloque = td.createDiv({ cls: "gf-roadmap-bloque" });
			for (const et of etiquetas.slice(0, 2)) {
				renderChipEtiqueta(bloque, et.nombre, this.colorDe(et.nombre) ?? "#B9BEC6", et.num);
			}
			if (etiquetas.length > 2) {
				bloque.createEl("span", { cls: "gf-etq-chip gf-etq-chip-mas", text: "…" });
			}
			td.addEventListener("click", () => {
				new AsignarSprintModal(this.plugin, {
					epicaSlug: fila.epicaSlug,
					anio: this.anio,
					sprint: n,
				}).open();
			});
		}
	}

	private colorDe(nombreEtiqueta: string): string | undefined {
		return this.plugin.settings.etiquetas.find((e) => e.nombre === nombreEtiqueta)?.color;
	}
}

/** Convierte #rrggbb a rgba con la opacidad dada. */
function conAlpha(hex: string, alpha: number): string {
	const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
	if (!m) return hex;
	return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
}
