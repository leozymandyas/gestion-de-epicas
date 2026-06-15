import { App, Modal } from "obsidian";
import type GestorFuncionesPlugin from "./main";
import { Etiqueta } from "./settings";
import type { FuncRef } from "./files";
import { colorAleatorio, renderSelectorColor } from "./colores";

/** Una sección/pestaña del gestor; provee su lista de etiquetas. */
export interface SeccionEtiquetas {
	id: string;
	titulo: string;
	getLista: () => Etiqueta[];
}

/** Modo "por épica": selector arriba; la lista y el guardado dependen de la épica. */
export interface PorEpica {
	epicas: FuncRef[];
	cargar: (epica: FuncRef) => Etiqueta[];
	guardar: (epica: FuncRef, lista: Etiqueta[]) => Promise<void>;
}

export interface OpcionesGestorEtiquetas {
	titulo: string;
	secciones?: SeccionEtiquetas[];
	/** Nombre del elemento nuevo al pulsar ＋. */
	nuevoNombre?: string;
	onCerrar?: () => void;
	/** Muestra un checkbox de visibilidad al final de cada fila (carriles). */
	conVisible?: boolean;
	/** Tooltip del checkbox de visibilidad. */
	tituloVisible?: string;
	/** Devuelve si un elemento puede eliminarse (false = protegido). */
	puedeEliminar?: (et: Etiqueta) => boolean;
	/** Fabrica el elemento nuevo (para listas con campos extra como los carriles). */
	nuevoItem?: (nombre: string, color: string) => Etiqueta;
	/** Guardado a medida (por defecto guarda la configuración del plugin). */
	guardar?: () => Promise<void>;
	/** Si se define, el modal gestiona etiquetas por épica con un selector arriba. */
	porEpica?: PorEpica;
}

/** Vista mínima de un elemento con bandera de visibilidad (carriles). */
interface ConVisible {
	visible?: boolean;
}

/**
 * Gestor genérico de listas de etiquetas con color: pestañas (si hay más de
 * una sección), barra ＋/−, filas seleccionables y renombrado inline, dentro de
 * una tabla de altura fija con scroll. Lo usan las etiquetas y los colaboradores.
 */
export class GestorEtiquetasModal extends Modal {
	private plugin: GestorFuncionesPlugin;
	private opts: OpcionesGestorEtiquetas;
	private tab: string;
	private seleccionado: number | null = null;
	/** Filas renderizadas, para actualizar la selección sin reconstruir todo. */
	private filas: HTMLElement[] = [];
	private delBtn: HTMLButtonElement | null = null;
	/** Modo por épica: épica elegida y su lista de etiquetas en memoria. */
	private epicaActual: FuncRef | null = null;
	private listaEpica: Etiqueta[] = [];

	/** Longitud permitida para el nombre de una etiqueta. */
	static readonly LARGO_MIN = 1;
	static readonly LARGO_MAX = 50;

	constructor(plugin: GestorFuncionesPlugin, opts: OpcionesGestorEtiquetas) {
		super(plugin.app);
		this.plugin = plugin;
		this.opts = opts;
		this.tab = opts.secciones?.[0]?.id ?? "";
	}

	/** Persiste los cambios según el modo (configuración, callback o frontmatter). */
	private async guardar(): Promise<void> {
		if (this.opts.porEpica) {
			if (this.epicaActual) await this.opts.porEpica.guardar(this.epicaActual, this.listaEpica);
			return;
		}
		await (this.opts.guardar ? this.opts.guardar() : this.plugin.saveSettings());
	}

	onOpen(): void {
		this.titleEl.setText(this.opts.titulo);
		this.modalEl.addClass("gf-modal-etiquetas");
		this.render();
	}

	private listaActiva(): Etiqueta[] {
		if (this.opts.porEpica) return this.listaEpica;
		const secs = this.opts.secciones ?? [];
		const sec = secs.find((s) => s.id === this.tab) ?? secs[0];
		return sec ? sec.getLista() : [];
	}

	private render(): void {
		this.contentEl.empty();

		// Modo por épica: selector de épica arriba; sin épica no hay lista.
		if (this.opts.porEpica) {
			this.renderSelectorEpica();
			if (!this.epicaActual) {
				this.contentEl.createEl("em", { cls: "gf-campo-aviso", text: "Selecciona una épica." });
				return;
			}
		} else if ((this.opts.secciones?.length ?? 0) > 1) {
			// Pestañas (solo si hay más de una sección).
			const tabs = this.contentEl.createDiv({ cls: "gf-etq-tabs" });
			for (const sec of this.opts.secciones ?? []) {
				const t = tabs.createEl("button", {
					cls: "gf-etq-tab" + (this.tab === sec.id ? " gf-etq-tab-on" : ""),
					text: sec.titulo,
				});
				t.addEventListener("click", () => {
					this.tab = sec.id;
					this.seleccionado = null;
					this.render();
				});
			}
		}

		// Barra de herramientas: agregar / eliminar.
		const barra = this.contentEl.createDiv({ cls: "gf-etq-barra" });
		const add = barra.createEl("button", { cls: "gf-etq-btn", text: "＋" });
		add.setAttr("title", "Agregar");
		add.addEventListener("click", () => void this.agregar());
		const del = barra.createEl("button", { cls: "gf-etq-btn", text: "－" });
		del.setAttr("title", "Eliminar el seleccionado");
		del.disabled = this.seleccionado === null;
		del.addEventListener("click", () => void this.eliminarSeleccion());
		this.delBtn = del;

		// Tabla con scroll propio.
		const scroll = this.contentEl.createDiv({ cls: "gf-etq-scroll" });
		const items = this.listaActiva();
		this.filas = [];
		if (items.length === 0) {
			scroll.createEl("em", { cls: "gf-campo-aviso", text: "Sin elementos." });
			return;
		}
		const tbody = scroll.createEl("table", { cls: "gf-etq-tabla" }).createEl("tbody");
		items.forEach((et, i) => this.renderFila(tbody, et, i));
	}

	/** Selector de épica (modo por épica): al cambiar, carga sus etiquetas. */
	private renderSelectorEpica(): void {
		const por = this.opts.porEpica;
		if (!por) return;
		const wrap = this.contentEl.createDiv({ cls: "gf-campo gf-etq-epica" });
		wrap.createEl("label", { text: "Épica", cls: "gf-campo-label" });
		const sel = wrap.createEl("select", { cls: "dropdown gf-campo-select" });
		sel.createEl("option", { text: "Seleccionar épica", value: "" });
		for (const ep of por.epicas) sel.createEl("option", { text: ep.nombre, value: ep.slug });
		sel.value = this.epicaActual?.slug ?? "";
		sel.addEventListener("change", () => {
			const ep = por.epicas.find((e) => e.slug === sel.value) ?? null;
			this.epicaActual = ep;
			this.listaEpica = ep ? por.cargar(ep) : [];
			this.seleccionado = null;
			this.render();
		});
	}

	/** Cambia la fila seleccionada sin reconstruir la tabla, para no cerrar el
	 * desplegable de color ni el campo de renombrado abiertos. */
	private seleccionar(i: number | null): void {
		this.seleccionado = i;
		this.filas.forEach((tr, idx) => tr.toggleClass("gf-etq-sel", idx === i));
		if (this.delBtn) this.delBtn.disabled = i === null || !this.puedeEliminar(i);
	}

	/** ¿El elemento del índice puede eliminarse? (protege los carriles por defecto). */
	private puedeEliminar(i: number): boolean {
		const item = this.listaActiva()[i];
		return !item || !this.opts.puedeEliminar ? true : this.opts.puedeEliminar(item);
	}

	private renderFila(tbody: HTMLElement, et: Etiqueta, i: number): void {
		const tr = tbody.createEl("tr", {
			cls: "gf-etq-fila" + (this.seleccionado === i ? " gf-etq-sel" : ""),
		});
		this.filas.push(tr);
		tr.addEventListener("click", () => {
			this.seleccionar(this.seleccionado === i ? null : i);
		});

		const tdColor = tr.createEl("td", { cls: "gf-etq-color" });
		// Clic en el color: selecciona la fila (sin alternar) y abre el desplegable.
		tdColor.addEventListener("click", (e) => {
			e.stopPropagation();
			this.seleccionar(i);
		});
		renderSelectorColor(
			tdColor,
			et.color,
			(c) => void (async () => {
				et.color = c;
				await this.guardar();
			})(),
			() => this.seleccionar(i)
		);

		const tdNombre = tr.createEl("td", { cls: "gf-etq-nombre-td" });
		const nombre = tdNombre.createEl("span", { cls: "gf-etq-nombre", text: et.nombre });
		nombre.setAttr("title", "Doble clic para renombrar");
		// Doble clic en cualquier parte de la etiqueta (su celda de nombre) edita.
		tdNombre.addEventListener("dblclick", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.seleccionar(i);
			this.editarNombre(tdNombre, nombre, i);
		});

		// Checkbox de visibilidad al final de la fila (carriles).
		if (this.opts.conVisible) {
			const tdVis = tr.createEl("td", { cls: "gf-etq-visible-td" });
			tdVis.addEventListener("click", (e) => e.stopPropagation());
			const chk = tdVis.createEl("input", { type: "checkbox" });
			chk.checked = (et as ConVisible).visible !== false;
			chk.setAttr(
				"title",
				this.opts.tituloVisible ??
					(this.opts.porEpica ? "Disponible para asignar a historias" : "Visible")
			);
			chk.addEventListener("change", () => void (async () => {
				(et as ConVisible).visible = chk.checked;
				await this.guardar();
			})());
		}
	}

	private async agregar(): Promise<void> {
		const items = this.listaActiva();
		const base = this.opts.nuevoNombre ?? "Sin título";
		let nombre = base;
		let n = 2;
		while (items.some((e) => e.nombre === nombre)) nombre = `${base} ${n++}`;
		const color = colorAleatorio();
		items.push(this.opts.nuevoItem ? this.opts.nuevoItem(nombre, color) : { nombre, color });
		await this.guardar();
		this.seleccionado = items.length - 1;
		this.render();
	}

	private eliminarSeleccion(): void {
		if (this.seleccionado === null) return;
		const items = this.listaActiva();
		const idx = this.seleccionado;
		const item = items[idx];
		if (!item || !this.puedeEliminar(idx)) return;
		new ConfirmarModal(this.app, `¿Eliminar "${item.nombre}"?`, async () => {
			items.splice(idx, 1);
			this.seleccionado = null;
			await this.guardar();
			this.render();
		}).open();
	}

	private editarNombre(tdNombre: HTMLElement, nombre: HTMLElement, indice: number): void {
		const items = this.listaActiva();
		const original = items[indice].nombre;
		const input = createEl("input", { type: "text", cls: "gf-etq-input", value: original });
		input.maxLength = GestorEtiquetasModal.LARGO_MAX;
		nombre.replaceWith(input);
		const error = tdNombre.createDiv({ cls: "gf-campo-error" });
		error.hide();
		input.focus();
		input.select();

		let terminado = false;
		const confirmar = async () => {
			if (terminado) return;
			const valor = input.value.trim();
			if (!valor || valor === original) {
				terminado = true;
				this.render();
				return;
			}
			if (valor.length > GestorEtiquetasModal.LARGO_MAX) {
				error.setText(`Máximo ${GestorEtiquetasModal.LARGO_MAX} caracteres.`);
				error.show();
				return;
			}
			if (items.some((e, j) => j !== indice && e.nombre.toLowerCase() === valor.toLowerCase())) {
				error.setText("Ya existe un elemento con ese nombre.");
				error.show();
				return;
			}
			terminado = true;
			items[indice].nombre = valor;
			await this.guardar();
			this.render();
		};

		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				void confirmar();
			} else if (e.key === "Escape") {
				terminado = true;
				this.render();
			}
		});
		input.addEventListener("blur", () => void confirmar());
		input.addEventListener("click", (e) => e.stopPropagation());
	}

	onClose(): void {
		this.contentEl.empty();
		this.opts.onCerrar?.();
	}
}

/** Modal de confirmación de borrado. */
class ConfirmarModal extends Modal {
	constructor(
		app: App,
		private mensaje: string,
		private onConfirmar: () => void | Promise<void>
	) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText("Confirmar");
		this.contentEl.createEl("p", { text: this.mensaje });
		const row = this.contentEl.createDiv({ cls: "gf-botones" });
		const cancelar = row.createEl("button", { text: "Cancelar" });
		cancelar.addEventListener("click", () => this.close());
		const ok = row.createEl("button", { text: "Eliminar", cls: "mod-warning" });
		ok.addEventListener("click", () => {
			this.close();
			void this.onConfirmar();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
