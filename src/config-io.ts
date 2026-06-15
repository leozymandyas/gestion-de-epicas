import { Modal, Notice } from "obsidian";
import type GestorFuncionesPlugin from "./main";
import {
	COLOR_ETIQUETA_DEFECTO,
	Carril,
	Etiqueta,
	GestorSettings,
} from "./settings";
import { slugify } from "./utils";

/** Marca del archivo de configuración exportado. */
const MARCA = "gestor-funciones-config";

/**
 * Una categoría exportable/importable. `leerArchivo` devuelve el valor saneado
 * listo para importar, o null si el archivo no trae datos válidos para ella.
 */
interface Categoria {
	clave: string;
	etiqueta: string;
	exportar: (s: GestorSettings) => unknown;
	leerArchivo: (valor: unknown) => unknown;
	aplicar: (s: GestorSettings, valor: unknown) => void;
}

function sanearEtiquetas(valor: unknown): Etiqueta[] | null {
	if (!Array.isArray(valor)) return null;
	const out: Etiqueta[] = [];
	for (const e of valor) {
		if (!e || typeof e !== "object") continue;
		const o = e as Record<string, unknown>;
		const nombre = String(o.nombre ?? "").trim();
		if (!nombre) continue;
		out.push({
			nombre,
			color: String(o.color ?? "") || COLOR_ETIQUETA_DEFECTO,
			visible: o.visible === undefined ? true : Boolean(o.visible),
		});
	}
	return out.length > 0 ? out : null;
}

function sanearCarriles(valor: unknown): Carril[] | null {
	if (!Array.isArray(valor)) return null;
	const out: Carril[] = [];
	const valores = new Set<string>();
	for (const e of valor) {
		if (!e || typeof e !== "object") continue;
		const o = e as Record<string, unknown>;
		const nombre = String(o.nombre ?? "").trim();
		if (!nombre) continue;
		let val = String(o.valor ?? "").trim() || slugify(nombre);
		if (!val) continue;
		while (valores.has(val)) val = `${val}-2`;
		valores.add(val);
		out.push({
			nombre,
			valor: val,
			color: String(o.color ?? "") || COLOR_ETIQUETA_DEFECTO,
			visible: o.visible === undefined ? true : Boolean(o.visible),
		});
	}
	return out.length > 0 ? out : null;
}


export const CATEGORIAS: Categoria[] = [
	{
		clave: "numSprints",
		etiqueta: "Número de sprints",
		exportar: (s) => s.numSprints,
		leerArchivo: (v) => {
			const n = Math.trunc(Number(v));
			return Number.isFinite(n) && n >= 1 ? n : null;
		},
		aplicar: (s, v) => {
			s.numSprints = v as number;
			if (s.kanban.filtroSprints.hasta > s.numSprints) s.kanban.filtroSprints.hasta = s.numSprints;
			if (s.kanban.filtroSprints.desde > s.numSprints) s.kanban.filtroSprints.desde = s.numSprints;
		},
	},
	{
		clave: "colaboradores",
		etiqueta: "Colaboradores",
		exportar: (s) => s.colaboradores,
		leerArchivo: (v) => sanearEtiquetas(v),
		aplicar: (s, v) => {
			s.colaboradores = v as Etiqueta[];
		},
	},
	{
		clave: "incidencias",
		etiqueta: "Tipos de incidencia",
		exportar: (s) => s.incidencias,
		leerArchivo: (v) => sanearEtiquetas(v),
		aplicar: (s, v) => {
			s.incidencias = v as Etiqueta[];
		},
	},
	{
		clave: "etiquetas",
		etiqueta: "Etiquetas de sprint",
		exportar: (s) => s.etiquetas,
		leerArchivo: (v) => sanearEtiquetas(v),
		aplicar: (s, v) => {
			s.etiquetas = v as Etiqueta[];
		},
	},
	{
		clave: "carriles",
		etiqueta: "Carriles del kanban",
		exportar: (s) => s.carriles,
		leerArchivo: (v) => sanearCarriles(v),
		aplicar: (s, v) => {
			s.carriles = v as Carril[];
		},
	},
];

function descargarJson(nombre: string, contenido: string): void {
	const blob = new Blob([contenido], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const a = activeDocument.createElement("a");
	a.href = url;
	a.download = nombre;
	activeDocument.body.appendChild(a);
	a.click();
	a.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Modal de exportación: elegir categorías y descargar el .json. */
export class ExportarConfigModal extends Modal {
	private plugin: GestorFuncionesPlugin;
	private seleccion = new Set<string>();

	constructor(plugin: GestorFuncionesPlugin) {
		super(plugin.app);
		this.plugin = plugin;
	}

	onOpen(): void {
		this.titleEl.setText("Exportar configuración");
		const s = this.plugin.settings;
		this.contentEl.createEl("p", {
			cls: "gf-campo-aviso",
			text: "Marca lo que quieras incluir en el archivo.",
		});

		for (const cat of CATEGORIAS) {
			const tieneDatos = this.tieneDatos(cat.exportar(s));
			if (tieneDatos) this.seleccion.add(cat.clave);
			const fila = this.contentEl.createEl("label", { cls: "gf-chk" });
			const chk = fila.createEl("input", { type: "checkbox" });
			chk.checked = tieneDatos;
			fila.appendText(` ${cat.etiqueta}${tieneDatos ? "" : " (vacío)"}`);
			chk.addEventListener("change", () => {
				if (chk.checked) this.seleccion.add(cat.clave);
				else this.seleccion.delete(cat.clave);
			});
		}

		const row = this.contentEl.createDiv({ cls: "gf-botones" });
		const cancelar = row.createEl("button", { text: "Cancelar" });
		cancelar.addEventListener("click", () => this.close());
		const descargar = row.createEl("button", { text: "Descargar", cls: "mod-cta" });
		descargar.addEventListener("click", () => {
			const datos: Record<string, unknown> = { [MARCA]: 1 };
			for (const cat of CATEGORIAS) {
				if (this.seleccion.has(cat.clave)) datos[cat.clave] = cat.exportar(s);
			}
			descargarJson("gestor-producto-config.json", JSON.stringify(datos, null, 2));
			new Notice("Gestión de épicas: configuración exportada.");
			this.close();
		});
	}

	private tieneDatos(valor: unknown): boolean {
		if (Array.isArray(valor)) return valor.length > 0;
		return valor !== undefined && valor !== null;
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/** Modal de importación: cargar archivo y elegir qué aplicar. */
export class ImportarConfigModal extends Modal {
	private plugin: GestorFuncionesPlugin;
	private onImportar: () => void;
	private datos: Record<string, unknown> | null = null;
	private seleccion = new Set<string>();

	constructor(plugin: GestorFuncionesPlugin, onImportar: () => void) {
		super(plugin.app);
		this.plugin = plugin;
		this.onImportar = onImportar;
	}

	onOpen(): void {
		this.titleEl.setText("Importar configuración");
		this.render();
	}

	private render(): void {
		this.contentEl.empty();

		const fileInput = this.contentEl.createEl("input", { type: "file", attr: { accept: ".json,application/json" } });
		fileInput.addEventListener("change", () => {
			const file = fileInput.files?.[0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = () => {
				try {
					const parsed = JSON.parse(String(reader.result)) as Record<string, unknown>;
					if (!parsed || typeof parsed !== "object" || !(MARCA in parsed)) {
						new Notice("Gestión de épicas: el archivo no es una configuración válida.");
						return;
					}
					this.datos = parsed;
					this.seleccion.clear();
					this.render();
				} catch {
					new Notice("Gestión de épicas: no se pudo leer el archivo (JSON inválido).");
				}
			};
			reader.readAsText(file);
		});

		if (!this.datos) {
			this.contentEl.createEl("p", {
				cls: "gf-campo-aviso",
				text: "Elige un archivo .json exportado desde este plugin.",
			});
			return;
		}

		this.contentEl.createEl("p", {
			cls: "gf-campo-aviso",
			text: "Marca lo que quieras importar. Lo no disponible en el archivo aparece deshabilitado.",
		});

		for (const cat of CATEGORIAS) {
			const valor = cat.leerArchivo(this.datos[cat.clave]);
			const disponible = valor !== null && cat.clave in this.datos;
			if (disponible) this.seleccion.add(cat.clave);
			const fila = this.contentEl.createEl("label", { cls: "gf-chk" });
			const chk = fila.createEl("input", { type: "checkbox" });
			chk.checked = disponible;
			chk.disabled = !disponible;
			fila.appendText(` ${cat.etiqueta}${disponible ? "" : " (no disponible)"}`);
			chk.addEventListener("change", () => {
				if (chk.checked) this.seleccion.add(cat.clave);
				else this.seleccion.delete(cat.clave);
			});
		}

		const row = this.contentEl.createDiv({ cls: "gf-botones" });
		const cancelar = row.createEl("button", { text: "Cancelar" });
		cancelar.addEventListener("click", () => this.close());
		const importar = row.createEl("button", { text: "Importar", cls: "mod-cta" });
		importar.addEventListener("click", () => void this.importar());
	}

	private async importar(): Promise<void> {
		if (!this.datos) return;
		const s = this.plugin.settings;
		let aplicadas = 0;
		for (const cat of CATEGORIAS) {
			if (!this.seleccion.has(cat.clave)) continue;
			const valor = cat.leerArchivo(this.datos[cat.clave]);
			if (valor === null) continue;
			cat.aplicar(s, valor);
			aplicadas++;
		}
		await this.plugin.saveSettings();
		new Notice(`Gestión de épicas: ${aplicadas} elemento(s) importado(s).`);
		this.onImportar();
		this.close();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
