import { Editor, Modal, Notice, TFile, setIcon } from "obsidian";
import type GestorFuncionesPlugin from "./main";
import { hoy, slugify } from "./utils";
import * as files from "./files";
import { Etiqueta } from "./settings";
import { renderChipEtiqueta } from "./colores";
import { AnioPickerModal, crearSelect } from "./ui";

interface Campo {
	wrap: HTMLElement;
	error: HTMLElement;
}

interface CampoTexto extends Campo {
	input: HTMLInputElement;
}

interface CampoSelect extends Campo {
	select: HTMLSelectElement;
}

interface CampoEpica extends CampoSelect {
	getFunc: () => files.FuncRef | undefined;
	/** Selecciona una épica por slug, mostrando completadas si hace falta. */
	seleccionar: (slug: string) => void;
}

interface CampoFuncionalidad extends CampoSelect {
	/** Funcionalidad seleccionada, o null para trabajar a nivel de épica. */
	getFn: () => files.FuncRef | null;
	seleccionar: (slug: string) => void;
}

const MSG_OBLIGATORIO = "Este campo es obligatorio.";
const MSG_DUPLICADO =
	"Ya existe un elemento con ese nombre. Haz clic en «Crear» otra vez para crearlo con un sufijo numérico.";

abstract class GestorModal extends Modal {
	protected plugin: GestorFuncionesPlugin;
	protected crearBtn!: HTMLButtonElement;

	constructor(plugin: GestorFuncionesPlugin) {
		super(plugin.app);
		this.plugin = plugin;
	}

	/** Encabezado de sección dentro del modal, para agrupar campos. */
	protected seccion(texto: string): void {
		this.contentEl.createEl("div", { cls: "gf-modal-seccion", text: texto });
	}

	protected campoTexto(label: string, placeholder: string): CampoTexto {
		const wrap = this.contentEl.createDiv({ cls: "gf-campo" });
		wrap.createEl("label", { text: label, cls: "gf-campo-label" });
		const input = wrap.createEl("input", {
			type: "text",
			cls: "gf-campo-input",
			attr: { placeholder },
		});
		const error = wrap.createDiv({ cls: "gf-campo-error" });
		error.hide();
		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				if (!this.crearBtn.disabled) this.crearBtn.click();
			}
		});
		return { wrap, input, error };
	}

	protected campoSelect(label: string, placeholder: string): CampoSelect {
		const wrap = this.contentEl.createDiv({ cls: "gf-campo" });
		wrap.createEl("label", { text: label, cls: "gf-campo-label" });
		const select = wrap.createEl("select", { cls: "dropdown gf-campo-select" });
		this.setOpciones(select, placeholder, []);
		const error = wrap.createDiv({ cls: "gf-campo-error" });
		error.hide();
		return { wrap, select, error };
	}

	protected setOpciones(
		select: HTMLSelectElement,
		placeholder: string,
		opciones: { value: string; label: string; cls?: string }[]
	): void {
		select.empty();
		const ph = select.createEl("option", { text: placeholder, value: "" });
		ph.disabled = true;
		ph.selected = true;
		for (const o of opciones) {
			const op = select.createEl("option", { text: o.label, value: o.value });
			if (o.cls) op.addClass(o.cls);
		}
	}

	/** Selector de épica con todas las épicas disponibles. */
	protected campoEpica(funcs: files.FuncRef[]): CampoEpica {
		const campo = this.campoSelect("Épica", "Seleccionar épica");
		this.setOpciones(
			campo.select,
			"Seleccionar épica",
			funcs.map((f) => ({ value: f.slug, label: f.nombre }))
		);
		return {
			...campo,
			getFunc: () => funcs.find((f) => f.slug === campo.select.value),
			seleccionar: (slug: string) => {
				campo.select.value = slug;
				campo.select.dispatchEvent(new Event("change"));
			},
		};
	}

	/**
	 * Selector opcional de funcionalidad, dependiente del selector de épica.
	 * Sin selección, las acciones operan a nivel de épica.
	 */
	protected campoFuncionalidad(epica: CampoEpica): CampoFuncionalidad {
		const campo = this.campoSelect("Historia", "Nivel épica (sin historia)");
		let lista: files.FuncRef[] = [];

		const repoblar = () => {
			const f = epica.getFunc();
			lista = f ? files.listFuncionalidadesDe(this.app, f.folder) : [];
			campo.select.empty();
			const nivel = campo.select.createEl("option", {
				text: "Nivel épica (sin historia)",
				value: "",
			});
			nivel.selected = true;
			for (const fn of lista) {
				campo.select.createEl("option", { text: fn.nombre, value: fn.slug });
			}
			campo.select.disabled = lista.length === 0;
			campo.select.dispatchEvent(new Event("change"));
		};
		epica.select.addEventListener("change", repoblar);
		repoblar();

		return {
			...campo,
			getFn: () => lista.find((x) => x.slug === campo.select.value) ?? null,
			seleccionar: (slug: string) => {
				if (!lista.some((x) => x.slug === slug)) return;
				campo.select.value = slug;
				campo.select.dispatchEvent(new Event("change"));
			},
		};
	}

	/** Chips de colaboradores para asignar al crear una incidencia. Opcional. */
	protected campoColaboradores(): { getSeleccionados: () => string[] } {
		const wrap = this.contentEl.createDiv({ cls: "gf-campo" });
		wrap.createEl("label", { text: "Colaboradores (opcional)", cls: "gf-campo-label" });
		const chipsDiv = wrap.createDiv({ cls: "gf-sprint-chips gf-colab-chips" });
		const seleccion = new Set<string>();
		const colaboradores = this.plugin.settings.colaboradores.filter((c) => c.visible !== false);

		const render = () => {
			chipsDiv.empty();
			if (colaboradores.length === 0) {
				chipsDiv.createEl("span", {
					cls: "gf-campo-aviso",
					text: "No hay colaboradores registrados.",
				});
				return;
			}
			for (const colab of colaboradores) {
				const activo = seleccion.has(colab.nombre);
				const chip = chipsDiv.createEl("button", {
					text: colab.nombre,
					cls: "gf-chip" + (activo ? " gf-chip-on" : ""),
				});
				if (activo) {
					chip.setCssStyles({ backgroundColor: colab.color });
					chip.setCssStyles({ borderColor: colab.color });
				} else {
					chip.setCssStyles({ borderColor: colab.color });
					chip.setCssStyles({ color: colab.color });
				}
				chip.addEventListener("click", (e) => {
					e.preventDefault();
					if (activo) seleccion.delete(colab.nombre);
					else seleccion.add(colab.nombre);
					render();
				});
			}
		};
		render();
		return { getSeleccionados: () => [...seleccion] };
	}

	protected async aplicarAsignados(file: TFile, asignados: string[]): Promise<void> {
		if (asignados.length === 0) return;
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			fm.asignados = [...asignados].sort((a, b) => a.localeCompare(b, "es"));
		});
	}

	/**
	 * Bloque opcional para asignar un rango de sprints al crear una épica/
	 * funcionalidad. Devuelve una asignación por cada sprint del rango (o vacío
	 * si no se eligió sprint inicio).
	 */
	/**
	 * Campo "Año": un botón a lo ancho del modal que abre el selector de años
	 * tipo calendario. `onChange` se dispara al elegir un año distinto.
	 */
	protected campoAnio(
		anioInicial = new Date().getFullYear(),
		onChange?: (anio: number) => void
	): { getAnio: () => number } {
		let anio = anioInicial;
		const wrap = this.contentEl.createDiv({ cls: "gf-campo" });
		wrap.createEl("label", { text: "Año", cls: "gf-campo-label" });
		const btn = wrap.createEl("button", { cls: "gf-campo-input gf-anio-btn", text: `${anio} ▾` });
		btn.addEventListener("click", (e) => {
			e.preventDefault();
			new AnioPickerModal(this.app, anio, (y) => {
				anio = y;
				btn.setText(`${y} ▾`);
				onChange?.(y);
			}).open();
		});
		return { getAnio: () => anio };
	}

	protected campoSprintOpcional(): { getSprints: () => files.SprintAsignado[] } {
		const anioCampo = this.campoAnio();

		// Lista de sprints con checkbox de asignación y engrane de etiquetas.
		const wrap = this.contentEl.createDiv({ cls: "gf-campo" });
		wrap.createEl("label", { text: "Asignar sprint", cls: "gf-campo-label" });
		const listaWrap = wrap.createDiv({ cls: "gf-sprints-lista" });
		const edicion = new Map<number, files.EtiquetaSprint[]>();
		renderListaSprints(this.plugin, listaWrap, edicion);

		return {
			getSprints: () =>
				[...edicion.entries()].map(([sprint, etiquetas]) => ({
					anio: anioCampo.getAnio(),
					sprint,
					etiquetas,
				})),
		};
	}

	protected mostrarError(campo: Campo, msg: string): void {
		campo.error.setText(msg);
		campo.error.show();
	}

	protected limpiarError(campo: Campo): void {
		campo.error.hide();
		campo.error.setText("");
	}

	protected botones(onCrear: () => void | Promise<void>, textoPrimario = "Crear"): void {
		const row = this.contentEl.createDiv({ cls: "gf-botones" });
		// Cancelar a la izquierda, primario (Crear/Guardar) a la derecha.
		const cancelar = row.createEl("button", { text: "Cancelar" });
		cancelar.addEventListener("click", () => this.close());
		this.crearBtn = row.createEl("button", { text: textoPrimario, cls: "mod-cta" });
		this.crearBtn.addEventListener("click", () => void onCrear());
	}

	protected sinEpicas(func: CampoSelect): void {
		func.select.disabled = true;
		func.wrap.createDiv({
			cls: "gf-campo-aviso",
			text: "No hay épicas aún. Crea una primero.",
		});
		this.crearBtn.disabled = true;
	}

	protected async abrirNota(file: TFile): Promise<void> {
		await this.app.workspace.getLeaf(false).openFile(file);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/** Aviso cuando la carpeta de administración no está configurada. */
export class AvisoConfiguracionModal extends Modal {
	private plugin: GestorFuncionesPlugin;

	constructor(plugin: GestorFuncionesPlugin) {
		super(plugin.app);
		this.plugin = plugin;
	}

	onOpen(): void {
		this.titleEl.setText("Gestión de épicas");
		this.contentEl.createEl("p", {
			text: "Crea las carpetas de gestión con el botón «Crear carpetas de gestión» del panel de acciones antes de continuar.",
		});
		const row = this.contentEl.createDiv({ cls: "gf-botones" });
		const btn = row.createEl("button", { text: "Abrir panel de acciones", cls: "mod-cta" });
		btn.addEventListener("click", () => {
			this.close();
			void this.plugin.abrirAcciones();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export class CrearFuncionalidadModal extends GestorModal {
	/** Si está marcado, al crear no se cierra el modal: vacía el formulario. */
	private crearNuevo = false;

	onOpen(): void {
		this.titleEl.setText("Crear épica");
		const nombre = this.campoTexto("Nombre de la épica", "Escribe nombre de la épica");
		const sprintOpc = this.campoSprintOpcional();

		const chkRow = this.contentEl.createDiv({ cls: "gf-campo" });
		const chkLabel = chkRow.createEl("label", { cls: "gf-chk" });
		const chk = chkLabel.createEl("input", { type: "checkbox" });
		chk.checked = this.crearNuevo;
		chkLabel.appendText(" Crear nueva");
		chk.addEventListener("change", () => {
			this.crearNuevo = chk.checked;
		});

		this.botones(async () => {
			this.limpiarError(nombre);
			const valor = nombre.input.value.trim();
			if (!valor || !slugify(valor)) {
				this.mostrarError(nombre, "El nombre es obligatorio.");
				return;
			}
			try {
				const file = await files.createFuncionalidad(
					this.app,
					this.plugin.settings.carpetaAdmin,
					valor
				);
				const sps = sprintOpc.getSprints();
				if (sps.length > 0) {
					const ref = files.funcRefDesdeCarpeta(
						this.app,
						`${this.plugin.settings.carpetaAdmin}/${slugify(valor)}`
					);
					if (ref) await files.guardarSprints(this.app, ref, sps);
				}
				if (this.crearNuevo) {
					// Se conserva el resto del formulario (sprints, etc.); solo se
					// limpia el nombre para crear la siguiente.
					new Notice(`Gestión de épicas: épica "${valor}" creada.`);
					nombre.input.value = "";
					this.limpiarError(nombre);
					nombre.input.focus();
				} else {
					this.close();
					await this.abrirNota(file);
				}
			} catch (e) {
				if (e instanceof files.YaExisteError) {
					this.mostrarError(nombre, "Ya existe una épica con ese nombre.");
				} else {
					console.error(e);
					new Notice("Gestión de épicas: error al crear la épica.");
				}
			}
		});
		nombre.input.focus();
	}
}

/** Editar el nombre visible de una épica o de una historia. */
export class EditarNombreModal extends GestorModal {
	onOpen(): void {
		this.titleEl.setText("Editar nombre");
		const funcs = files.listFuncionalidades(this.app, this.plugin.settings.carpetaAdmin);
		const epica = this.campoEpica(funcs);
		const fn = this.campoFuncionalidad(epica);

		// Selector opcional de incidencia: si se elige, se renombra la incidencia.
		const incCampo = this.campoSelect("Incidencia (opcional)", "Toda la épica/historia");
		let incidencias: files.Incidencia[] = [];
		const repoblarInc = () => {
			const base = fn.getFn() ?? epica.getFunc();
			incidencias = base
				? files.listIncidencias(this.app, base, this.plugin.settings.incidencias)
				: [];
			this.setOpciones(
				incCampo.select,
				"Toda la épica/historia",
				incidencias.map((i, idx) => ({ value: String(idx), label: `${i.tipoNombre}: ${i.nombre}` }))
			);
			incCampo.select.dispatchEvent(new Event("change"));
		};

		const nombre = this.campoTexto("Nuevo nombre", "Escribe el nuevo nombre");

		const incSeleccionada = (): files.Incidencia | null => {
			const v = incCampo.select.value;
			return v === "" ? null : incidencias[Number(v)] ?? null;
		};
		const sincronizar = () => {
			const inc = incSeleccionada();
			if (inc) {
				nombre.input.value = inc.nombre;
				return;
			}
			const o = fn.getFn() ?? epica.getFunc();
			nombre.input.value = o ? o.nombre : "";
		};
		epica.select.addEventListener("change", repoblarInc);
		fn.select.addEventListener("change", repoblarInc);
		incCampo.select.addEventListener("change", sincronizar);
		repoblarInc();

		this.botones(async () => {
			this.limpiarError(epica);
			this.limpiarError(nombre);
			const inc = incSeleccionada();
			const o = fn.getFn() ?? epica.getFunc() ?? null;
			const valor = nombre.input.value.trim();
			if (!o) {
				this.mostrarError(epica, MSG_OBLIGATORIO);
				return;
			}
			if (!valor) {
				this.mostrarError(nombre, "El nombre es obligatorio.");
				return;
			}
			try {
				if (inc) await files.renombrarIncidencia(this.app, inc.file, valor);
				else await files.renombrarFuncionalidad(this.app, o, valor);
				new Notice("Gestión de épicas: nombre actualizado.");
				this.close();
			} catch (e) {
				console.error(e);
				new Notice("Gestión de épicas: no se pudo renombrar.");
			}
		}, "Guardar");

		if (funcs.length === 0) this.sinEpicas(epica);
	}
}

/** Mueve una historia a otra épica (arrastra sus incidencias). */
export class MoverHistoriaModal extends GestorModal {
	onOpen(): void {
		this.titleEl.setText("Mover historia");
		const funcs = files.listFuncionalidades(this.app, this.plugin.settings.carpetaAdmin);
		const epica = this.campoEpica(funcs);
		const fn = this.campoFuncionalidad(epica);

		const destino = this.campoSelect("Mover a la épica", "Seleccionar épica destino");
		this.setOpciones(
			destino.select,
			"Seleccionar épica destino",
			funcs.map((f) => ({ value: f.slug, label: f.nombre }))
		);

		this.botones(async () => {
			this.limpiarError(fn);
			this.limpiarError(destino);
			const hist = fn.getFn();
			const dest = funcs.find((f) => f.slug === destino.select.value) ?? null;
			if (!hist) {
				this.mostrarError(fn, "Selecciona la historia a mover.");
				return;
			}
			if (!dest) {
				this.mostrarError(destino, MSG_OBLIGATORIO);
				return;
			}
			if (dest.slug === epica.getFunc()?.slug) {
				this.mostrarError(destino, "La historia ya pertenece a esa épica.");
				return;
			}
			try {
				await files.moverHistoriaAEpica(this.app, hist, dest);
				new Notice("Gestión de épicas: historia movida.");
				this.close();
			} catch (e) {
				console.error(e);
				new Notice("Gestión de épicas: no se pudo mover la historia.");
			}
		}, "Mover");

		if (funcs.length === 0) this.sinEpicas(epica);
	}
}

/** Editar una incidencia: cambiar su tipo y/o moverla a otra épica/historia. */
export class MoverIncidenciaModal extends GestorModal {
	onOpen(): void {
		this.titleEl.setText("Editar incidencia");
		this.modalEl.addClass("gf-modal-sprints");
		const funcs = files.listFuncionalidades(this.app, this.plugin.settings.carpetaAdmin);

		// --- Sección: seleccionar la incidencia ---
		this.seccion("Incidencia a editar");
		const epica = this.campoEpica(funcs);
		const fn = this.campoFuncionalidad(epica);
		const incCampo = this.campoSelect("Incidencia", "Seleccionar incidencia");
		let incidencias: files.Incidencia[] = [];
		const repoblarInc = () => {
			const base = fn.getFn() ?? epica.getFunc();
			incidencias = base
				? files.listIncidencias(this.app, base, this.plugin.settings.incidencias)
				: [];
			this.setOpciones(
				incCampo.select,
				"Seleccionar incidencia",
				incidencias.map((i, idx) => ({ value: String(idx), label: `${i.tipoNombre}: ${i.nombre}` }))
			);
			incCampo.select.dispatchEvent(new Event("change"));
		};
		epica.select.addEventListener("change", repoblarInc);
		fn.select.addEventListener("change", repoblarInc);

		const incSel = (): files.Incidencia | null => {
			const v = incCampo.select.value;
			return v === "" ? null : incidencias[Number(v)] ?? null;
		};

		// --- Sección: cambios (nombre y tipo) ---
		this.seccion("Cambios");
		const nombre = this.campoTexto("Nombre", "Nombre de la incidencia");
		const tipo = this.campoSelect("Tipo", "Seleccionar tipo");
		this.setOpciones(
			tipo.select,
			"Seleccionar tipo",
			this.plugin.settings.incidencias.map((i) => ({ value: i.nombre, label: i.nombre }))
		);
		// Al elegir incidencia, precarga su nombre y tipo actuales.
		incCampo.select.addEventListener("change", () => {
			const i = incSel();
			if (i) {
				nombre.input.value = i.nombre;
				tipo.select.value = i.tipoNombre;
			}
		});

		// --- Sección: mover a otra épica/historia ---
		this.seccion("Ubicación");
		const destEpica = this.campoSelect("Épica", "Seleccionar épica");
		this.setOpciones(
			destEpica.select,
			"Seleccionar épica",
			funcs.map((f) => ({ value: f.slug, label: f.nombre }))
		);
		const destFn = this.campoSelect("Historia (opcional)", "Nivel épica");
		let destHist: files.FuncRef[] = [];
		const repoblarDest = () => {
			const e = funcs.find((f) => f.slug === destEpica.select.value);
			destHist = e ? files.listFuncionalidadesDe(this.app, e.folder) : [];
			this.setOpciones(
				destFn.select,
				"Nivel épica",
				destHist.map((h) => ({ value: h.slug, label: h.nombre }))
			);
		};
		destEpica.select.addEventListener("change", repoblarDest);

		// Por defecto el destino apunta a la ubicación de origen seleccionada.
		const sincronizarDestino = () => {
			const ep = epica.getFunc();
			if (ep) {
				destEpica.select.value = ep.slug;
				repoblarDest();
				const h = fn.getFn();
				if (h) destFn.select.value = h.slug;
			}
		};
		epica.select.addEventListener("change", sincronizarDestino);
		fn.select.addEventListener("change", sincronizarDestino);

		repoblarInc();
		repoblarDest();

		this.botones(async () => {
			this.limpiarError(incCampo);
			this.limpiarError(nombre);
			this.limpiarError(tipo);
			this.limpiarError(destEpica);
			const i = incSel();
			const origen = fn.getFn() ?? epica.getFunc() ?? null;
			const destE = funcs.find((f) => f.slug === destEpica.select.value) ?? null;
			const destH = destHist.find((h) => h.slug === destFn.select.value) ?? null;
			const destFunc = destH ?? destE;
			const nuevoTipo = tipo.select.value;
			const nuevoNombre = nombre.input.value.trim();
			if (!i || !origen) {
				this.mostrarError(incCampo, "Selecciona la incidencia.");
				return;
			}
			if (!nuevoNombre) {
				this.mostrarError(nombre, "El nombre es obligatorio.");
				return;
			}
			if (!destFunc) {
				this.mostrarError(destEpica, MSG_OBLIGATORIO);
				return;
			}
			if (!nuevoTipo) {
				this.mostrarError(tipo, MSG_OBLIGATORIO);
				return;
			}
			try {
				await files.moverIncidencia(this.app, i.file, origen, destFunc, nuevoTipo, nuevoNombre);
				new Notice("Gestión de épicas: incidencia actualizada.");
				this.close();
			} catch (e) {
				console.error(e);
				new Notice("Gestión de épicas: no se pudo actualizar la incidencia.");
			}
		}, "Guardar");

		if (funcs.length === 0) this.sinEpicas(epica);
	}
}

export class CrearTareaModal extends GestorModal {
	private duplicadoPendiente: string | null = null;

	onOpen(): void {
		this.titleEl.setText("Crear tarea");
		const funcs = files.listFuncionalidades(this.app, this.plugin.settings.carpetaAdmin);
		const func = this.campoEpica(funcs);
		const fn = this.campoFuncionalidad(func);
		const nombre = this.campoTexto("Nombre de la tarea", "Escribe nombre de la tarea");
		const colaboradores = this.campoColaboradores();

		this.botones(async () => {
			this.limpiarError(func);
			this.limpiarError(nombre);
			const f = func.getFunc();
			const valor = nombre.input.value.trim();
			let ok = true;
			if (!f) {
				this.mostrarError(func, MSG_OBLIGATORIO);
				ok = false;
			}
			if (!valor || !slugify(valor)) {
				this.mostrarError(nombre, MSG_OBLIGATORIO);
				ok = false;
			}
			if (!ok || !f) return;
			const destino = fn.getFn() ?? f;

			let slug = slugify(valor);
			const dir = `${destino.folder.path}/tareas`;
			if (files.existeEnDir(this.app, dir, slug)) {
				const clave = `${destino.folder.path}/${slug}`;
				if (this.duplicadoPendiente !== clave) {
					this.duplicadoPendiente = clave;
					this.mostrarError(nombre, MSG_DUPLICADO);
					return;
				}
				slug = files.slugDisponible(this.app, dir, slug);
			}
			try {
				const file = await files.createTarea(this.app, destino, slug, valor);
				await this.aplicarAsignados(file, colaboradores.getSeleccionados());
				// Las tareas nuevas entran al tablero en POR HACER.
				const admin = this.plugin.settings.carpetaAdmin;
				this.plugin.settings.kanban.tareas[
					files.claveRelativa(admin, `${dir}/${slug}`)
				] = "POR HACER";
				await this.plugin.saveSettings();
				this.close();
				await this.abrirNota(file);
			} catch (e) {
				console.error(e);
				new Notice("Gestión de épicas: error al crear la tarea.");
			}
		});

		if (funcs.length === 0) {
			this.sinEpicas(func);
		}
	}
}

/** Crear una incidencia de un tipo configurable (carpeta por tipo, como tareas). */
export class CrearIncidenciaModal extends GestorModal {
	private duplicadoPendiente: string | null = null;

	onOpen(): void {
		this.titleEl.setText("Crear incidencia");
		const funcs = files.listFuncionalidades(this.app, this.plugin.settings.carpetaAdmin);
		const func = this.campoEpica(funcs);
		const fn = this.campoFuncionalidad(func);

		const tipo = this.campoSelect("Tipo de incidencia", "Seleccionar tipo");
		this.setOpciones(
			tipo.select,
			"Seleccionar tipo",
			this.plugin.settings.incidencias.map((i) => ({ value: i.nombre, label: i.nombre }))
		);

		const nombre = this.campoTexto("Nombre de la incidencia", "Escribe nombre de la incidencia");

		// Colaboradores como chips (mismo selector que "Asignar etiquetas").
		const colabSel = new Set<string>();
		const colWrap = this.contentEl.createDiv({ cls: "gf-campo" });
		colWrap.createEl("label", { text: "Colaboradores", cls: "gf-campo-label" });
		crearSelectorEtiquetas({
			parent: colWrap.createDiv(),
			etiquetas: this.plugin.settings.colaboradores.filter((c) => c.visible !== false),
			seleccion: colabSel,
			textoBtn: "Asignar colaboradores…",
			textoVacio: "No hay colaboradores registrados.",
		});

		this.botones(async () => {
			this.limpiarError(func);
			this.limpiarError(tipo);
			this.limpiarError(nombre);
			const f = func.getFunc();
			const tipoNombre = tipo.select.value;
			const valor = nombre.input.value.trim();
			let ok = true;
			if (!f) {
				this.mostrarError(func, MSG_OBLIGATORIO);
				ok = false;
			}
			if (!tipoNombre) {
				this.mostrarError(tipo, MSG_OBLIGATORIO);
				ok = false;
			}
			if (!valor || !slugify(valor)) {
				this.mostrarError(nombre, MSG_OBLIGATORIO);
				ok = false;
			}
			if (!ok || !f) return;
			const destino = fn.getFn() ?? f;
			const tipoSlug = slugify(tipoNombre);

			let base = slugify(valor);
			const dir = `${destino.folder.path}/${tipoSlug}`;
			if (files.existeEnDir(this.app, dir, base)) {
				const clave = `${destino.folder.path}/${tipoSlug}/${base}`;
				if (this.duplicadoPendiente !== clave) {
					this.duplicadoPendiente = clave;
					this.mostrarError(nombre, MSG_DUPLICADO);
					return;
				}
				base = files.slugDisponible(this.app, dir, base);
			}
			try {
				const file = await files.createIncidencia(
					this.app,
					destino,
					base,
					valor,
					tipoSlug,
					tipoNombre
				);
				await this.aplicarAsignados(file, [...colabSel]);
				this.close();
				await this.abrirNota(file);
			} catch (e) {
				console.error(e);
				new Notice("Gestión de épicas: error al crear la incidencia.");
			}
		});

		if (funcs.length === 0) {
			this.sinEpicas(func);
		}
		if (this.plugin.settings.incidencias.length === 0) {
			tipo.wrap.createDiv({
				cls: "gf-campo-aviso",
				text: 'No hay tipos de incidencia. Créalos con "Configurar incidencias".',
			});
		}
	}
}

/** Base para crear notas dentro de una funcionalidad, con o sin prefijo de fecha. */
abstract class CrearFechadoModal extends GestorModal {
	protected abstract titulo: string;
	protected abstract labelNombre: string;
	protected abstract placeholderNombre: string;
	protected abstract crear(
		func: files.FuncRef,
		base: string,
		nombre: string,
		fecha: string
	): Promise<TFile>;
	protected abstract carpeta(func: files.FuncRef): string;
	/** Las incidencias (pendientes) ofrecen asignar colaboradores al crear. */
	protected conColaboradores = false;
	/** Si el nombre del archivo lleva prefijo de fecha. */
	protected conFechaEnNombre = true;

	private duplicadoPendiente: string | null = null;

	onOpen(): void {
		this.titleEl.setText(this.titulo);
		const funcs = files.listFuncionalidades(this.app, this.plugin.settings.carpetaAdmin);
		const func = this.campoEpica(funcs);
		const fn = this.campoFuncionalidad(func);
		const nombre = this.campoTexto(this.labelNombre, this.placeholderNombre);
		const colaboradores = this.conColaboradores ? this.campoColaboradores() : null;

		this.botones(async () => {
			this.limpiarError(func);
			this.limpiarError(nombre);
			const f = func.getFunc();
			const valor = nombre.input.value.trim();
			let ok = true;
			if (!f) {
				this.mostrarError(func, MSG_OBLIGATORIO);
				ok = false;
			}
			if (!valor || !slugify(valor)) {
				this.mostrarError(nombre, MSG_OBLIGATORIO);
				ok = false;
			}
			if (!ok || !f) return;
			const destino = fn.getFn() ?? f;

			const fecha = hoy();
			let base = this.conFechaEnNombre ? `${fecha}-${slugify(valor)}` : slugify(valor);
			const dir = this.carpeta(destino);
			if (files.existeEnDir(this.app, dir, base)) {
				const clave = `${destino.folder.path}/${base}`;
				if (this.duplicadoPendiente !== clave) {
					this.duplicadoPendiente = clave;
					this.mostrarError(nombre, MSG_DUPLICADO);
					return;
				}
				base = files.slugDisponible(this.app, dir, base);
			}
			try {
				const file = await this.crear(destino, base, valor, fecha);
				if (colaboradores) {
					await this.aplicarAsignados(file, colaboradores.getSeleccionados());
				}
				this.close();
				await this.abrirNota(file);
			} catch (e) {
				console.error(e);
				new Notice("Gestión de épicas: error al crear el elemento.");
			}
		});

		if (funcs.length === 0) {
			this.sinEpicas(func);
		}
	}
}

/** Modal "Agregar link": inserta un callout [!link] en la posición del cursor. */
export class AgregarLinkModal extends GestorModal {
	private editor: Editor;

	constructor(plugin: GestorFuncionesPlugin, editor: Editor) {
		super(plugin);
		this.editor = editor;
	}

	onOpen(): void {
		this.titleEl.setText("Agregar link");
		const nombre = this.campoTexto("Nombre", "Ej: Ticket de Jira");
		const desc = this.campoTexto("Descripción", "Ej: Ticket relacionado al flujo de login");
		const link = this.campoTexto("Link", "https://");

		this.botones(() => {
			const callout = construirCalloutLink(
				nombre.input.value.trim(),
				desc.input.value.trim(),
				link.input.value.trim()
			);
			this.insertarEnCursor(callout);
			this.close();
		}, "Agregar");

		// Los tres campos son opcionales, pero al menos uno debe tener contenido.
		this.crearBtn.disabled = true;
		const actualizar = () => {
			this.crearBtn.disabled = !(
				nombre.input.value.trim() ||
				desc.input.value.trim() ||
				link.input.value.trim()
			);
		};
		for (const campo of [nombre, desc, link]) {
			campo.input.addEventListener("input", actualizar);
		}
		nombre.input.focus();
	}

	private insertarEnCursor(callout: string): void {
		const editor = this.editor;
		const cursor = editor.getCursor();
		const linea = editor.getLine(cursor.line);
		// Línea en blanco después del callout si lo siguiente tiene contenido,
		// para que el blockquote no absorba el texto de abajo.
		const haySiguienteConTexto =
			cursor.line + 1 < editor.lineCount() && editor.getLine(cursor.line + 1).trim() !== "";
		const sufijo = haySiguienteConTexto ? "\n" : "";
		if (linea.trim() === "") {
			editor.replaceRange(
				callout + sufijo,
				{ line: cursor.line, ch: 0 },
				{ line: cursor.line, ch: linea.length }
			);
		} else {
			editor.replaceRange("\n" + callout + sufijo, { line: cursor.line, ch: linea.length });
		}
	}
}

function construirCalloutLink(nombre: string, descripcion: string, link: string): string {
	const titulo = nombre || "Link";
	const lineas = [`> [!link] ${titulo}`];
	if (descripcion) lineas.push(`> ${descripcion}`);
	if (link) lineas.push(`> [${nombre || link}](${link})`);
	return lineas.join("\n");
}

export interface OpcionesSprint {
	epicaSlug?: string;
	anio?: number;
	/** Sprint hacia el que hacer scroll al abrir (desde el roadmap). */
	sprint?: number;
}

/** Modal "Asignar sprints": crea o edita el archivo sprints.md de una épica. */
export class AsignarSprintModal extends GestorModal {
	private opts: OpcionesSprint;
	/** Asignaciones del año visible: nº de sprint → sus etiquetas (con su nº de
	 * colaboradores). La presencia en el mapa indica que el sprint está asignado. */
	private edicion = new Map<number, files.EtiquetaSprint[]>();
	/** Todas las asignaciones leídas del archivo (todos los años). */
	private todosLosSprints: files.SprintAsignado[] = [];

	constructor(plugin: GestorFuncionesPlugin, opts: OpcionesSprint = {}) {
		super(plugin);
		this.opts = opts;
	}

	onOpen(): void {
		this.titleEl.setText("Asignar sprints");
		this.modalEl.addClass("gf-modal-sprints");

		const funcs = files.listFuncionalidades(this.app, this.plugin.settings.carpetaAdmin);
		const epica = this.campoEpica(funcs);

		// Año: botón que abre el selector de años tipo calendario.
		const actual = new Date().getFullYear();
		const anioCampo = this.campoAnio(
			this.opts.anio && this.opts.anio > 0 ? this.opts.anio : actual,
			() => {
				this.armarEdicion(leerAnio());
				this.renderLista(listaWrap);
			}
		);
		const leerAnio = (): number => anioCampo.getAnio();

		const listaWrap = this.contentEl.createDiv({ cls: "gf-sprints-lista" });

		// Los sprints se asignan a nivel de épica.
		const objetivo = () => epica.getFunc();

		this.botones(async () => {
			this.limpiarError(epica);
			const obj = objetivo();
			if (!obj) {
				this.mostrarError(epica, MSG_OBLIGATORIO);
				return;
			}
			const anio = leerAnio();
			// Solo se actualiza el año visible; los demás años se conservan.
			const otros = this.todosLosSprints.filter((s) => s.anio !== anio);
			const visibles: files.SprintAsignado[] = [...this.edicion.entries()].map(
				([sprint, etiquetas]) => ({ anio, sprint, etiquetas })
			);
			try {
				await files.guardarSprints(this.app, obj, [...otros, ...visibles]);
				this.close();
			} catch (e) {
				console.error(e);
				new Notice("Gestión de épicas: error al guardar los sprints.");
			}
		}, "Guardar");
		this.crearBtn.disabled = true;

		const cargar = async () => {
			const obj = objetivo();
			this.todosLosSprints = obj ? await files.leerSprints(this.app, obj) : [];
			this.armarEdicion(leerAnio());
			this.renderLista(listaWrap);
			this.crearBtn.disabled = !obj;
		};

		epica.select.addEventListener("change", () => void cargar());

		if (funcs.length === 0) {
			this.sinEpicas(epica);
			return;
		}
		if (this.opts.epicaSlug) {
			epica.seleccionar(this.opts.epicaSlug);
		} else {
			void cargar();
		}
	}

	private armarEdicion(anio: number): void {
		this.edicion.clear();
		for (const s of this.todosLosSprints) {
			if (s.anio === anio) {
				this.edicion.set(
					s.sprint,
					s.etiquetas.map((e) => ({ ...e }))
				);
			}
		}
	}

	private renderLista(cont: HTMLElement): void {
		renderListaSprints(this.plugin, cont, this.edicion, this.opts.sprint);
	}
}

/**
 * Dibuja la lista de sprints (checkbox de asignación + engrane de configuración
 * + chips de solo lectura). La comparten el modal "Asignar sprints" y la
 * creación de épicas. Muta `edicion` directamente.
 */
function renderListaSprints(
	plugin: GestorFuncionesPlugin,
	cont: HTMLElement,
	edicion: Map<number, files.EtiquetaSprint[]>,
	scrollSprint?: number
): void {
	// Conserva el scroll de la tabla al repintar (al marcar/desmarcar un sprint).
	const scrollPrevio = cont.scrollTop;
	cont.empty();
	const disponibles = plugin.settings.etiquetas.filter((e) => e.visible !== false);
	const colorEtiqueta = (nombre: string) =>
		plugin.settings.etiquetas.find((e) => e.nombre === nombre)?.color ?? "#B9BEC6";
	for (let n = 1; n <= plugin.settings.numSprints; n++) {
		const fila = cont.createDiv({ cls: "gf-sprint-fila", attr: { "data-sprint": String(n) } });
		const cabecera = fila.createDiv({ cls: "gf-sprint-cabecera" });
		const chk = cabecera.createEl("input", { type: "checkbox" });
		chk.checked = edicion.has(n);
		cabecera.createEl("span", { text: `Sprint ${n}`, cls: "gf-sprint-nombre" });

		const engrane = cabecera.createEl("button", { cls: "gf-sprint-engrane" });
		setIcon(engrane, "settings");
		engrane.setAttr("title", "Configurar etiquetas del sprint");
		engrane.addEventListener("click", (e) => {
			e.preventDefault();
			new ConfigurarSprintModal(plugin, n, disponibles, edicion.get(n) ?? [], (lista) => {
				if (lista.length > 0) edicion.set(n, lista);
				else if (edicion.has(n)) edicion.set(n, []);
				renderListaSprints(plugin, cont, edicion, scrollSprint);
			}).open();
		});

		const chipsWrap = fila.createDiv({ cls: "gf-sprint-chips" });
		for (const et of edicion.get(n) ?? []) {
			renderChipEtiqueta(chipsWrap, et.nombre, colorEtiqueta(et.nombre), et.num);
		}

		chk.addEventListener("change", () => {
			if (chk.checked) edicion.set(n, edicion.get(n) ?? []);
			else edicion.delete(n);
			renderListaSprints(plugin, cont, edicion, scrollSprint);
		});
	}
	// En el primer render (sin scroll) se centra el sprint indicado; en los
	// repintados posteriores se restaura la posición que tenía la tabla.
	if (scrollPrevio === 0 && scrollSprint) {
		cont.querySelector(`[data-sprint="${scrollSprint}"]`)?.scrollIntoView({ block: "center" });
	} else {
		cont.scrollTop = scrollPrevio;
	}
}

/** Submodal "Configurar sprint": elige las etiquetas del sprint y su nº de
 * colaboradores. Devuelve la lista al cerrar con Guardar. */
class ConfigurarSprintModal extends Modal {
	constructor(
		private plugin: GestorFuncionesPlugin,
		private sprint: number,
		private disponibles: Etiqueta[],
		private actuales: files.EtiquetaSprint[],
		private onGuardar: (lista: files.EtiquetaSprint[]) => void
	) {
		super(plugin.app);
	}

	onOpen(): void {
		this.titleEl.setText("Configurar sprint");
		const filaSprint = this.contentEl.createDiv({ cls: "gf-config-sprint-cab" });
		filaSprint.createEl("span", { text: "Sprint", cls: "gf-campo-label" });
		filaSprint.createEl("span", {
			cls: "gf-config-sprint-nombre",
			text: `Sprint ${this.sprint}`,
		});

		// Estado de edición: nombre de etiqueta → nº (null = marcada sin número).
		const seleccion = new Map<string, number | null>();
		for (const e of this.actuales) seleccion.set(e.nombre, e.num ?? null);

		const caja = this.contentEl.createDiv({ cls: "gf-config-sprint-caja" });
		if (this.disponibles.length === 0) {
			caja.createEl("em", {
				cls: "gf-campo-aviso",
				text: "No hay etiquetas de sprint. Agrégalas en los ajustes del plugin.",
			});
		}
		for (const et of this.disponibles) {
			const fila = caja.createDiv({ cls: "gf-config-etq-fila" });
			const chk = fila.createEl("input", { type: "checkbox" });
			chk.checked = seleccion.has(et.nombre);
			renderChipEtiqueta(fila, et.nombre, et.color);

			const numWrap = fila.createSpan({ cls: "gf-config-num" });
			numWrap.createSpan({ cls: "gf-config-num-icono", text: "👤" });
			const numInput = numWrap.createEl("input", {
				type: "number",
				cls: "gf-roadmap-num",
				attr: { min: "1", step: "1", placeholder: "—" },
			});
			const cur = seleccion.get(et.nombre);
			numInput.value = cur ? String(cur) : "";
			numInput.disabled = !chk.checked;

			chk.addEventListener("change", () => {
				if (chk.checked) seleccion.set(et.nombre, seleccion.get(et.nombre) ?? null);
				else seleccion.delete(et.nombre);
				numInput.disabled = !chk.checked;
				if (!chk.checked) numInput.value = "";
			});
			numInput.addEventListener("change", () => {
				const v = Math.trunc(Number(numInput.value));
				seleccion.set(et.nombre, Number.isFinite(v) && v > 0 ? v : null);
			});
		}

		const row = this.contentEl.createDiv({ cls: "gf-botones" });
		const cancelar = row.createEl("button", { text: "Cancelar" });
		cancelar.addEventListener("click", () => this.close());
		const ok = row.createEl("button", { text: "Guardar", cls: "mod-cta" });
		ok.addEventListener("click", () => {
			const lista: files.EtiquetaSprint[] = [];
			for (const et of this.disponibles) {
				if (!seleccion.has(et.nombre)) continue;
				const num = seleccion.get(et.nombre);
				lista.push({ nombre: et.nombre, num: num && num > 0 ? num : undefined });
			}
			this.onGuardar(lista);
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/**
 * Selector de etiquetas con chips: muestra las elegidas como chips y un botón
 * que abre un desplegable (montado en <body>) con casillas. Muta `seleccion`.
 */
export function crearSelectorEtiquetas(opts: {
	parent: HTMLElement;
	etiquetas: Etiqueta[];
	seleccion: Set<string>;
	textoBtn?: string;
	/** Mensaje cuando no hay opciones (por defecto, referido a etiquetas). */
	textoVacio?: string;
	onChange?: () => void;
}): void {
	const wrap = opts.parent.createDiv({ cls: "gf-selet" });
	const chips = wrap.createSpan({ cls: "gf-selet-chips" });
	const btn = wrap.createEl("button", { cls: "gf-selet-btn" });
	if (opts.textoBtn) btn.setText(opts.textoBtn);
	else setIcon(btn, "plus");

	const panel = createDiv({ cls: "gf-multiselect-panel gf-select-panel-float gf-selet-panel" });

	const renderChips = () => {
		chips.empty();
		for (const et of opts.etiquetas) {
			if (opts.seleccion.has(et.nombre)) renderChipEtiqueta(chips, et.nombre, et.color);
		}
	};
	const renderPanel = () => {
		panel.empty();
		if (opts.etiquetas.length === 0) {
			panel.createEl("em", {
				cls: "gf-campo-aviso",
				text: opts.textoVacio ?? "Esta épica no tiene etiquetas.",
			});
			return;
		}
		for (const et of opts.etiquetas) {
			const fila = panel.createEl("label", { cls: "gf-chk gf-selet-opcion" });
			const chk = fila.createEl("input", { type: "checkbox" });
			chk.checked = opts.seleccion.has(et.nombre);
			renderChipEtiqueta(fila, et.nombre, et.color);
			chk.addEventListener("change", () => {
				if (chk.checked) opts.seleccion.add(et.nombre);
				else opts.seleccion.delete(et.nombre);
				renderChips();
				opts.onChange?.();
			});
		}
	};

	let abierto = false;
	const onDocClick = (ev: MouseEvent) => {
		const t = ev.target as Node;
		if (!panel.contains(t) && t !== btn && !btn.contains(t)) cerrar();
	};
	const onScroll = (ev: Event) => {
		if (!panel.contains(ev.target as Node)) cerrar();
	};
	const onKey = (ev: KeyboardEvent) => {
		if (ev.key === "Escape") cerrar();
	};
	function cerrar(): void {
		if (!abierto) return;
		abierto = false;
		panel.remove();
		activeDocument.removeEventListener("click", onDocClick, true);
		window.removeEventListener("scroll", onScroll, true);
		window.removeEventListener("resize", cerrar);
		activeDocument.removeEventListener("keydown", onKey, true);
	}
	function abrir(): void {
		if (abierto) return;
		renderPanel();
		activeDocument.body.appendChild(panel);
		const r = btn.getBoundingClientRect();
		panel.setCssStyles({ top: `${r.bottom + 4}px`, left: `${r.left}px`, display: "block" });
		abierto = true;
		window.setTimeout(() => {
			activeDocument.addEventListener("click", onDocClick, true);
			window.addEventListener("scroll", onScroll, true);
			window.addEventListener("resize", cerrar);
			activeDocument.addEventListener("keydown", onKey, true);
		}, 0);
	}
	btn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		if (abierto) cerrar();
		else abrir();
	});
	renderChips();
}

/** Modal "Asignar etiquetas": asigna etiquetas de la épica a cada historia. */
export class AsignarEtiquetasModal extends GestorModal {
	onOpen(): void {
		this.titleEl.setText("Etiquetar historias");
		this.modalEl.addClass("gf-modal-sprints");
		const funcs = files.listFuncionalidades(this.app, this.plugin.settings.carpetaAdmin);
		const epica = this.campoEpica(funcs);
		const listaWrap = this.contentEl.createDiv({ cls: "gf-sprints-lista" });

		let historias: files.FuncRef[] = [];
		const seleccion = new Map<string, Set<string>>();

		const renderLista = () => {
			listaWrap.empty();
			const ep = epica.getFunc();
			if (!ep) {
				listaWrap.createEl("em", { cls: "gf-campo-aviso", text: "Selecciona una épica." });
				return;
			}
			const disponibles = files
				.leerEtiquetasEpica(this.app, ep)
				.filter((e) => e.visible !== false);
			if (historias.length === 0) {
				listaWrap.createEl("em", {
					cls: "gf-campo-aviso",
					text: "Esta épica no tiene historias aún.",
				});
				return;
			}
			for (const h of historias) {
				const fila = listaWrap.createDiv({ cls: "gf-asignet-fila" });
				const nombreEl = fila.createSpan({ cls: "gf-asignet-nombre", text: h.nombre });
				nombreEl.setAttr("title", h.nombre);
				crearSelectorEtiquetas({
					parent: fila,
					etiquetas: disponibles,
					seleccion: seleccion.get(h.file.path) ?? new Set(),
				});
			}
		};

		const cargar = () => {
			const ep = epica.getFunc();
			historias = ep ? files.listFuncionalidadesDe(this.app, ep.folder) : [];
			seleccion.clear();
			for (const h of historias) {
				seleccion.set(h.file.path, new Set(files.leerEtiquetasHistoria(this.app, h.file)));
			}
			renderLista();
			this.crearBtn.disabled = !ep;
		};

		this.botones(async () => {
			this.limpiarError(epica);
			const ep = epica.getFunc();
			if (!ep) {
				this.mostrarError(epica, MSG_OBLIGATORIO);
				return;
			}
			try {
				for (const h of historias) {
					await files.guardarEtiquetasHistoria(this.app, h.file, [
						...(seleccion.get(h.file.path) ?? []),
					]);
				}
				this.close();
			} catch (e) {
				console.error(e);
				new Notice("Gestión de épicas: error al guardar las etiquetas.");
			}
		}, "Guardar");
		this.crearBtn.disabled = true;

		epica.select.addEventListener("change", () => cargar());
		renderLista();
		if (funcs.length === 0) this.sinEpicas(epica);
	}
}

export class CrearPendienteModal extends CrearFechadoModal {
	protected titulo = "Crear pendiente";
	protected labelNombre = "Nombre del pendiente";
	protected placeholderNombre = "Ej: Revisar mockups con el equipo";
	protected conColaboradores = true;
	protected conFechaEnNombre = false;

	protected carpeta(func: files.FuncRef): string {
		return `${func.folder.path}/pendientes`;
	}

	protected crear(func: files.FuncRef, base: string, nombre: string, fecha: string): Promise<TFile> {
		return files.createPendiente(this.app, func, base, nombre, fecha);
	}
}

/**
 * Archivar épicas en una sola tabla con casillas: la casilla marcada indica que
 * la épica está (o pasará a estar) archivada al Guardar. Filtro opcional por año
 * y rango de sprints (por defecto, sin filtro: se muestran todas).
 */
export class MoverEpicaModal extends GestorModal {
	/** Todas las épicas (activas + archivadas), con su estado actual de archivado. */
	private todas: Array<{ ref: files.FuncRef; archivada: boolean }> = [];
	/** Casilla deseada por ruta de épica (marcada = archivada). Persiste entre
	 * repintados aunque el filtro oculte filas. */
	private estados = new Map<string, boolean>();
	/** Filas visibles renderizadas (para leer sus casillas). */
	private filas: Array<{ ref: files.FuncRef; chk: HTMLInputElement }> = [];
	/** Sprints por ruta de épica (año actual y previos), cargados al filtrar. */
	private sprintsPorEpica = new Map<string, files.SprintAsignado[]>();
	private filtroActivo = false;
	private anio = new Date().getFullYear();
	private desde = 1;
	private hasta: number;
	private listaWrap!: HTMLElement;

	constructor(plugin: GestorFuncionesPlugin) {
		super(plugin);
		this.hasta = plugin.settings.numSprints;
	}

	onOpen(): void {
		this.titleEl.setText("Archivar épicas");
		this.modalEl.addClass("gf-modal-etiquetas");

		const activas = files.listFuncionalidades(this.app, files.CARPETA_ACTIVAS);
		const inactivas = files.listFuncionalidades(this.app, files.CARPETA_INACTIVAS);
		this.todas = [
			...activas.map((ref) => ({ ref, archivada: false })),
			...inactivas.map((ref) => ({ ref, archivada: true })),
		].sort((a, b) => a.ref.nombre.localeCompare(b.ref.nombre, "es"));
		for (const e of this.todas) this.estados.set(e.ref.folder.path, e.archivada);

		this.renderFiltro();
		this.listaWrap = this.contentEl.createDiv({ cls: "gf-etq-scroll" });
		this.pintarLista();

		this.botones(async () => {
			this.sincronizar();
			let movidas = 0;
			for (const ep of this.todas) {
				const quiere = this.estados.get(ep.ref.folder.path) ?? ep.archivada;
				if (quiere === ep.archivada) continue;
				const destino = quiere ? files.CARPETA_INACTIVAS : files.CARPETA_ACTIVAS;
				const ruta = `${destino}/${ep.ref.slug}`;
				if (this.app.vault.getAbstractFileByPath(ruta)) {
					new Notice(`Gestión de épicas: ya existe "${ep.ref.nombre}" en la carpeta destino.`);
					continue;
				}
				try {
					await this.app.fileManager.renameFile(ep.ref.folder, ruta);
					movidas++;
				} catch (e) {
					console.error(e);
					new Notice(`Gestión de épicas: no se pudo mover "${ep.ref.nombre}".`);
				}
			}
			if (movidas > 0) new Notice(`Gestión de épicas: ${movidas} épica(s) actualizada(s).`);
			this.close();
		}, "Guardar");

		if (this.todas.length === 0) this.crearBtn.disabled = true;
	}

	/** Controles de filtro: casilla para activarlo + año y rango de sprints. */
	private renderFiltro(): void {
		const maxSprints = this.plugin.settings.numSprints;
		if (this.hasta > maxSprints) this.hasta = maxSprints;

		const wrap = this.contentEl.createDiv({ cls: "gf-campo" });
		const cab = wrap.createEl("label", { cls: "gf-chk" });
		const chk = cab.createEl("input", { type: "checkbox" });
		chk.checked = this.filtroActivo;
		cab.appendText(" Filtrar por año y sprint");

		const controles = wrap.createDiv({ cls: "gf-roadmap-controles" });
		const pintarControles = () => {
			controles.empty();
			controles.toggle(this.filtroActivo);
			if (!this.filtroActivo) return;

			controles.createEl("span", { text: "Año", cls: "gf-roadmap-lbl" });
			const anioBtn = controles.createEl("button", {
				cls: "gf-multiselect-btn",
				text: `${this.anio} ▾`,
			});
			anioBtn.addEventListener("click", (e) => {
				e.preventDefault();
				new AnioPickerModal(this.app, this.anio, (y) => {
					this.anio = y;
					anioBtn.setText(`${y} ▾`);
					void this.refiltrar();
				}).open();
			});

			const opcionesSprint = (desde: number) => {
				const ops = [];
				for (let n = desde; n <= maxSprints; n++) ops.push({ valor: String(n), texto: `Sprint ${n}` });
				return ops;
			};
			const rango = controles.createDiv({ cls: "gf-roadmap-rango" });
			rango.createEl("span", { text: "Sprint inicio", cls: "gf-roadmap-lbl" });
			crearSelect({
				parent: rango,
				opciones: opcionesSprint(1),
				valor: String(this.desde),
				onChange: (v) => {
					this.desde = Number(v);
					if (this.hasta < this.desde) this.hasta = this.desde;
					finCtl.setOpciones(opcionesSprint(this.desde), String(this.hasta));
					void this.refiltrar();
				},
			});
			rango.createEl("span", { text: "fin", cls: "gf-roadmap-lbl" });
			const finCtl = crearSelect({
				parent: rango,
				opciones: opcionesSprint(this.desde),
				valor: String(this.hasta),
				onChange: (v) => {
					this.hasta = Number(v);
					void this.refiltrar();
				},
			});
		};

		chk.addEventListener("change", () => {
			this.filtroActivo = chk.checked;
			pintarControles();
			void this.refiltrar();
		});
		pintarControles();
	}

	/** Vuelca las casillas visibles al mapa de estados (para no perder cambios
	 * del usuario cuando el filtro oculta o reordena filas). */
	private sincronizar(): void {
		for (const f of this.filas) this.estados.set(f.ref.folder.path, f.chk.checked);
	}

	/** Carga los sprints que falten y vuelve a pintar la lista según el filtro. */
	private async refiltrar(): Promise<void> {
		this.sincronizar();
		if (this.filtroActivo) {
			for (const ep of this.todas) {
				if (!this.sprintsPorEpica.has(ep.ref.folder.path)) {
					this.sprintsPorEpica.set(
						ep.ref.folder.path,
						await files.leerSprints(this.app, ep.ref)
					);
				}
			}
		}
		this.pintarLista();
	}

	private pasaFiltro(ref: files.FuncRef): boolean {
		if (!this.filtroActivo) return true;
		const sprints = this.sprintsPorEpica.get(ref.folder.path) ?? [];
		return sprints.some(
			(s) => s.anio === this.anio && s.sprint >= this.desde && s.sprint <= this.hasta
		);
	}

	private pintarLista(): void {
		this.listaWrap.empty();
		this.filas = [];
		const visibles = this.todas.filter((e) => this.pasaFiltro(e.ref));
		if (visibles.length === 0) {
			this.listaWrap.createEl("em", {
				cls: "gf-campo-aviso",
				text: this.todas.length === 0 ? "No hay épicas." : "Ninguna épica cumple el filtro.",
			});
			return;
		}
		const tbody = this.listaWrap.createEl("table", { cls: "gf-etq-tabla" }).createEl("tbody");
		for (const ep of visibles) {
			const tr = tbody.createEl("tr", { cls: "gf-etq-fila" });
			const tdChk = tr.createEl("td", { cls: "gf-etq-visible-td" });
			const chk = tdChk.createEl("input", { type: "checkbox" });
			chk.checked = this.estados.get(ep.ref.folder.path) ?? ep.archivada;
			chk.setAttr("title", "Marcada = archivada");
			tr.createEl("td", { cls: "gf-etq-nombre-td" }).createEl("span", {
				cls: "gf-etq-nombre",
				text: ep.ref.nombre,
			});
			this.filas.push({ ref: ep.ref, chk });
		}
	}
}

/** Asignar colaboradores a incidencias (tareas y pendientes). */
export class AsignarColaboradorModal extends GestorModal {
	private seleccionados = new Set<string>();
	private filas: Array<{ file: TFile; chk: HTMLInputElement }> = [];

	onOpen(): void {
		this.titleEl.setText("Asignar colaborador");
		this.modalEl.addClass("gf-modal-sprints");

		const funcs = files.listFuncionalidades(this.app, this.plugin.settings.carpetaAdmin);
		const epica = this.campoEpica(funcs);
		const fn = this.campoFuncionalidad(epica);

		// Colaboradores como chips (mismo selector que "Asignar etiquetas").
		const colWrap = this.contentEl.createDiv({ cls: "gf-campo" });
		colWrap.createEl("label", { text: "Colaboradores", cls: "gf-campo-label" });
		crearSelectorEtiquetas({
			parent: colWrap.createDiv(),
			etiquetas: this.plugin.settings.colaboradores.filter((c) => c.visible !== false),
			seleccion: this.seleccionados,
			textoBtn: "Asignar colaboradores…",
			textoVacio: "No hay colaboradores registrados.",
			onChange: () => {
				refrescarChecks();
				actualizarBoton();
			},
		});

		// Filtro por tipo de incidencia.
		let tipoFiltro = "";
		const tipoWrap = this.contentEl.createDiv({ cls: "gf-campo" });
		tipoWrap.createEl("label", { text: "Tipo de incidencia", cls: "gf-campo-label" });
		const tipoSel = tipoWrap.createEl("select", { cls: "dropdown gf-campo-select" });
		tipoSel.createEl("option", { text: "Todos", value: "" });
		for (const i of this.plugin.settings.incidencias) {
			tipoSel.createEl("option", { text: i.nombre, value: i.nombre });
		}
		tipoSel.addEventListener("change", () => {
			tipoFiltro = tipoSel.value;
			renderIncidencias();
			actualizarBoton();
		});

		const listaWrap = this.contentEl.createDiv({ cls: "gf-sprints-lista" });

		const actualizarBoton = () => {
			this.crearBtn.disabled = !epica.getFunc() || this.seleccionados.size === 0;
		};

		const refrescarChecks = () => {
			for (const fila of this.filas) {
				const asignados = files.getAsignados(this.app, fila.file);
				fila.chk.checked =
					this.seleccionados.size > 0 &&
					[...this.seleccionados].every((c) => asignados.includes(c));
			}
		};

		const colorTipo = (nombre: string) =>
			this.plugin.settings.incidencias.find((i) => i.nombre === nombre)?.color ?? "#B9BEC6";

		const renderIncidencias = () => {
			listaWrap.empty();
			this.filas = [];
			const f = epica.getFunc();
			if (!f) return;
			// Con funcionalidad elegida se listan solo sus incidencias; sin ella,
			// las de nivel épica más las de todas sus funcionalidades.
			const seleccionFn = fn.getFn();

			// Primera fila: asignar a la propia épica/historia (su nota principal).
			const objetivoPrincipal = seleccionFn ?? f;
			const filaPpal = listaWrap.createDiv({ cls: "gf-sprint-fila" });
			const cabPpal = filaPpal.createDiv({ cls: "gf-sprint-cabecera" });
			const chkPpal = cabPpal.createEl("input", { type: "checkbox" });
			cabPpal.createEl("span", {
				text: seleccionFn ? `Historia: ${seleccionFn.nombre}` : `Épica: ${f.nombre}`,
				cls: "gf-sprint-nombre",
			});
			this.filas.push({ file: objetivoPrincipal.file, chk: chkPpal });

			const tipos = this.plugin.settings.incidencias;
			const filtrar = (incs: files.Incidencia[]) =>
				tipoFiltro ? incs.filter((i) => i.tipoNombre === tipoFiltro) : incs;
			const grupos: Array<{ origen: string; incidencias: files.Incidencia[] }> = [];
			if (seleccionFn) {
				grupos.push({
					origen: "",
					incidencias: filtrar(files.listIncidencias(this.app, seleccionFn, tipos)),
				});
			} else {
				grupos.push({ origen: "", incidencias: filtrar(files.listIncidencias(this.app, f, tipos)) });
				for (const hija of files.listFuncionalidadesDe(this.app, f.folder)) {
					grupos.push({
						origen: hija.nombre,
						incidencias: filtrar(files.listIncidencias(this.app, hija, tipos)),
					});
				}
			}
			const total = grupos.reduce((n, g) => n + g.incidencias.length, 0);
			if (total === 0) {
				listaWrap.createEl("em", {
					cls: "gf-campo-aviso",
					text: seleccionFn
						? "Esta historia no tiene incidencias aún."
						: "Esta épica no tiene incidencias aún.",
				});
			}
			for (const grupo of grupos) {
				for (const inc of grupo.incidencias) {
					const fila = listaWrap.createDiv({ cls: "gf-sprint-fila" });
					const cabecera = fila.createDiv({ cls: "gf-sprint-cabecera" });
					if (inc.nivel > 0) cabecera.addClass("gf-incidencia-sub");
					const chk = cabecera.createEl("input", { type: "checkbox" });
					renderChipEtiqueta(cabecera, inc.tipoNombre, colorTipo(inc.tipoNombre));
					cabecera.createEl("span", { text: inc.nombre, cls: "gf-sprint-nombre" });
					if (grupo.origen) {
						cabecera.createEl("span", { text: grupo.origen, cls: "gf-campo-aviso" });
					}
					this.filas.push({ file: inc.file, chk });
				}
			}
			refrescarChecks();
		};

		this.botones(async () => {
			const f = epica.getFunc();
			if (!f || this.seleccionados.size === 0) return;
			try {
				for (const fila of this.filas) {
					const previos = files.getAsignados(this.app, fila.file);
					const actuales = new Set(previos);
					if (fila.chk.checked) {
						for (const c of this.seleccionados) actuales.add(c);
					} else {
						for (const c of this.seleccionados) actuales.delete(c);
					}
					if (actuales.size === previos.length && previos.every((p) => actuales.has(p))) {
						continue;
					}
					await this.app.fileManager.processFrontMatter(fila.file, (fm: Record<string, unknown>) => {
						fm.asignados = [...actuales].sort((a, b) => a.localeCompare(b, "es"));
					});
				}
				this.close();
				new Notice("Gestión de épicas: asignaciones guardadas.");
			} catch (e) {
				console.error(e);
				new Notice("Gestión de épicas: error al guardar las asignaciones.");
			}
		}, "Guardar");
		this.crearBtn.disabled = true;

		fn.select.addEventListener("change", () => {
			renderIncidencias();
			actualizarBoton();
		});

		if (funcs.length === 0) {
			this.sinEpicas(epica);
		}
	}
}

/** Crear una funcionalidad dentro de una épica: carpeta + nota de descripción. */
export class CrearFuncionalidadNuevaModal extends GestorModal {
	/** Si está marcado, al crear no se cierra el modal: vacía el formulario. */
	private crearNuevo = false;

	onOpen(): void {
		this.titleEl.setText("Crear historia");
		const funcs = files.listFuncionalidades(this.app, this.plugin.settings.carpetaAdmin);
		const epica = this.campoEpica(funcs);
		const nombre = this.campoTexto(
			"Nombre de la historia",
			"Escribe nombre de la historia"
		);

		// Selector de etiquetas de la épica elegida (se rehace al cambiar de épica).
		const seleccion = new Set<string>();
		const etqWrap = this.contentEl.createDiv({ cls: "gf-campo" });
		etqWrap.createEl("label", { text: "Asignar etiquetas", cls: "gf-campo-label" });
		const etqCont = etqWrap.createDiv();
		const refrescarEtiquetas = () => {
			etqCont.empty();
			const ep = epica.getFunc();
			const disponibles = ep
				? files.leerEtiquetasEpica(this.app, ep).filter((e) => e.visible !== false)
				: [];
			for (const n of [...seleccion]) {
				if (!disponibles.some((e) => e.nombre === n)) seleccion.delete(n);
			}
			crearSelectorEtiquetas({
				parent: etqCont,
				etiquetas: disponibles,
				seleccion,
				textoBtn: "Asignar etiquetas…",
			});
		};
		epica.select.addEventListener("change", refrescarEtiquetas);
		refrescarEtiquetas();

		const chkRow = this.contentEl.createDiv({ cls: "gf-campo" });
		const chkLabel = chkRow.createEl("label", { cls: "gf-chk" });
		const chk = chkLabel.createEl("input", { type: "checkbox" });
		chk.checked = this.crearNuevo;
		chkLabel.appendText(" Crear nueva");
		chk.addEventListener("change", () => {
			this.crearNuevo = chk.checked;
		});

		this.botones(async () => {
			this.limpiarError(epica);
			this.limpiarError(nombre);
			const f = epica.getFunc();
			const valor = nombre.input.value.trim();
			let ok = true;
			if (!f) {
				this.mostrarError(epica, MSG_OBLIGATORIO);
				ok = false;
			}
			if (!valor || !slugify(valor)) {
				this.mostrarError(nombre, "El nombre es obligatorio.");
				ok = false;
			}
			if (!ok || !f) return;
			try {
				const file = await files.createFuncionalidadEn(this.app, f, valor);
				if (seleccion.size > 0) {
					await files.guardarEtiquetasHistoria(this.app, file, [...seleccion]);
				}
				if (this.crearNuevo) {
					// Se conserva la épica y las etiquetas elegidas; solo se limpia
					// el nombre para crear la siguiente historia.
					new Notice(`Gestión de épicas: historia "${valor}" creada.`);
					nombre.input.value = "";
					this.limpiarError(nombre);
					nombre.input.focus();
				} else {
					this.close();
					await this.abrirNota(file);
				}
			} catch (e) {
				if (e instanceof files.YaExisteError) {
					this.mostrarError(nombre, "Ya existe una historia con ese nombre.");
				} else {
					console.error(e);
					new Notice("Gestión de épicas: error al crear la historia.");
				}
			}
		});

		if (funcs.length === 0) {
			this.sinEpicas(epica);
		}
	}
}
