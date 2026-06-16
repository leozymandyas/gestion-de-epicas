import { ItemView, TAbstractFile, WorkspaceLeaf, normalizePath } from "obsidian";
import type GestorFuncionesPlugin from "./main";
import {
	FuncRef,
	carpetasGestionListas,
	getAsignados,
	leerEtiquetasEpica,
	leerEtiquetasHistoria,
	listFuncionalidades,
	listFuncionalidadesDe,
	moverHistoriaAEpica,
} from "./files";
import { colorDesdeNombre, renderChipEtiqueta } from "./colores";
import { ConfirmacionModal } from "./modals";
import { menuNotaEnEvento } from "./menu-contextual";
import { normalizarEstado } from "./settings";

export const VIEW_TYPE_HISTORIAS = "gestor-funciones-historias";

interface GrupoEpica {
	epica: FuncRef;
	historias: FuncRef[];
}

/**
 * Vista "Historias": una tarjeta por épica con sus historias. Arrastrar una
 * historia a otra épica la mueve (con su contenido), tras confirmar. Sustituye
 * al antiguo modal "Mover historia".
 */
export class HistoriasView extends ItemView {
	private plugin: GestorFuncionesPlugin;
	private renderTimer: number | null = null;
	private grupos: GrupoEpica[] = [];
	/** Historia en arrastre: ruta de su nota y slug de su épica de origen. */
	private arrastre: { ref: FuncRef; origenSlug: string } | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: GestorFuncionesPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_HISTORIAS;
	}

	getDisplayText(): string {
		return "Historias por épica — Gestión de épicas";
	}

	getIcon(): string {
		return "folder-tree";
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
		const epicas = admin ? listFuncionalidades(this.app, admin) : [];
		this.grupos = epicas.map((epica) => ({
			epica,
			historias: listFuncionalidadesDe(this.app, epica.folder),
		}));
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
		const recargar = barra.createEl("button", { text: "Recargar", cls: "gf-roadmap-recargar" });
		recargar.addEventListener("click", () => this.recargar());

		if (this.grupos.length === 0) {
			cont.createDiv({ cls: "gf-kanban-vacio", text: "No hay épicas." });
			return;
		}

		const cuerpo = cont.createDiv();
		for (const grupo of this.grupos) this.renderGrupo(cuerpo, grupo);
	}

	private renderGrupo(cuerpo: HTMLElement, grupo: GrupoEpica): void {
		const tarjeta = cuerpo.createDiv({ cls: "gf-colab-card" });

		// La tarjeta de épica es zona de soltado: mover la historia arrastrada aquí.
		tarjeta.addEventListener("dragover", (e) => {
			if (!this.arrastre || this.arrastre.origenSlug === grupo.epica.slug) return;
			e.preventDefault();
			tarjeta.addClass("gf-drop-card");
		});
		tarjeta.addEventListener("dragleave", () => tarjeta.removeClass("gf-drop-card"));
		tarjeta.addEventListener("drop", (e) => {
			if (!this.arrastre || this.arrastre.origenSlug === grupo.epica.slug) return;
			e.preventDefault();
			tarjeta.removeClass("gf-drop-card");
			this.confirmarMover(this.arrastre.ref, grupo.epica);
		});

		const head = tarjeta.createDiv({ cls: "gf-colab-head" });
		// El título de la épica abre su nota principal.
		const titulo = head.createEl("a", { text: grupo.epica.nombre, cls: "gf-colab-nombre internal-link" });
		titulo.addEventListener("click", (e) => {
			e.preventDefault();
			void this.plugin.mostrarNota(grupo.epica.file);
		});
		titulo.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			menuNotaEnEvento(this.plugin, grupo.epica.file, e);
		});
		// Colaboradores asignados a la épica, junto al nombre.
		const colabs = getAsignados(this.app, grupo.epica.file).filter((n) =>
			this.plugin.settings.colaboradores.some((c) => c.nombre === n && c.visible !== false)
		);
		for (const c of colabs) {
			renderChipEtiqueta(head, c, this.colorColab(c));
		}
		head.createEl("span", { cls: "gf-colab-conteo", text: String(grupo.historias.length) });

		if (grupo.historias.length === 0) {
			tarjeta.createEl("em", { cls: "gf-kanban-vacio", text: "Sin historias." });
			return;
		}
		// Mapa de colores de las etiquetas de esta épica.
		const colorEtq = new Map(leerEtiquetasEpica(this.app, grupo.epica).map((e) => [e.nombre, e.color]));
		const ul = tarjeta.createEl("ul", { cls: "gf-colab-lista" });
		for (const hist of grupo.historias) {
			const completado = normalizarEstado(hist.estado ?? "") === "completado";
			const li = ul.createEl("li", { cls: "gf-arrastrable" + (completado ? " gf-colab-hecha" : "") });
			li.addEventListener("contextmenu", (e) => {
				e.preventDefault();
				menuNotaEnEvento(this.plugin, hist.file, e);
			});
			li.draggable = true;
			li.addEventListener("dragstart", () => {
				this.arrastre = { ref: hist, origenSlug: grupo.epica.slug };
			});
			li.addEventListener("dragend", () => {
				this.arrastre = null;
			});
			// Check para marcar la historia como completada (estado en el md).
			const chk = li.createEl("input", { type: "checkbox", cls: "gf-colab-chk" });
			chk.checked = completado;
			chk.addEventListener("change", () => {
				const quiere = chk.checked;
				chk.checked = !quiere; // se revierte hasta confirmar
				this.confirmarEstado(hist, quiere);
			});
			// Chip "Historia" (color por carril) + etiquetas, antes del nombre.
			renderChipEtiqueta(li, "Historia", colorDesdeNombre(grupo.epica.slug));
			for (const etq of leerEtiquetasHistoria(this.app, hist.file)) {
				renderChipEtiqueta(li, etq, colorEtq.get(etq) ?? "#B9BEC6");
			}
			const a = li.createEl("a", { cls: "internal-link", text: hist.nombre });
			a.addEventListener("click", (e) => {
				e.preventDefault();
				void this.plugin.mostrarNota(hist.file);
			});
		}
	}

	/** Pide confirmación y marca la historia como completada / por hacer. */
	private confirmarEstado(hist: FuncRef, completar: boolean): void {
		const [titulo, mensaje, ok] = completar
			? ["Marcar como hecha", "¿Marcar esta historia como hecha? Su estado pasará a completado.", "Marcar como hecha"]
			: ["Marcar como pendiente", "¿Quitar el estado de completado de esta historia? Volverá a Por hacer.", "Marcar como pendiente"];
		new ConfirmacionModal(this.plugin, titulo, mensaje, ok, async () => {
			const estado = completar ? "completado" : "por-hacer";
			await this.app.fileManager.processFrontMatter(hist.file, (fm: Record<string, unknown>) => {
				fm.estado = estado;
			});
			hist.estado = estado;
			this.render();
		}).open();
	}

	private colorColab(nombre: string): string {
		return this.plugin.settings.colaboradores.find((c) => c.nombre === nombre)?.color ?? "#B9BEC6";
	}

	private confirmarMover(historia: FuncRef, destino: FuncRef): void {
		new ConfirmacionModal(
			this.plugin,
			"Mover historia",
			`¿Mover la historia "${historia.nombre}" a la épica "${destino.nombre}"? Se moverá con todo su contenido (incidencias, documentos y notas).`,
			"Mover",
			async () => {
				try {
					await moverHistoriaAEpica(this.app, historia, destino);
					this.recargar();
				} catch (e) {
					console.error(e);
				}
			}
		).open();
	}
}
