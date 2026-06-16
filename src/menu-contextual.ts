import { Editor, FileSystemAdapter, MarkdownView, Menu, Modal, Notice, TFile, setIcon } from "obsidian";
import type GestorFuncionesPlugin from "./main";
import {
	CARPETA_ACTIVAS,
	CARPETA_INACTIVAS,
	eliminarFuncionalidad,
	eliminarIncidencia,
	funcRefDesdeCarpeta,
	renombrarFuncionalidad,
	renombrarIncidencia,
} from "./files";
import { AgregarLinkModal, ConfirmacionModal } from "./modals";
import { ICONO_PLUGIN } from "./icono";

/** ¿El .md está dentro del árbol de épicas (activas o archivadas)? */
function enGestion(file: TFile): boolean {
	if (file.extension !== "md") return false;
	const p = file.path;
	return p.startsWith(CARPETA_ACTIVAS + "/") || p.startsWith(CARPETA_INACTIVAS + "/");
}

function nombreActual(plugin: GestorFuncionesPlugin, file: TFile): string {
	const fm = plugin.app.metadataCache.getFileCache(file)?.frontmatter as
		| Record<string, unknown>
		| undefined;
	return fm?.nombre ? String(fm.nombre) : file.basename;
}

/** ¿Es la nota principal de su carpeta (una épica o historia)? */
function esPrincipal(plugin: GestorFuncionesPlugin, file: TFile): boolean {
	const parent = file.parent;
	return (
		!!parent && file.basename === parent.name && funcRefDesdeCarpeta(plugin.app, parent.path) !== null
	);
}

async function aplicarRenombrar(
	plugin: GestorFuncionesPlugin,
	file: TFile,
	nuevoNombre: string
): Promise<void> {
	const app = plugin.app;
	const parent = file.parent;
	if (parent && file.basename === parent.name) {
		const ref = funcRefDesdeCarpeta(app, parent.path);
		if (ref) {
			await renombrarFuncionalidad(app, ref, nuevoNombre);
			return;
		}
	}
	await renombrarIncidencia(app, file, nuevoNombre);
}

async function aplicarEliminar(plugin: GestorFuncionesPlugin, file: TFile): Promise<void> {
	const app = plugin.app;
	const parent = file.parent;
	if (parent && file.basename === parent.name) {
		const ref = funcRefDesdeCarpeta(app, parent.path);
		if (ref) {
			await eliminarFuncionalidad(app, ref);
			return;
		}
	}
	const cont = parent?.parent;
	const origen = cont ? funcRefDesdeCarpeta(app, cont.path) : null;
	if (origen) await eliminarIncidencia(app, file, origen);
	else await app.fileManager.trashFile(file);
}

function rutaSistema(plugin: GestorFuncionesPlugin, file: TFile): string {
	const adapter = plugin.app.vault.adapter;
	return adapter instanceof FileSystemAdapter ? adapter.getFullPath(file.path) : file.path;
}

async function copiar(texto: string, etiqueta: string): Promise<void> {
	try {
		await navigator.clipboard.writeText(texto);
		new Notice(`Gestión de épicas: ${etiqueta} copiada.`);
	} catch (e) {
		console.error(e);
		new Notice("Gestión de épicas: no se pudo copiar al portapapeles.");
	}
}

/** Construye el menú "Gestión de épicas" (plano) para una nota. */
function construirMenu(
	menu: Menu,
	plugin: GestorFuncionesPlugin,
	file: TFile,
	editor?: Editor
): void {
	// "Agregar link" va al inicio (solo cuando hay editor).
	if (editor) {
		menu.addItem((i) =>
			i
				.setTitle("Agregar link")
				.setIcon("link")
				.onClick(() => new AgregarLinkModal(plugin, editor).open())
		);
		menu.addSeparator();
	}
	menu.addItem((i) =>
		i
			.setTitle("Renombrar")
			.setIcon("pencil")
			.onClick(() => {
				const actual = nombreActual(plugin, file);
				new RenombrarModal(plugin, actual, (nuevo) => {
					// Renombrar pide confirmación antes de aplicar.
					new ConfirmacionModal(
						plugin,
						"Renombrar",
						`¿Renombrar "${actual}" a "${nuevo}"?`,
						"Renombrar",
						() => void aplicarRenombrar(plugin, file, nuevo)
					).open();
				}).open();
			})
	);
	menu.addItem((i) =>
		i
			.setTitle("Eliminar")
			.setIcon("trash-2")
			.onClick(() => {
				const nombre = nombreActual(plugin, file);
				const mensaje = esPrincipal(plugin, file)
					? `¿Eliminar "${nombre}" y TODO su contenido? Se enviará a la papelera.`
					: `¿Eliminar "${nombre}"? Se enviará a la papelera.`;
				new ConfirmacionModal(plugin, "Eliminar", mensaje, "Eliminar", () =>
					void aplicarEliminar(plugin, file)
				).open();
			})
	);
	menu.addSeparator();
	menu.addItem((i) =>
		i
			.setTitle("Copiar ruta (bóveda)")
			.setIcon("copy")
			.onClick(() => void copiar(file.path, "Ruta de la bóveda"))
	);
	menu.addItem((i) =>
		i
			.setTitle("Copiar ruta (sistema)")
			.setIcon("copy")
			.onClick(() => void copiar(rutaSistema(plugin, file), "Ruta del sistema"))
	);
}

/** Abre el menú "Gestión de épicas" (sin "Agregar link") en el evento dado.
 * Para usar en el clic derecho de las tarjetas de los tableros. */
export function menuNotaEnEvento(
	plugin: GestorFuncionesPlugin,
	file: TFile,
	evt: MouseEvent
): void {
	const menu = new Menu();
	construirMenu(menu, plugin, file);
	menu.showAtMouseEvent(evt);
}

/**
 * Botón flotante "Gestión de épicas" sobre la nota activa (si está dentro del
 * árbol de épicas). Al pulsarlo abre el menú con Renombrar, Eliminar, Copiar
 * ruta y Agregar link.
 */
export function registrarBotonFlotante(plugin: GestorFuncionesPlugin): void {
	const app = plugin.app;
	let boton: HTMLElement | null = null;

	const quitar = () => {
		boton?.remove();
		boton = null;
	};

	const actualizar = () => {
		quitar();
		const view = app.workspace.getActiveViewOfType(MarkdownView);
		const file = view?.file;
		if (!view || !file || !enGestion(file)) return;
		boton = view.containerEl.createEl("button", { cls: "gf-fab" });
		setIcon(boton, ICONO_PLUGIN);
		boton.setAttr("aria-label", "Gestión de épicas");
		boton.addEventListener("click", (e) => {
			const menu = new Menu();
			construirMenu(menu, plugin, file, view.editor);
			menu.showAtMouseEvent(e);
		});
	};

	plugin.registerEvent(app.workspace.on("file-open", () => actualizar()));
	plugin.registerEvent(app.workspace.on("active-leaf-change", () => actualizar()));
	app.workspace.onLayoutReady(() => actualizar());
	plugin.register(() => quitar());
}

/** Modal de una línea para capturar el nuevo nombre. */
class RenombrarModal extends Modal {
	constructor(
		plugin: GestorFuncionesPlugin,
		private valor: string,
		private onGuardar: (nombre: string) => void
	) {
		super(plugin.app);
	}

	onOpen(): void {
		this.titleEl.setText("Renombrar");
		const input = this.contentEl.createEl("input", {
			type: "text",
			cls: "gf-orgdocs-nombre-input",
			value: this.valor,
		});
		input.placeholder = "Nuevo nombre";
		const guardar = () => {
			const nombre = input.value.trim();
			if (!nombre) return;
			this.onGuardar(nombre);
			this.close();
		};
		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				guardar();
			}
		});
		const row = this.contentEl.createDiv({ cls: "gf-botones" });
		row.createEl("button", { text: "Cancelar" }).addEventListener("click", () => this.close());
		const ok = row.createEl("button", { text: "Guardar", cls: "mod-cta" });
		ok.addEventListener("click", guardar);
		window.setTimeout(() => input.focus(), 0);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
