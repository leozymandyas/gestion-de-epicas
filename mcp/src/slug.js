// Utilidades replicadas de src/utils.ts del plugin, para que el MCP genere
// slugs, fechas y YAML idénticos a los del plugin.

const COMBINANTES = new RegExp("[\\u0300-\\u036f]", "g");

/** Convierte texto libre en un slug (minúsculas, sin acentos, guiones). */
export function slugify(input) {
	return String(input)
		.normalize("NFD")
		.replace(COMBINANTES, "")
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

/** Fecha local de hoy en formato YYYY-MM-DD. */
export function hoy() {
	const d = new Date();
	const mes = String(d.getMonth() + 1).padStart(2, "0");
	const dia = String(d.getDate()).padStart(2, "0");
	return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Escapa un valor para usarlo entre comillas dobles en YAML. */
export function escapeYaml(valor) {
	return String(valor).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
