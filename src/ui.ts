import { App, Modal } from "obsidian";

export interface OpcionMulti {
	valor: string;
	texto: string;
}

/**
 * Control tipo "select con checkboxes": un botón que abre un panel con casillas.
 * Si están todas marcadas el botón muestra "Todos". Muta `seleccion` y llama a
 * `onChange` sin reconstruir el control (el panel permanece abierto).
 */
export function crearMultiSelect(opts: {
	parent: HTMLElement;
	etiqueta: string;
	opciones: OpcionMulti[];
	seleccion: Set<string>;
	onChange: () => void;
}): void {
	const wrap = opts.parent.createDiv({ cls: "gf-multiselect" });
	const btn = wrap.createEl("button", { cls: "gf-multiselect-btn" });
	const panel = wrap.createDiv({ cls: "gf-multiselect-panel" });

	let abierto = false;
	const onDocClick = (ev: MouseEvent) => {
		if (!wrap.contains(ev.target as Node)) setAbierto(false);
	};
	const setAbierto = (v: boolean) => {
		abierto = v;
		panel.toggleClass("gf-multiselect-abierto", v);
		if (v) document.addEventListener("click", onDocClick);
		else document.removeEventListener("click", onDocClick);
	};
	setAbierto(false);

	const actualizarLabel = () => {
		const total = opts.opciones.length;
		const n = opts.opciones.filter((o) => opts.seleccion.has(o.valor)).length;
		const resumen = total > 0 && n === total ? "Todos" : n === 0 ? "Ninguno" : `${n} sel.`;
		btn.setText(`${opts.etiqueta}: ${resumen} ▾`);
	};

	for (const o of opts.opciones) {
		const fila = panel.createEl("label", { cls: "gf-chk" });
		const chk = fila.createEl("input", { type: "checkbox" });
		chk.checked = opts.seleccion.has(o.valor);
		fila.appendText(` ${o.texto}`);
		chk.addEventListener("change", () => {
			if (chk.checked) opts.seleccion.add(o.valor);
			else opts.seleccion.delete(o.valor);
			actualizarLabel();
			opts.onChange();
		});
	}

	btn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		setAbierto(!abierto);
	});
	actualizarLabel();
}

export interface ControlSelect {
	getValor: () => string;
	setValor: (v: string) => void;
	setOpciones: (ops: OpcionMulti[], valor?: string) => void;
	setDisabled: (d: boolean) => void;
}

/**
 * Desplegable propio de selección única que SIEMPRE abre hacia abajo (los
 * `<select>` nativos de macOS se alinean a la opción seleccionada y pueden
 * abrir hacia arriba). Opciones reconfigurables en caliente.
 */
export function crearSelect(opts: {
	parent: HTMLElement;
	opciones: OpcionMulti[];
	valor?: string;
	disabled?: boolean;
	onChange: (valor: string) => void;
}): ControlSelect {
	const wrap = opts.parent.createDiv({ cls: "gf-multiselect gf-select" });
	const btn = wrap.createEl("button", { cls: "gf-multiselect-btn" });
	// El panel se monta en <body> con posición fija para que ningún contenedor
	// con overflow (modales) lo recorte; se posiciona bajo el botón al abrir.
	const panel = createDiv({ cls: "gf-multiselect-panel gf-select-panel-float" });
	let opciones = opts.opciones;
	let valor = opts.valor ?? opciones[0]?.valor ?? "";
	let disabled = opts.disabled ?? false;

	let abierto = false;
	const onDocClick = (ev: MouseEvent) => {
		const t = ev.target as Node;
		if (!panel.contains(t) && t !== btn && !btn.contains(t)) cerrar();
	};
	const onKey = (ev: KeyboardEvent) => {
		if (ev.key === "Escape") cerrar();
	};
	// Cierra al hacer scroll FUERA del panel (reposiciona); el scroll interno
	// de la lista no debe cerrarlo.
	const onScroll = (ev: Event) => {
		if (!panel.contains(ev.target as Node)) cerrar();
	};
	function cerrar(): void {
		if (!abierto) return;
		abierto = false;
		panel.remove();
		document.removeEventListener("click", onDocClick, true);
		window.removeEventListener("scroll", onScroll, true);
		window.removeEventListener("resize", cerrar);
		document.removeEventListener("keydown", onKey, true);
	}
	function abrir(): void {
		if (abierto || disabled) return;
		document.body.appendChild(panel);
		const r = btn.getBoundingClientRect();
		panel.setCssStyles({
			top: `${r.bottom + 4}px`,
			left: `${r.left}px`,
			minWidth: `${r.width}px`,
			display: "block",
		});
		abierto = true;
		window.setTimeout(() => {
			document.addEventListener("click", onDocClick, true);
			window.addEventListener("scroll", onScroll, true);
			window.addEventListener("resize", cerrar);
			document.addEventListener("keydown", onKey, true);
		}, 0);
	}
	const setAbierto = (v: boolean) => {
		if (v && !disabled) abrir();
		else cerrar();
	};

	const textoDe = (v: string) => opciones.find((o) => o.valor === v)?.texto ?? "—";
	const pintarBtn = () => {
		btn.setText(`${textoDe(valor)} ▾`);
		btn.toggleClass("gf-select-disabled", disabled);
	};
	const pintarPanel = () => {
		panel.empty();
		for (const o of opciones) {
			const fila = panel.createEl("button", {
				cls: "gf-select-opcion" + (o.valor === valor ? " gf-select-opcion-on" : ""),
				text: o.texto,
			});
			fila.addEventListener("click", (e) => {
				e.preventDefault();
				e.stopPropagation();
				valor = o.valor;
				pintarBtn();
				pintarPanel();
				setAbierto(false);
				opts.onChange(valor);
			});
		}
	};

	btn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		if (!disabled) setAbierto(!abierto);
	});

	pintarBtn();
	pintarPanel();
	setAbierto(false);

	return {
		getValor: () => valor,
		setValor: (v) => {
			valor = v;
			pintarBtn();
			pintarPanel();
		},
		setOpciones: (ops, v) => {
			opciones = ops;
			if (v !== undefined) valor = v;
			else if (!opciones.some((o) => o.valor === valor)) valor = opciones[0]?.valor ?? "";
			pintarBtn();
			pintarPanel();
		},
		setDisabled: (d) => {
			disabled = d;
			if (d) setAbierto(false);
			pintarBtn();
		},
	};
}

/** Modal tipo calendario, pero solo de años: cuadrícula de 12 con navegación. */
export class AnioPickerModal extends Modal {
	private anio: number;
	private onPick: (anio: number) => void;
	private base: number;

	constructor(app: App, anio: number, onPick: (anio: number) => void) {
		super(app);
		this.anio = anio;
		this.onPick = onPick;
		this.base = anio - (anio % 12);
	}

	onOpen(): void {
		this.titleEl.setText("Seleccionar año");
		this.render();
	}

	private render(): void {
		this.contentEl.empty();
		const nav = this.contentEl.createDiv({ cls: "gf-anio-nav" });
		const prev = nav.createEl("button", { text: "‹" });
		nav.createEl("span", { text: `${this.base} – ${this.base + 11}`, cls: "gf-anio-rango" });
		const next = nav.createEl("button", { text: "›" });
		prev.addEventListener("click", () => {
			this.base -= 12;
			this.render();
		});
		next.addEventListener("click", () => {
			this.base += 12;
			this.render();
		});

		const grid = this.contentEl.createDiv({ cls: "gf-anio-grid" });
		for (let i = 0; i < 12; i++) {
			const y = this.base + i;
			const b = grid.createEl("button", {
				text: String(y),
				cls: "gf-anio-celda" + (y === this.anio ? " gf-anio-on" : ""),
			});
			b.addEventListener("click", () => {
				this.onPick(y);
				this.close();
			});
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
