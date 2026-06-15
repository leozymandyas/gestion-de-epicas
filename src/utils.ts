/**
 * Convierte un texto libre en un slug apto para nombre de archivo/carpeta:
 * minúsculas, espacios → guiones, sin acentos ni caracteres especiales.
 * "Mi funcionalidad principal" → "mi-funcionalidad-principal"
 * "Diseñar pantalla de login" → "disenar-pantalla-de-login"
 */
export function slugify(input: string): string {
	return input
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

/** Fecha local de hoy en formato YYYY-MM-DD. */
export function hoy(): string {
	const d = new Date();
	const mes = String(d.getMonth() + 1).padStart(2, "0");
	const dia = String(d.getDate()).padStart(2, "0");
	return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Escapa un valor para usarlo entre comillas dobles en YAML. */
export function escapeYaml(valor: string): string {
	return valor.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
