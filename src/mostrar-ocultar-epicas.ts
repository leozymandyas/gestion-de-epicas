import { Modal } from "obsidian";
import type GestorFuncionesPlugin from "./main";
import { FuncRef, listFuncionalidades } from "./files";

/**
 * Modal para marcar épicas como visibles u ocultas. Mismo aspecto que el gestor
 * de etiquetas/colaboradores: una tabla con scroll y un checkbox de visibilidad
 * por fila. Las épicas ocultas se omiten de los tableros y de los selects de
 * creación de documentos e incidencias; siguen disponibles en los flujos de
 * mover y en la gestión de épicas (archivar, eliminar, renombrar).
 */
export class MostrarOcultarEpicasModal extends Modal {
	private plugin: GestorFuncionesPlugin;

	constructor(plugin: GestorFuncionesPlugin) {
		super(plugin.app);
		this.plugin = plugin;
	}

	onOpen(): void {
		this.titleEl.setText("Mostrar/Ocultar épicas");
		this.modalEl.addClass("gf-modal-etiquetas");
		this.render();
	}

	/** Slug de cada épica oculta (el orden no importa). */
	private get ocultas(): Set<string> {
		return new Set(this.plugin.settings.epicasOcultas);
	}

	private render(): void {
		this.contentEl.empty();

		this.contentEl.createEl("p", {
			cls: "gf-campo-aviso",
			text:
				"Las épicas sin marcar se ocultan de los tableros y de los selects al crear " +
				"documentos e incidencias. Se siguen viendo al mover y al gestionar épicas.",
		});

		const epicas = listFuncionalidades(this.app, this.plugin.settings.carpetaAdmin);
		const scroll = this.contentEl.createDiv({ cls: "gf-etq-scroll" });
		if (epicas.length === 0) {
			scroll.createEl("em", { cls: "gf-campo-aviso", text: "No hay épicas." });
			return;
		}
		const tbody = scroll.createEl("table", { cls: "gf-etq-tabla" }).createEl("tbody");
		for (const ep of epicas) this.renderFila(tbody, ep);
	}

	private renderFila(tbody: HTMLElement, ep: FuncRef): void {
		const tr = tbody.createEl("tr", { cls: "gf-etq-fila" });
		const tdNombre = tr.createEl("td", { cls: "gf-etq-nombre-td" });
		tdNombre.createEl("span", { cls: "gf-etq-nombre", text: ep.nombre });

		const tdVis = tr.createEl("td", { cls: "gf-etq-visible-td" });
		const chk = tdVis.createEl("input", { type: "checkbox" });
		chk.checked = !this.ocultas.has(ep.slug);
		chk.setAttr("title", "Visible en tableros y selects de creación");
		chk.addEventListener("change", () => void this.cambiar(ep.slug, chk.checked));
	}

	/** Marca la épica como visible u oculta y refresca los tableros abiertos. */
	private async cambiar(slug: string, visible: boolean): Promise<void> {
		const set = this.ocultas;
		if (visible) set.delete(slug);
		else set.add(slug);
		this.plugin.settings.epicasOcultas = [...set];
		await this.plugin.saveSettings();
		this.plugin.refrescarTablerosEpicas();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
