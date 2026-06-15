/** Paleta cerrada de colores con nombre para etiquetas y colaboradores. */
export const ETIQUETA_COLORES: Array<{ nombre: string; color: string }> = [
	{ nombre: "Amarillo", color: "#FFC93C" },
	{ nombre: "Rojo", color: "#FA4D56" },
	{ nombre: "Azul", color: "#2D9CFF" },
	{ nombre: "Verde", color: "#2BC275" },
	{ nombre: "Naranja", color: "#FF9F2E" },
	{ nombre: "Morado", color: "#C950E8" },
	{ nombre: "Gris", color: "#B9BEC6" },
];

/** Color aleatorio de la paleta. */
export function colorAleatorio(): string {
	return ETIQUETA_COLORES[Math.floor(Math.random() * ETIQUETA_COLORES.length)].color;
}

/** Nombre legible de un color de la paleta (o el hex si no pertenece). */
export function nombreColor(color: string): string {
	return ETIQUETA_COLORES.find((c) => c.color.toLowerCase() === color.toLowerCase())?.nombre ?? color;
}

/** Devuelve `hex` oscurecido multiplicando sus canales por `factor` (0–1). */
export function oscurecer(hex: string, factor = 0.45): string {
	const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
	if (!m) return hex;
	const ch = (h: string) => {
		const v = Math.max(0, Math.min(255, Math.round(parseInt(h, 16) * factor)));
		return v.toString(16).padStart(2, "0");
	};
	return `#${ch(m[1])}${ch(m[2])}${ch(m[3])}`;
}

/**
 * Dibuja el chip estándar de una etiqueta: relleno con su color, texto del
 * mismo color pero más oscuro y, si se pasa `num`, el número de colaboradores
 * con 👤.
 */
export function renderChipEtiqueta(
	parent: HTMLElement,
	nombre: string,
	color: string,
	num?: number
): HTMLElement {
	const chip = parent.createSpan({ cls: "gf-etq-chip", text: nombre });
	chip.setCssStyles({ backgroundColor: color, color: oscurecer(color) });
	if (num && num > 0) {
		chip.createSpan({ cls: "gf-etq-chip-num", text: `👤 ${num}` });
	}
	return chip;
}

export interface SelectorColor {
	getColor: () => string;
	setColor: (c: string) => void;
}

/**
 * Selector de color limitado a la paleta: un botón con el círculo del color
 * actual + caret que abre un desplegable con los colores con nombre. `onChange`
 * se dispara al elegir.
 */
export function renderSelectorColor(
	parent: HTMLElement,
	inicial = colorAleatorio(),
	onChange?: (color: string) => void,
	/** Se dispara al pulsar el botón (antes de abrir/cerrar el desplegable). */
	onInteract?: () => void
): SelectorColor {
	let valor = inicial;
	const wrap = parent.createDiv({ cls: "gf-color-selector gf-multiselect" });
	const btn = wrap.createEl("button", { cls: "gf-color-pill gf-multiselect-btn" });
	const dot = btn.createDiv({ cls: "gf-color-dot" });
	btn.createSpan({ cls: "gf-color-caret", text: "▼" });

	// El desplegable se monta en <body> con posición fija para que ningún
	// contenedor con overflow (modales, tablas) lo recorte.
	const panel = createDiv({ cls: "gf-multiselect-panel gf-color-panel gf-color-panel-float" });

	const pintar = () => {
		dot.setCssStyles({ backgroundColor: valor });
		for (const f of Array.from(panel.children)) {
			f.toggleClass("gf-color-opcion-on", (f as HTMLElement).dataset.color === valor);
		}
	};

	for (const c of ETIQUETA_COLORES) {
		const fila = panel.createEl("button", { cls: "gf-color-opcion" });
		fila.dataset.color = c.color;
		const d = fila.createDiv({ cls: "gf-color-dot" });
		d.setCssStyles({ backgroundColor: c.color });
		fila.createSpan({ text: c.nombre });
		fila.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			valor = c.color;
			pintar();
			cerrar();
			onChange?.(valor);
		});
	}

	let abierto = false;
	const onDocClick = (ev: MouseEvent) => {
		const t = ev.target as Node;
		if (!panel.contains(t) && t !== btn && !btn.contains(t)) cerrar();
	};
	const onKey = (ev: KeyboardEvent) => {
		if (ev.key === "Escape") cerrar();
	};
	function cerrar() {
		if (!abierto) return;
		abierto = false;
		panel.remove();
		document.removeEventListener("click", onDocClick, true);
		window.removeEventListener("scroll", cerrar, true);
		window.removeEventListener("resize", cerrar);
		document.removeEventListener("keydown", onKey, true);
	}
	const abrir = () => {
		if (abierto) return;
		document.body.appendChild(panel);
		const r = btn.getBoundingClientRect();
		panel.setCssStyles({ top: `${r.bottom + 4}px`, left: `${r.left}px`, display: "block" });
		abierto = true;
		// Diferido para no capturar el mismo clic que abre.
		window.setTimeout(() => {
			document.addEventListener("click", onDocClick, true);
			window.addEventListener("scroll", cerrar, true);
			window.addEventListener("resize", cerrar);
			document.addEventListener("keydown", onKey, true);
		}, 0);
	};

	btn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		onInteract?.();
		if (abierto) cerrar();
		else abrir();
	});
	pintar();

	return {
		getColor: () => valor,
		setColor: (c) => {
			valor = c;
			pintar();
		},
	};
}
