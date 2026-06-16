var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => GestorFuncionesPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian16 = require("obsidian");

// src/settings.ts
var import_obsidian4 = require("obsidian");

// src/files.ts
var import_obsidian = require("obsidian");

// src/utils.ts
function slugify(input) {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
function hoy() {
  const d = /* @__PURE__ */ new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}
function escapeYaml(valor) {
  return valor.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// src/templates.ts
function funcionalidad(nombre, fecha) {
  return `---
tipo: epica
nombre: "${escapeYaml(nombre)}"
fecha-creacion: ${fecha}
---

${cuerpoSecciones(nombre)}`;
}
function funcionalidadNueva(nombre, epicaSlug, fecha) {
  return `---
tipo: historia
epica: "[[${epicaSlug}]]"
nombre: "${escapeYaml(nombre)}"
estado: backlog
fecha-creacion: ${fecha}
---

${cuerpoSecciones(nombre)}`;
}
function cuerpoSecciones(nombre) {
  return `# ${nombre}

## Descripci\xF3n
<!-- Escribe aqu\xED la descripci\xF3n -->

## Links relacionados
<!-- Pega aqu\xED los links del proyecto, tickets, documentos, etc. -->

## Tareas
<!-- Las tareas aparecen aqu\xED autom\xE1ticamente cuando las creas desde el plugin -->

## Pendientes
<!-- Los pendientes aparecen aqu\xED autom\xE1ticamente cuando los creas desde el plugin -->
`;
}
function tarea(nombre, funcSlug, fecha) {
  return `---
tipo: tarea
historia: "[[${funcSlug}]]"
nombre: "${escapeYaml(nombre)}"
estado: por-hacer
fecha-creacion: ${fecha}
---

# ${nombre}

## Descripci\xF3n
<!-- Escribe aqu\xED los detalles de la tarea -->

## Notas
<!-- Notas relacionadas a esta tarea -->
`;
}
function incidencia(nombre, funcSlug, fecha, tipoSlug, descripcion = "") {
  const desc = descripcion.trim() || "<!-- Escribe aqu\xED los detalles de la incidencia -->";
  return `---
tipo: ${tipoSlug}
historia: "[[${funcSlug}]]"
nombre: "${escapeYaml(nombre)}"
estado: por-hacer
fecha-creacion: ${fecha}
---

# ${nombre}

## Descripci\xF3n
${desc}

## Notas
<!-- Notas relacionadas a esta incidencia -->
`;
}
function pendiente(nombre, funcSlug, fecha) {
  return `---
tipo: pendiente
historia: "[[${funcSlug}]]"
nombre: "${escapeYaml(nombre)}"
estado: por-hacer
fecha: ${fecha}
---

# ${nombre}

**Fecha:** ${fecha}
**Historia relacionada:** [[${funcSlug}]]

## Descripci\xF3n
<!-- Describe el pendiente -->

## Criterio de completado
<!-- \xBFCu\xE1ndo se considera resuelto este pendiente? -->
`;
}

// src/files.ts
var COLOR_ETIQUETA_FALLBACK = "#5082ff";
function leerEtiquetasEpica(app, epica) {
  var _a, _b, _c;
  const fm = (_a = app.metadataCache.getFileCache(epica.file)) == null ? void 0 : _a.frontmatter;
  if (!Array.isArray(fm == null ? void 0 : fm.etiquetas))
    return [];
  const out = [];
  for (const x of fm.etiquetas) {
    if (!x || typeof x !== "object")
      continue;
    const o = x;
    const nombre = String((_b = o.nombre) != null ? _b : "").trim();
    if (!nombre)
      continue;
    out.push({
      nombre,
      color: String((_c = o.color) != null ? _c : "") || COLOR_ETIQUETA_FALLBACK,
      visible: o.visible === void 0 ? true : Boolean(o.visible)
    });
  }
  return out;
}
async function guardarEtiquetasEpica(app, epica, etiquetas) {
  await app.fileManager.processFrontMatter(epica.file, (fm) => {
    fm.etiquetas = etiquetas.map((e) => ({
      nombre: e.nombre,
      color: e.color,
      visible: e.visible !== false
    }));
  });
}
function leerEtiquetasHistoria(app, file) {
  var _a;
  const fm = (_a = app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter;
  return Array.isArray(fm == null ? void 0 : fm.etiquetas) ? fm.etiquetas.map(String) : [];
}
async function guardarEtiquetasHistoria(app, file, nombres) {
  await app.fileManager.processFrontMatter(file, (fm) => {
    fm.etiquetas = nombres;
  });
}
function leerSprintHistoria(app, file) {
  var _a, _b;
  const fm = (_a = app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter;
  const sprint = Number(fm == null ? void 0 : fm.sprint);
  const anio = Number((_b = fm == null ? void 0 : fm["a\xF1o"]) != null ? _b : fm == null ? void 0 : fm.anio);
  if (Number.isFinite(sprint) && sprint >= 1 && Number.isFinite(anio) && anio > 0) {
    return { sprint, anio };
  }
  return null;
}
async function guardarSprintHistoria(app, file, sprint, anio) {
  await app.fileManager.processFrontMatter(file, (fm) => {
    if (sprint === null) {
      delete fm.sprint;
      delete fm["a\xF1o"];
      delete fm.anio;
    } else {
      fm.sprint = sprint;
      fm["a\xF1o"] = anio;
      delete fm.anio;
    }
  });
}
var YaExisteError = class extends Error {
};
var CARPETA_ACTIVAS = "\xC9picas";
var CARPETA_INACTIVAS = "\xC9picas archivadas";
var CARPETA_HISTORIAS = "historias";
var CARPETA_HISTORIAS_LEGACY = "funcionalidades";
function nombreCarpetaHistorias(epicaFolder) {
  const tiene = (n) => epicaFolder.children.some((c) => c instanceof import_obsidian.TFolder && c.name === n);
  if (tiene(CARPETA_HISTORIAS))
    return CARPETA_HISTORIAS;
  if (tiene(CARPETA_HISTORIAS_LEGACY))
    return CARPETA_HISTORIAS_LEGACY;
  return CARPETA_HISTORIAS;
}
function carpetasGestionListas(app) {
  return app.vault.getAbstractFileByPath((0, import_obsidian.normalizePath)(CARPETA_ACTIVAS)) instanceof import_obsidian.TFolder && app.vault.getAbstractFileByPath((0, import_obsidian.normalizePath)(CARPETA_INACTIVAS)) instanceof import_obsidian.TFolder;
}
async function crearCarpetasGestion(app) {
  await ensureFolder(app, CARPETA_ACTIVAS);
  await ensureFolder(app, CARPETA_INACTIVAS);
}
async function migrarCampoHistoria(app) {
  var _a;
  const bajoGestion = (p) => p.startsWith(`${CARPETA_ACTIVAS}/`) || p.startsWith(`${CARPETA_INACTIVAS}/`);
  for (const file of app.vault.getMarkdownFiles()) {
    if (!bajoGestion(file.path))
      continue;
    const fm = (_a = app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter;
    if (!fm || !("funcionalidad" in fm) || "historia" in fm)
      continue;
    try {
      await app.fileManager.processFrontMatter(file, (f) => {
        if ("funcionalidad" in f && !("historia" in f)) {
          f.historia = f.funcionalidad;
          delete f.funcionalidad;
        }
      });
    } catch (e) {
      console.error(e);
    }
  }
}
async function migrarCarpetasHistorias(app) {
  var _a, _b;
  const epicas = [
    ...listFuncionalidades(app, CARPETA_ACTIVAS),
    ...listFuncionalidades(app, CARPETA_INACTIVAS)
  ];
  for (const ep of epicas) {
    const legacy = ep.folder.children.find(
      (c) => c instanceof import_obsidian.TFolder && c.name === CARPETA_HISTORIAS_LEGACY
    );
    const yaNueva = ep.folder.children.some(
      (c) => c instanceof import_obsidian.TFolder && c.name === CARPETA_HISTORIAS
    );
    if (legacy && !yaNueva) {
      try {
        await app.fileManager.renameFile(
          legacy,
          (0, import_obsidian.normalizePath)(`${ep.folder.path}/${CARPETA_HISTORIAS}`)
        );
      } catch (e) {
        console.error(e);
      }
    }
  }
  await migrarCampoHistoria(app);
  const epicas2 = [
    ...listFuncionalidades(app, CARPETA_ACTIVAS),
    ...listFuncionalidades(app, CARPETA_INACTIVAS)
  ];
  for (const ep of epicas2) {
    for (const h of listFuncionalidadesDe(app, ep.folder)) {
      const tipo = (_b = (_a = app.metadataCache.getFileCache(h.file)) == null ? void 0 : _a.frontmatter) == null ? void 0 : _b.tipo;
      if (tipo === "funcionalidad") {
        try {
          await app.fileManager.processFrontMatter(h.file, (fm) => {
            fm.tipo = "historia";
          });
        } catch (e) {
          console.error(e);
        }
      }
    }
  }
}
function claveRelativa(adminPath, path) {
  const prefijo = (0, import_obsidian.normalizePath)(adminPath) + "/";
  const sinMd = path.endsWith(".md") ? path.slice(0, -3) : path;
  return sinMd.startsWith(prefijo) ? sinMd.slice(prefijo.length) : sinMd;
}
async function ensureFolder(app, path) {
  const norm = (0, import_obsidian.normalizePath)(path);
  const existente = app.vault.getAbstractFileByPath(norm);
  if (existente instanceof import_obsidian.TFolder)
    return existente;
  if (existente)
    throw new Error(`"${norm}" existe pero no es una carpeta.`);
  await app.vault.createFolder(norm);
  const creada = app.vault.getAbstractFileByPath(norm);
  if (!(creada instanceof import_obsidian.TFolder))
    throw new Error(`No se pudo crear la carpeta "${norm}".`);
  return creada;
}
function nombreDesdeFrontmatter(app, file, fallback) {
  var _a, _b;
  const nombre = (_b = (_a = app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter) == null ? void 0 : _b.nombre;
  return nombre ? String(nombre) : fallback;
}
function funcRefDesdeCarpeta(app, folderPath) {
  var _a;
  const folder = app.vault.getAbstractFileByPath((0, import_obsidian.normalizePath)(folderPath));
  if (!(folder instanceof import_obsidian.TFolder))
    return null;
  const main = folder.children.find(
    (c) => c instanceof import_obsidian.TFile && c.extension === "md" && c.basename === folder.name
  );
  if (!main)
    return null;
  const fm = (_a = app.metadataCache.getFileCache(main)) == null ? void 0 : _a.frontmatter;
  return {
    slug: folder.name,
    nombre: (fm == null ? void 0 : fm.nombre) ? String(fm.nombre) : folder.name,
    file: main,
    folder,
    estado: (fm == null ? void 0 : fm.estado) ? String(fm.estado) : void 0
  };
}
function listFuncionalidades(app, adminPath) {
  var _a;
  const root = app.vault.getAbstractFileByPath((0, import_obsidian.normalizePath)(adminPath));
  if (!(root instanceof import_obsidian.TFolder))
    return [];
  const out = [];
  for (const child of root.children) {
    if (!(child instanceof import_obsidian.TFolder))
      continue;
    const main = child.children.find(
      (c) => c instanceof import_obsidian.TFile && c.extension === "md" && c.basename === child.name
    );
    if (!main)
      continue;
    const fm = (_a = app.metadataCache.getFileCache(main)) == null ? void 0 : _a.frontmatter;
    out.push({
      slug: child.name,
      nombre: (fm == null ? void 0 : fm.nombre) ? String(fm.nombre) : child.name,
      file: main,
      folder: child,
      estado: (fm == null ? void 0 : fm.estado) ? String(fm.estado) : void 0
    });
  }
  return out.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
function listFuncionalidadesDe(app, epicaFolder) {
  var _a;
  const dir = epicaFolder.children.find(
    (c) => c instanceof import_obsidian.TFolder && (c.name === CARPETA_HISTORIAS || c.name === CARPETA_HISTORIAS_LEGACY)
  );
  if (!dir)
    return [];
  const out = [];
  for (const child of dir.children) {
    if (!(child instanceof import_obsidian.TFolder))
      continue;
    const main = child.children.find(
      (c) => c instanceof import_obsidian.TFile && c.extension === "md" && c.basename === child.name
    );
    if (!main)
      continue;
    const fm = (_a = app.metadataCache.getFileCache(main)) == null ? void 0 : _a.frontmatter;
    out.push({
      slug: child.name,
      nombre: (fm == null ? void 0 : fm.nombre) ? String(fm.nombre) : child.name,
      file: main,
      folder: child,
      estado: (fm == null ? void 0 : fm.estado) ? String(fm.estado) : void 0
    });
  }
  return out.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
async function createFuncionalidadEn(app, epica, nombre) {
  const slug = slugify(nombre);
  const carpeta = nombreCarpetaHistorias(epica.folder);
  await ensureFolder(app, `${epica.folder.path}/${carpeta}`);
  const fnPath = (0, import_obsidian.normalizePath)(`${epica.folder.path}/${carpeta}/${slug}`);
  if (app.vault.getAbstractFileByPath(fnPath))
    throw new YaExisteError();
  await app.vault.createFolder(fnPath);
  return app.vault.create(
    `${fnPath}/${slug}.md`,
    funcionalidadNueva(nombre, epica.slug, hoy())
  );
}
function listTareas(app, funcFolder) {
  const dir = funcFolder.children.find(
    (c) => c instanceof import_obsidian.TFolder && c.name === "tareas"
  );
  if (!dir)
    return [];
  const out = [];
  for (const child of dir.children) {
    if (child instanceof import_obsidian.TFile && child.extension === "md") {
      out.push({
        slug: child.basename,
        nombre: nombreDesdeFrontmatter(app, child, child.basename),
        file: child
      });
    }
  }
  return out.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
function listPendientes(app, funcFolder) {
  const dir = funcFolder.children.find(
    (c) => c instanceof import_obsidian.TFolder && c.name === "pendientes"
  );
  if (!dir)
    return [];
  const out = [];
  for (const child of dir.children) {
    if (child instanceof import_obsidian.TFile && child.extension === "md") {
      out.push({
        slug: child.basename,
        nombre: nombreDesdeFrontmatter(app, child, child.basename),
        file: child
      });
    }
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug, "es"));
}
function listIncidencias(app, func, tipos = []) {
  const out = [];
  for (const t of listTareas(app, func.folder)) {
    out.push({ tipo: "tarea", tipoNombre: "Tarea", file: t.file, nombre: t.nombre, nivel: 0 });
  }
  for (const p of listPendientes(app, func.folder)) {
    out.push({
      tipo: "pendiente",
      tipoNombre: "Pendiente",
      file: p.file,
      nombre: p.nombre,
      nivel: 0
    });
  }
  out.push(...listNotasDeTipos(app, func, tipos));
  return out;
}
function listNotasDeTipos(app, func, tipos) {
  const out = [];
  for (const tipo of tipos) {
    const slug = slugify(tipo.nombre);
    const dir = func.folder.children.find(
      (c) => c instanceof import_obsidian.TFolder && c.name === slug
    );
    if (!dir)
      continue;
    for (const child of dir.children) {
      if (child instanceof import_obsidian.TFile && child.extension === "md") {
        out.push({
          tipo: slug,
          tipoNombre: tipo.nombre,
          file: child,
          nombre: nombreDesdeFrontmatter(app, child, child.basename),
          nivel: 0
        });
      }
    }
  }
  return out;
}
function listDocumentos(app, func, tipos) {
  return listNotasDeTipos(app, func, tipos);
}
function getAsignados(app, file) {
  var _a, _b;
  const valor = (_b = (_a = app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter) == null ? void 0 : _b.asignados;
  return Array.isArray(valor) ? valor.map(String) : [];
}
function existeEnDir(app, dir, slug) {
  return !!app.vault.getAbstractFileByPath((0, import_obsidian.normalizePath)(`${dir}/${slug}.md`)) || !!app.vault.getAbstractFileByPath((0, import_obsidian.normalizePath)(`${dir}/${slug}`));
}
function slugDisponible(app, dir, slug) {
  if (!existeEnDir(app, dir, slug))
    return slug;
  let n = 2;
  while (existeEnDir(app, dir, `${slug}-${n}`))
    n++;
  return `${slug}-${n}`;
}
async function appendToSection(app, file, heading, linea) {
  await app.vault.process(file, (content) => {
    const lines = content.split("\n");
    const idx = lines.findIndex((l) => l.trim() === heading);
    if (idx === -1) {
      return content.trimEnd() + `

${heading}

${linea}
`;
    }
    let fin = lines.length;
    for (let i = idx + 1; i < lines.length; i++) {
      if (/^#{1,6}\s/.test(lines[i])) {
        fin = i;
        break;
      }
    }
    let insertarEn = fin;
    while (insertarEn > idx + 1 && lines[insertarEn - 1].trim() === "")
      insertarEn--;
    lines.splice(insertarEn, 0, linea);
    return lines.join("\n");
  });
}
async function createFuncionalidad(app, adminPath, nombre) {
  const slug = slugify(nombre);
  await ensureFolder(app, adminPath);
  const funcPath = (0, import_obsidian.normalizePath)(`${adminPath}/${slug}`);
  if (app.vault.getAbstractFileByPath(funcPath))
    throw new YaExisteError();
  await app.vault.createFolder(funcPath);
  return app.vault.create(`${funcPath}/${slug}.md`, funcionalidad(nombre, hoy()));
}
async function createTarea(app, func, slug, nombre) {
  await ensureFolder(app, `${func.folder.path}/tareas`);
  const dirTarea = (0, import_obsidian.normalizePath)(`${func.folder.path}/tareas`);
  const file = await app.vault.create(
    `${dirTarea}/${slug}.md`,
    tarea(nombre, func.slug, hoy())
  );
  await appendToSection(app, func.file, "## Tareas", `- [ ] [[${slug}|${nombre}]]`);
  return file;
}
async function createIncidencia(app, func, base, nombre, tipoSlug, tipoNombre, descripcion = "") {
  const dir = `${func.folder.path}/${tipoSlug}`;
  await ensureFolder(app, dir);
  const file = await app.vault.create(
    (0, import_obsidian.normalizePath)(`${dir}/${base}.md`),
    incidencia(nombre, func.slug, hoy(), tipoSlug, descripcion)
  );
  await appendToSection(app, func.file, `## ${tipoNombre}`, `- [ ] [[${base}|${nombre}]]`);
  return file;
}
function archivoSprints(app, func) {
  const f = app.vault.getAbstractFileByPath((0, import_obsidian.normalizePath)(`${func.folder.path}/sprints.md`));
  return f instanceof import_obsidian.TFile ? f : null;
}
async function leerSprints(app, func) {
  var _a, _b;
  const file = archivoSprints(app, func);
  if (!file)
    return [];
  const contenido = await app.vault.cachedRead(file);
  const m = contenido.match(/^---\n([\s\S]*?)\n---/);
  if (!m)
    return [];
  let fm;
  try {
    fm = (0, import_obsidian.parseYaml)(m[1]);
  } catch (e) {
    return [];
  }
  const lista = fm == null ? void 0 : fm.sprints;
  if (!Array.isArray(lista))
    return [];
  const out = [];
  for (const entrada of lista) {
    if (!entrada || typeof entrada !== "object")
      continue;
    const reg = entrada;
    const anio = Number((_a = reg["a\xF1o"]) != null ? _a : reg["anio"]);
    const sprint = Number(reg["sprint"]);
    const numLegacy = Number((_b = reg["numElementos"]) != null ? _b : reg["num"]);
    const numSprintLegacy = Number.isFinite(numLegacy) && numLegacy > 0 ? numLegacy : void 0;
    const etiquetas = Array.isArray(reg["etiquetas"]) ? reg["etiquetas"].map((x) => {
      var _a2;
      if (x && typeof x === "object") {
        const o = x;
        const nombre2 = String((_a2 = o.nombre) != null ? _a2 : "").trim();
        const nv = Number(o.num);
        return nombre2 ? { nombre: nombre2, num: Number.isFinite(nv) && nv > 0 ? nv : void 0 } : null;
      }
      const nombre = String(x).trim();
      return nombre ? { nombre, num: numSprintLegacy } : null;
    }).filter((e) => e !== null) : [];
    if (Number.isFinite(anio) && anio > 0 && sprint >= 1) {
      out.push({ anio, sprint, etiquetas });
    }
  }
  return out;
}
async function guardarSprints(app, func, sprints) {
  const orden = [...sprints].sort((a, b) => a.anio - b.anio || a.sprint - b.sprint);
  const lineas = ["---", "tipo: sprints", `epica: "[[${func.slug}]]"`];
  if (orden.length === 0) {
    lineas.push("sprints: []");
  } else {
    lineas.push("sprints:");
    for (const s of orden) {
      lineas.push(`  - a\xF1o: ${s.anio}`);
      lineas.push(`    sprint: ${s.sprint}`);
      if (s.etiquetas.length === 0) {
        lineas.push(`    etiquetas: []`);
      } else {
        lineas.push(`    etiquetas:`);
        for (const et of s.etiquetas) {
          const numPart = et.num && et.num > 0 ? `, num: ${et.num}` : "";
          lineas.push(`      - { nombre: "${escapeYaml(et.nombre)}"${numPart} }`);
        }
      }
    }
  }
  lineas.push("---", "", `# Sprints \u2014 ${func.nombre}`, "");
  if (orden.length === 0) {
    lineas.push("| Sprint | Etiquetas |", "|---|---|", "");
  } else {
    for (const anio of [...new Set(orden.map((s) => s.anio))]) {
      lineas.push(`## ${anio}`, "", "| Sprint | Etiquetas |", "|---|---|");
      for (const s of orden.filter((x) => x.anio === anio)) {
        const cels = s.etiquetas.map(
          (e) => e.num && e.num > 0 ? `${e.nombre} (${e.num})` : e.nombre
        );
        lineas.push(`| Sprint ${s.sprint} | ${cels.join(", ")} |`);
      }
      lineas.push("");
    }
  }
  const contenido = lineas.join("\n");
  const existente = archivoSprints(app, func);
  if (existente) {
    await app.vault.process(existente, () => contenido);
    return existente;
  }
  return app.vault.create((0, import_obsidian.normalizePath)(`${func.folder.path}/sprints.md`), contenido);
}
async function createPendiente(app, func, base, nombre, fecha) {
  await ensureFolder(app, `${func.folder.path}/pendientes`);
  const dirPend = (0, import_obsidian.normalizePath)(`${func.folder.path}/pendientes`);
  const file = await app.vault.create(
    `${dirPend}/${base}.md`,
    pendiente(nombre, func.slug, fecha)
  );
  await appendToSection(app, func.file, "## Pendientes", `- [ ] [[${base}|${nombre}]] \u2014 ${fecha}`);
  return file;
}
function listTodasFunc(app, adminPath) {
  const out = [];
  for (const ep of listFuncionalidades(app, adminPath)) {
    out.push(ep);
    out.push(...listFuncionalidadesDe(app, ep.folder));
  }
  return out;
}
async function actualizarH1(app, file, nuevoNombre) {
  await app.vault.process(file, (content) => {
    const lines = content.split("\n");
    const i = lines.findIndex((l) => /^#\s+/.test(l));
    if (i !== -1)
      lines[i] = `# ${nuevoNombre}`;
    return lines.join("\n");
  });
}
function slugCarpetaLibre(app, dir, slug) {
  const existe = (s) => !!app.vault.getAbstractFileByPath((0, import_obsidian.normalizePath)(`${dir}/${s}`));
  if (!existe(slug))
    return slug;
  let n = 2;
  while (existe(`${slug}-${n}`))
    n++;
  return `${slug}-${n}`;
}
function slugArchivoLibre(app, dir, slug) {
  return slugArchivoLibreExcepto(app, dir, slug, "");
}
function slugArchivoLibreExcepto(app, dir, slug, exceptoPath) {
  const existe = (s) => {
    const p = (0, import_obsidian.normalizePath)(`${dir}/${s}.md`);
    return p !== exceptoPath && !!app.vault.getAbstractFileByPath(p);
  };
  if (!existe(slug))
    return slug;
  let n = 2;
  while (existe(`${slug}-${n}`))
    n++;
  return `${slug}-${n}`;
}
async function renombrarFuncionalidad(app, ref, nuevoNombre) {
  await app.fileManager.processFrontMatter(ref.file, (fm) => {
    fm.nombre = nuevoNombre;
  });
  await actualizarH1(app, ref.file, nuevoNombre);
  const parent = ref.folder.parent;
  const deseado = slugify(nuevoNombre);
  if (!parent || !deseado || deseado === ref.slug)
    return;
  const nuevoSlug = slugCarpetaLibre(app, parent.path, deseado);
  await app.fileManager.renameFile(ref.file, (0, import_obsidian.normalizePath)(`${ref.folder.path}/${nuevoSlug}.md`));
  await app.fileManager.renameFile(ref.folder, (0, import_obsidian.normalizePath)(`${parent.path}/${nuevoSlug}`));
}
async function renombrarIncidencia(app, file, nuevoNombre) {
  await app.fileManager.processFrontMatter(file, (fm) => {
    fm.nombre = nuevoNombre;
  });
  await actualizarH1(app, file, nuevoNombre);
  const dir = file.parent;
  const deseado = slugify(nuevoNombre);
  if (!dir || !deseado || deseado === file.basename)
    return;
  const nuevo = slugArchivoLibre(app, dir.path, deseado);
  await app.fileManager.renameFile(file, (0, import_obsidian.normalizePath)(`${dir.path}/${nuevo}.md`));
}
async function renombrarSeccion(app, file, anterior, nuevo) {
  await app.vault.process(file, (content) => {
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === `## ${anterior}`)
        lines[i] = `## ${nuevo}`;
    }
    return lines.join("\n");
  });
}
async function renombrarEtiquetaSprint(app, adminPath, anterior, nuevo) {
  for (const f of listTodasFunc(app, adminPath)) {
    const sprints = await leerSprints(app, f);
    let cambio = false;
    for (const s of sprints) {
      for (const e of s.etiquetas)
        if (e.nombre === anterior) {
          e.nombre = nuevo;
          cambio = true;
        }
    }
    if (cambio)
      await guardarSprints(app, f, sprints);
  }
}
async function eliminarEtiquetaSprint(app, adminPath, nombre) {
  for (const f of listTodasFunc(app, adminPath)) {
    const sprints = await leerSprints(app, f);
    let cambio = false;
    for (const s of sprints) {
      const antes = s.etiquetas.length;
      s.etiquetas = s.etiquetas.filter((e) => e.nombre !== nombre);
      if (s.etiquetas.length !== antes)
        cambio = true;
    }
    if (cambio)
      await guardarSprints(app, f, sprints);
  }
}
async function renombrarColaborador(app, adminPath, tipos, anterior, nuevo) {
  for (const f of listTodasFunc(app, adminPath)) {
    for (const inc of listIncidencias(app, f, tipos)) {
      const asign = getAsignados(app, inc.file);
      if (!asign.includes(anterior))
        continue;
      const nuevos = [...new Set(asign.map((a) => a === anterior ? nuevo : a))].sort(
        (a, b) => a.localeCompare(b, "es")
      );
      await app.fileManager.processFrontMatter(inc.file, (fm) => {
        fm.asignados = nuevos;
      });
    }
  }
}
async function eliminarColaborador(app, adminPath, tipos, nombre) {
  for (const f of listTodasFunc(app, adminPath)) {
    for (const inc of listIncidencias(app, f, tipos)) {
      const asign = getAsignados(app, inc.file);
      if (!asign.includes(nombre))
        continue;
      await app.fileManager.processFrontMatter(inc.file, (fm) => {
        fm.asignados = asign.filter((a) => a !== nombre);
      });
    }
  }
}
async function renombrarEtiquetaHistoria(app, epica, anterior, nuevo) {
  for (const h of listFuncionalidadesDe(app, epica.folder)) {
    const etqs = leerEtiquetasHistoria(app, h.file);
    if (etqs.includes(anterior)) {
      await guardarEtiquetasHistoria(app, h.file, etqs.map((e) => e === anterior ? nuevo : e));
    }
  }
}
async function eliminarEtiquetaHistoria(app, epica, nombre) {
  for (const h of listFuncionalidadesDe(app, epica.folder)) {
    const etqs = leerEtiquetasHistoria(app, h.file);
    if (etqs.includes(nombre)) {
      await guardarEtiquetasHistoria(app, h.file, etqs.filter((e) => e !== nombre));
    }
  }
}
async function renombrarTipoIncidencia(app, adminPath, anterior, nuevo) {
  const slugAnt = slugify(anterior);
  const slugNue = slugify(nuevo);
  for (const f of listTodasFunc(app, adminPath)) {
    const dir = f.folder.children.find(
      (c) => c instanceof import_obsidian.TFolder && c.name === slugAnt
    );
    if (!dir)
      continue;
    for (const child of dir.children) {
      if (child instanceof import_obsidian.TFile && child.extension === "md") {
        await app.fileManager.processFrontMatter(child, (fm) => {
          fm.tipo = slugNue;
        });
      }
    }
    await renombrarSeccion(app, f.file, anterior, nuevo);
    if (slugNue !== slugAnt) {
      const destino = (0, import_obsidian.normalizePath)(`${f.folder.path}/${slugNue}`);
      if (!app.vault.getAbstractFileByPath(destino)) {
        await app.fileManager.renameFile(dir, destino);
      }
    }
  }
}
async function moverHistoriaAEpica(app, historia, destino) {
  const destDir = `${destino.folder.path}/${nombreCarpetaHistorias(destino.folder)}`;
  await ensureFolder(app, destDir);
  const nuevoSlug = slugCarpetaLibre(app, destDir, historia.slug);
  if (nuevoSlug !== historia.slug) {
    await app.fileManager.renameFile(
      historia.file,
      (0, import_obsidian.normalizePath)(`${historia.folder.path}/${nuevoSlug}.md`)
    );
  }
  await app.fileManager.renameFile(historia.folder, (0, import_obsidian.normalizePath)(`${destDir}/${nuevoSlug}`));
  await app.fileManager.processFrontMatter(historia.file, (fm) => {
    fm.epica = `[[${destino.slug}]]`;
  });
}
async function quitarLineaConEnlace(app, file, base) {
  await app.vault.process(file, (content) => {
    const lines = content.split("\n");
    return lines.filter((l) => !l.includes(`[[${base}]]`) && !l.includes(`[[${base}|`)).join("\n");
  });
}
async function moverIncidencia(app, incFile, origen, destino, nuevoTipoNombre, nuevoNombre) {
  const oldBase = incFile.basename;
  const nombreFinal = nuevoNombre.trim() || oldBase;
  await quitarLineaConEnlace(app, origen.file, oldBase);
  const nuevoSlug = slugify(nuevoTipoNombre);
  const destDir = `${destino.folder.path}/${nuevoSlug}`;
  await ensureFolder(app, destDir);
  const deseado = slugify(nombreFinal) || oldBase;
  const base = slugArchivoLibreExcepto(app, destDir, deseado, incFile.path);
  const destPath = (0, import_obsidian.normalizePath)(`${destDir}/${base}.md`);
  if (destPath !== incFile.path) {
    await app.fileManager.renameFile(incFile, destPath);
  }
  await app.fileManager.processFrontMatter(incFile, (fm) => {
    fm.tipo = nuevoSlug;
    fm.historia = `[[${destino.slug}]]`;
    delete fm.funcionalidad;
    fm.nombre = nombreFinal;
  });
  await actualizarH1(app, incFile, nombreFinal);
  await appendToSection(
    app,
    destino.file,
    `## ${nuevoTipoNombre}`,
    `- [ ] [[${base}|${nombreFinal}]]`
  );
}
function notasDescendientes(folder) {
  const out = [];
  const recorrer = (f) => {
    for (const c of f.children) {
      if (c instanceof import_obsidian.TFolder)
        recorrer(c);
      else if (c instanceof import_obsidian.TFile && c.extension === "md")
        out.push(c);
    }
  };
  recorrer(folder);
  return out;
}
function reemplazarEnlace(content, oldSlug, newSlug) {
  return content.split(`[[${oldSlug}]]`).join(`[[${newSlug}]]`).split(`[[${oldSlug}|`).join(`[[${newSlug}|`);
}
async function eliminarFuncionalidad(app, ref) {
  await app.fileManager.trashFile(ref.folder);
}
async function eliminarIncidencia(app, incFile, origen) {
  await quitarLineaConEnlace(app, origen.file, incFile.basename);
  await app.fileManager.trashFile(incFile);
}
async function archivarEpica(app, epica, anio) {
  const destino = CARPETA_INACTIVAS;
  await ensureFolder(app, destino);
  if (!app.vault.getAbstractFileByPath((0, import_obsidian.normalizePath)(`${destino}/${epica.slug}`))) {
    await app.fileManager.renameFile(epica.folder, (0, import_obsidian.normalizePath)(`${destino}/${epica.slug}`));
    return { renombrada: false, nombre: epica.nombre };
  }
  const nuevoNombre = `${epica.nombre} ${anio}`;
  const newSlug = slugCarpetaLibre(app, destino, slugify(nuevoNombre) || epica.slug);
  await app.fileManager.processFrontMatter(epica.file, (fm) => {
    fm.nombre = nuevoNombre;
  });
  await actualizarH1(app, epica.file, nuevoNombre);
  for (const f of notasDescendientes(epica.folder)) {
    await app.vault.process(f, (c) => reemplazarEnlace(c, epica.slug, newSlug));
  }
  await app.fileManager.renameFile(
    epica.file,
    (0, import_obsidian.normalizePath)(`${epica.folder.path}/${newSlug}.md`)
  );
  await app.fileManager.renameFile(epica.folder, (0, import_obsidian.normalizePath)(`${destino}/${newSlug}`));
  return { renombrada: true, nombre: nuevoNombre };
}

// src/config-io.ts
var import_obsidian2 = require("obsidian");
var MARCA = "gestor-funciones-config";
function sanearEtiquetas(valor) {
  var _a, _b;
  if (!Array.isArray(valor))
    return null;
  const out = [];
  for (const e of valor) {
    if (!e || typeof e !== "object")
      continue;
    const o = e;
    const nombre = String((_a = o.nombre) != null ? _a : "").trim();
    if (!nombre)
      continue;
    out.push({
      nombre,
      color: String((_b = o.color) != null ? _b : "") || COLOR_ETIQUETA_DEFECTO,
      visible: o.visible === void 0 ? true : Boolean(o.visible)
    });
  }
  return out.length > 0 ? out : null;
}
function sanearCarriles(valor) {
  var _a, _b, _c;
  if (!Array.isArray(valor))
    return null;
  const out = [];
  const valores = /* @__PURE__ */ new Set();
  for (const e of valor) {
    if (!e || typeof e !== "object")
      continue;
    const o = e;
    const nombre = String((_a = o.nombre) != null ? _a : "").trim();
    if (!nombre)
      continue;
    let val = String((_b = o.valor) != null ? _b : "").trim() || slugify(nombre);
    if (!val)
      continue;
    while (valores.has(val))
      val = `${val}-2`;
    valores.add(val);
    out.push({
      nombre,
      valor: val,
      color: String((_c = o.color) != null ? _c : "") || COLOR_ETIQUETA_DEFECTO,
      visible: o.visible === void 0 ? true : Boolean(o.visible)
    });
  }
  return out.length > 0 ? out : null;
}
var CATEGORIAS = [
  {
    clave: "numSprints",
    etiqueta: "N\xFAmero de sprints",
    exportar: (s) => s.numSprints,
    leerArchivo: (v) => {
      const n = Math.trunc(Number(v));
      return Number.isFinite(n) && n >= 1 ? n : null;
    },
    aplicar: (s, v) => {
      s.numSprints = v;
      if (s.kanban.filtroSprints.hasta > s.numSprints)
        s.kanban.filtroSprints.hasta = s.numSprints;
      if (s.kanban.filtroSprints.desde > s.numSprints)
        s.kanban.filtroSprints.desde = s.numSprints;
    }
  },
  {
    clave: "colaboradores",
    etiqueta: "Colaboradores",
    exportar: (s) => s.colaboradores,
    leerArchivo: (v) => sanearEtiquetas(v),
    aplicar: (s, v) => {
      s.colaboradores = v;
    }
  },
  {
    clave: "incidencias",
    etiqueta: "Tipos de incidencia",
    exportar: (s) => s.incidencias,
    leerArchivo: (v) => sanearEtiquetas(v),
    aplicar: (s, v) => {
      s.incidencias = v;
    }
  },
  {
    clave: "documentos",
    etiqueta: "Tipos de documento",
    exportar: (s) => s.documentos,
    leerArchivo: (v) => sanearEtiquetas(v),
    aplicar: (s, v) => {
      s.documentos = v;
    }
  },
  {
    clave: "etiquetas",
    etiqueta: "Etiquetas de sprint",
    exportar: (s) => s.etiquetas,
    leerArchivo: (v) => sanearEtiquetas(v),
    aplicar: (s, v) => {
      s.etiquetas = v;
    }
  },
  {
    clave: "carriles",
    etiqueta: "Carriles del kanban",
    exportar: (s) => s.carriles,
    leerArchivo: (v) => sanearCarriles(v),
    aplicar: (s, v) => {
      s.carriles = v;
    }
  }
];
var CONFIG_BOVEDA_PATH = ".gestion-de-epicas-config.json";
async function guardarConfigBoveda(plugin) {
  const datos = { [MARCA]: 1 };
  for (const cat of CATEGORIAS)
    datos[cat.clave] = cat.exportar(plugin.settings);
  const json = JSON.stringify(datos, null, 2);
  if (json === plugin.configBovedaUltima)
    return;
  plugin.configBovedaUltima = json;
  try {
    await plugin.app.vault.adapter.write(CONFIG_BOVEDA_PATH, json);
  } catch (e) {
    console.error(e);
  }
}
async function aplicarConfigBoveda(plugin) {
  const adapter = plugin.app.vault.adapter;
  let texto;
  try {
    if (!await adapter.exists(CONFIG_BOVEDA_PATH))
      return false;
    texto = await adapter.read(CONFIG_BOVEDA_PATH);
  } catch (e) {
    return false;
  }
  let parsed;
  try {
    parsed = JSON.parse(texto);
  } catch (e) {
    return false;
  }
  if (!parsed || typeof parsed !== "object" || !(MARCA in parsed))
    return false;
  let aplicado = false;
  for (const cat of CATEGORIAS) {
    if (!(cat.clave in parsed))
      continue;
    const valor = cat.leerArchivo(parsed[cat.clave]);
    if (valor !== null) {
      cat.aplicar(plugin.settings, valor);
      aplicado = true;
    }
  }
  plugin.configBovedaUltima = texto;
  return aplicado;
}
function descargarJson(nombre, contenido) {
  const blob = new Blob([contenido], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = activeDocument.createElement("a");
  a.href = url;
  a.download = nombre;
  activeDocument.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
var ExportarConfigModal = class extends import_obsidian2.Modal {
  constructor(plugin) {
    super(plugin.app);
    this.seleccion = /* @__PURE__ */ new Set();
    this.plugin = plugin;
  }
  onOpen() {
    this.titleEl.setText("Exportar configuraci\xF3n");
    const s = this.plugin.settings;
    this.contentEl.createEl("p", {
      cls: "gf-campo-aviso",
      text: "Marca lo que quieras incluir en el archivo."
    });
    for (const cat of CATEGORIAS) {
      const tieneDatos = this.tieneDatos(cat.exportar(s));
      if (tieneDatos)
        this.seleccion.add(cat.clave);
      const fila = this.contentEl.createEl("label", { cls: "gf-chk" });
      const chk = fila.createEl("input", { type: "checkbox" });
      chk.checked = tieneDatos;
      fila.appendText(` ${cat.etiqueta}${tieneDatos ? "" : " (vac\xEDo)"}`);
      chk.addEventListener("change", () => {
        if (chk.checked)
          this.seleccion.add(cat.clave);
        else
          this.seleccion.delete(cat.clave);
      });
    }
    const row = this.contentEl.createDiv({ cls: "gf-botones" });
    const cancelar = row.createEl("button", { text: "Cancelar" });
    cancelar.addEventListener("click", () => this.close());
    const descargar = row.createEl("button", { text: "Descargar", cls: "mod-cta" });
    descargar.addEventListener("click", () => {
      const datos = { [MARCA]: 1 };
      for (const cat of CATEGORIAS) {
        if (this.seleccion.has(cat.clave))
          datos[cat.clave] = cat.exportar(s);
      }
      descargarJson("gestor-producto-config.json", JSON.stringify(datos, null, 2));
      new import_obsidian2.Notice("Gesti\xF3n de \xE9picas: configuraci\xF3n exportada.");
      this.close();
    });
  }
  tieneDatos(valor) {
    if (Array.isArray(valor))
      return valor.length > 0;
    return valor !== void 0 && valor !== null;
  }
  onClose() {
    this.contentEl.empty();
  }
};
var ImportarConfigModal = class extends import_obsidian2.Modal {
  constructor(plugin, onImportar) {
    super(plugin.app);
    this.datos = null;
    this.seleccion = /* @__PURE__ */ new Set();
    this.plugin = plugin;
    this.onImportar = onImportar;
  }
  onOpen() {
    this.titleEl.setText("Importar configuraci\xF3n");
    this.render();
  }
  render() {
    this.contentEl.empty();
    const fileInput = this.contentEl.createEl("input", { type: "file", attr: { accept: ".json,application/json" } });
    fileInput.addEventListener("change", () => {
      var _a;
      const file = (_a = fileInput.files) == null ? void 0 : _a[0];
      if (!file)
        return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          if (!parsed || typeof parsed !== "object" || !(MARCA in parsed)) {
            new import_obsidian2.Notice("Gesti\xF3n de \xE9picas: el archivo no es una configuraci\xF3n v\xE1lida.");
            return;
          }
          this.datos = parsed;
          this.seleccion.clear();
          this.render();
        } catch (e) {
          new import_obsidian2.Notice("Gesti\xF3n de \xE9picas: no se pudo leer el archivo (JSON inv\xE1lido).");
        }
      };
      reader.readAsText(file);
    });
    if (!this.datos) {
      this.contentEl.createEl("p", {
        cls: "gf-campo-aviso",
        text: "Elige un archivo .json exportado desde este plugin."
      });
      return;
    }
    this.contentEl.createEl("p", {
      cls: "gf-campo-aviso",
      text: "Marca lo que quieras importar. Lo no disponible en el archivo aparece deshabilitado."
    });
    for (const cat of CATEGORIAS) {
      const valor = cat.leerArchivo(this.datos[cat.clave]);
      const disponible = valor !== null && cat.clave in this.datos;
      if (disponible)
        this.seleccion.add(cat.clave);
      const fila = this.contentEl.createEl("label", { cls: "gf-chk" });
      const chk = fila.createEl("input", { type: "checkbox" });
      chk.checked = disponible;
      chk.disabled = !disponible;
      fila.appendText(` ${cat.etiqueta}${disponible ? "" : " (no disponible)"}`);
      chk.addEventListener("change", () => {
        if (chk.checked)
          this.seleccion.add(cat.clave);
        else
          this.seleccion.delete(cat.clave);
      });
    }
    const row = this.contentEl.createDiv({ cls: "gf-botones" });
    const cancelar = row.createEl("button", { text: "Cancelar" });
    cancelar.addEventListener("click", () => this.close());
    const importar = row.createEl("button", { text: "Importar", cls: "mod-cta" });
    importar.addEventListener("click", () => void this.importar());
  }
  async importar() {
    if (!this.datos)
      return;
    const s = this.plugin.settings;
    let aplicadas = 0;
    for (const cat of CATEGORIAS) {
      if (!this.seleccion.has(cat.clave))
        continue;
      const valor = cat.leerArchivo(this.datos[cat.clave]);
      if (valor === null)
        continue;
      cat.aplicar(s, valor);
      aplicadas++;
    }
    await this.plugin.saveSettings();
    new import_obsidian2.Notice(`Gesti\xF3n de \xE9picas: ${aplicadas} elemento(s) importado(s).`);
    this.onImportar();
    this.close();
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/etiquetas-modal.ts
var import_obsidian3 = require("obsidian");

// src/colores.ts
var ETIQUETA_COLORES = [
  { nombre: "Amarillo", color: "#FFC93C" },
  { nombre: "Rojo", color: "#FA4D56" },
  { nombre: "Azul", color: "#2D9CFF" },
  { nombre: "Verde", color: "#2BC275" },
  { nombre: "Naranja", color: "#FF9F2E" },
  { nombre: "Morado", color: "#C950E8" },
  { nombre: "Gris", color: "#B9BEC6" }
];
function colorAleatorio() {
  return ETIQUETA_COLORES[Math.floor(Math.random() * ETIQUETA_COLORES.length)].color;
}
function oscurecer(hex, factor = 0.45) {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m)
    return hex;
  const ch = (h) => {
    const v = Math.max(0, Math.min(255, Math.round(parseInt(h, 16) * factor)));
    return v.toString(16).padStart(2, "0");
  };
  return `#${ch(m[1])}${ch(m[2])}${ch(m[3])}`;
}
function renderChipEtiqueta(parent, nombre, color, num) {
  const chip = parent.createSpan({ cls: "gf-etq-chip", text: nombre });
  chip.setCssStyles({ backgroundColor: color, color: oscurecer(color) });
  if (num && num > 0) {
    chip.createSpan({ cls: "gf-etq-chip-num", text: `\u{1F464} ${num}` });
  }
  return chip;
}
function renderSelectorColor(parent, inicial = colorAleatorio(), onChange, onInteract) {
  let valor = inicial;
  const wrap = parent.createDiv({ cls: "gf-color-selector gf-multiselect" });
  const btn = wrap.createEl("button", { cls: "gf-color-pill gf-multiselect-btn" });
  const dot = btn.createDiv({ cls: "gf-color-dot" });
  btn.createSpan({ cls: "gf-color-caret", text: "\u25BC" });
  const panel = createDiv({ cls: "gf-multiselect-panel gf-color-panel gf-color-panel-float" });
  const pintar = () => {
    dot.setCssStyles({ backgroundColor: valor });
    for (const f of Array.from(panel.children)) {
      f.toggleClass("gf-color-opcion-on", f.dataset.color === valor);
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
      onChange == null ? void 0 : onChange(valor);
    });
  }
  let abierto = false;
  const onDocClick = (ev) => {
    const t = ev.target;
    if (!panel.contains(t) && t !== btn && !btn.contains(t))
      cerrar();
  };
  const onKey = (ev) => {
    if (ev.key === "Escape")
      cerrar();
  };
  function cerrar() {
    if (!abierto)
      return;
    abierto = false;
    panel.remove();
    activeDocument.removeEventListener("click", onDocClick, true);
    window.removeEventListener("scroll", cerrar, true);
    window.removeEventListener("resize", cerrar);
    activeDocument.removeEventListener("keydown", onKey, true);
  }
  const abrir = () => {
    if (abierto)
      return;
    activeDocument.body.appendChild(panel);
    const r = btn.getBoundingClientRect();
    panel.setCssStyles({ top: `${r.bottom + 4}px`, left: `${r.left}px`, display: "block" });
    abierto = true;
    window.setTimeout(() => {
      activeDocument.addEventListener("click", onDocClick, true);
      window.addEventListener("scroll", cerrar, true);
      window.addEventListener("resize", cerrar);
      activeDocument.addEventListener("keydown", onKey, true);
    }, 0);
  };
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onInteract == null ? void 0 : onInteract();
    if (abierto)
      cerrar();
    else
      abrir();
  });
  pintar();
  return {
    getColor: () => valor,
    setColor: (c) => {
      valor = c;
      pintar();
    }
  };
}

// src/etiquetas-modal.ts
var _GestorEtiquetasModal = class _GestorEtiquetasModal extends import_obsidian3.Modal {
  constructor(plugin, opts) {
    var _a, _b, _c;
    super(plugin.app);
    this.seleccionado = null;
    /** Índice de fila que debe entrar en edición de nombre tras renderizar (al
     * pulsar ＋), para escribir el nombre de inmediato sin doble clic. */
    this.editarAlAgregar = null;
    /** Filas renderizadas, para actualizar la selección sin reconstruir todo. */
    this.filas = [];
    this.delBtn = null;
    /** Modo por épica: épica elegida y su lista de etiquetas en memoria. */
    this.epicaActual = null;
    this.listaEpica = [];
    this.plugin = plugin;
    this.opts = opts;
    this.tab = (_c = (_b = (_a = opts.secciones) == null ? void 0 : _a[0]) == null ? void 0 : _b.id) != null ? _c : "";
  }
  /** Persiste los cambios según el modo (configuración, callback o frontmatter). */
  async guardar() {
    if (this.opts.porEpica) {
      if (this.epicaActual)
        await this.opts.porEpica.guardar(this.epicaActual, this.listaEpica);
      return;
    }
    await (this.opts.guardar ? this.opts.guardar() : this.plugin.saveSettings());
  }
  onOpen() {
    this.titleEl.setText(this.opts.titulo);
    this.modalEl.addClass("gf-modal-etiquetas");
    this.render();
  }
  listaActiva() {
    var _a, _b;
    if (this.opts.porEpica)
      return this.listaEpica;
    const secs = (_a = this.opts.secciones) != null ? _a : [];
    const sec = (_b = secs.find((s) => s.id === this.tab)) != null ? _b : secs[0];
    return sec ? sec.getLista() : [];
  }
  render() {
    var _a, _b, _c;
    this.contentEl.empty();
    if (this.opts.porEpica) {
      this.renderSelectorEpica();
      if (!this.epicaActual) {
        this.contentEl.createEl("em", { cls: "gf-campo-aviso", text: "Selecciona una \xE9pica." });
        return;
      }
    } else if (((_b = (_a = this.opts.secciones) == null ? void 0 : _a.length) != null ? _b : 0) > 1) {
      const tabs = this.contentEl.createDiv({ cls: "gf-etq-tabs" });
      for (const sec of (_c = this.opts.secciones) != null ? _c : []) {
        const t = tabs.createEl("button", {
          cls: "gf-etq-tab" + (this.tab === sec.id ? " gf-etq-tab-on" : ""),
          text: sec.titulo
        });
        t.addEventListener("click", () => {
          this.tab = sec.id;
          this.seleccionado = null;
          this.render();
        });
      }
    }
    const barra = this.contentEl.createDiv({ cls: "gf-etq-barra" });
    const add = barra.createEl("button", { cls: "gf-etq-btn", text: "\uFF0B" });
    add.setAttr("title", "Agregar");
    add.addEventListener("click", () => void this.agregar());
    const del = barra.createEl("button", { cls: "gf-etq-btn", text: "\uFF0D" });
    del.setAttr("title", "Eliminar el seleccionado");
    del.disabled = this.seleccionado === null;
    del.addEventListener("click", () => void this.eliminarSeleccion());
    this.delBtn = del;
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
  renderSelectorEpica() {
    var _a, _b;
    const por = this.opts.porEpica;
    if (!por)
      return;
    const wrap = this.contentEl.createDiv({ cls: "gf-campo gf-etq-epica" });
    wrap.createEl("label", { text: "\xC9pica", cls: "gf-campo-label" });
    const sel = wrap.createEl("select", { cls: "dropdown gf-campo-select" });
    sel.createEl("option", { text: "Seleccionar \xE9pica", value: "" });
    for (const ep of por.epicas)
      sel.createEl("option", { text: ep.nombre, value: ep.slug });
    sel.value = (_b = (_a = this.epicaActual) == null ? void 0 : _a.slug) != null ? _b : "";
    sel.addEventListener("change", () => {
      var _a2;
      const ep = (_a2 = por.epicas.find((e) => e.slug === sel.value)) != null ? _a2 : null;
      this.epicaActual = ep;
      this.listaEpica = ep ? por.cargar(ep) : [];
      this.seleccionado = null;
      this.render();
    });
  }
  /** Cambia la fila seleccionada sin reconstruir la tabla, para no cerrar el
   * desplegable de color ni el campo de renombrado abiertos. */
  seleccionar(i) {
    this.seleccionado = i;
    this.filas.forEach((tr, idx) => tr.toggleClass("gf-etq-sel", idx === i));
    if (this.delBtn)
      this.delBtn.disabled = i === null || !this.puedeEliminar(i);
  }
  /** ¿El elemento del índice puede eliminarse? (protege los carriles por defecto). */
  puedeEliminar(i) {
    const item = this.listaActiva()[i];
    return !item || !this.opts.puedeEliminar ? true : this.opts.puedeEliminar(item);
  }
  renderFila(tbody, et, i) {
    var _a;
    const tr = tbody.createEl("tr", {
      cls: "gf-etq-fila" + (this.seleccionado === i ? " gf-etq-sel" : "")
    });
    this.filas.push(tr);
    tr.addEventListener("click", () => {
      this.seleccionar(this.seleccionado === i ? null : i);
    });
    const tdColor = tr.createEl("td", { cls: "gf-etq-color" });
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
    tdNombre.addEventListener("dblclick", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.seleccionar(i);
      this.editarNombre(tdNombre, nombre, i);
    });
    if (this.editarAlAgregar === i) {
      this.editarAlAgregar = null;
      window.setTimeout(() => this.editarNombre(tdNombre, nombre, i), 0);
    }
    if (this.opts.conVisible) {
      const tdVis = tr.createEl("td", { cls: "gf-etq-visible-td" });
      tdVis.addEventListener("click", (e) => e.stopPropagation());
      const chk = tdVis.createEl("input", { type: "checkbox" });
      chk.checked = et.visible !== false;
      chk.setAttr(
        "title",
        (_a = this.opts.tituloVisible) != null ? _a : this.opts.porEpica ? "Disponible para asignar a historias" : "Visible"
      );
      chk.addEventListener("change", () => void (async () => {
        et.visible = chk.checked;
        await this.guardar();
      })());
    }
  }
  async agregar() {
    var _a;
    const items = this.listaActiva();
    const base = (_a = this.opts.nuevoNombre) != null ? _a : "Etiqueta";
    let n = 1;
    let nombre = `${base} ${n}`;
    while (items.some((e) => e.nombre === nombre))
      nombre = `${base} ${++n}`;
    const color = colorAleatorio();
    items.push(this.opts.nuevoItem ? this.opts.nuevoItem(nombre, color) : { nombre, color });
    await this.guardar();
    this.seleccionado = items.length - 1;
    this.editarAlAgregar = this.seleccionado;
    this.render();
  }
  eliminarSeleccion() {
    if (this.seleccionado === null)
      return;
    const items = this.listaActiva();
    const idx = this.seleccionado;
    const item = items[idx];
    if (!item || !this.puedeEliminar(idx))
      return;
    const nombreItem = item.nombre;
    const mensaje = `\xBFEliminar "${nombreItem}"?`;
    new ConfirmarModal(this.app, mensaje, this.opts.avisoEliminar, async () => {
      var _a, _b, _c, _d;
      items.splice(idx, 1);
      this.seleccionado = null;
      await this.guardar();
      try {
        if (this.opts.porEpica) {
          if (this.epicaActual)
            await ((_b = (_a = this.opts.porEpica).eliminar) == null ? void 0 : _b.call(_a, this.epicaActual, nombreItem));
        } else {
          await ((_d = (_c = this.opts).alEliminar) == null ? void 0 : _d.call(_c, nombreItem));
        }
      } catch (e) {
        console.error(e);
      }
      this.render();
    }).open();
  }
  editarNombre(tdNombre, nombre, indice) {
    const items = this.listaActiva();
    const original = items[indice].nombre;
    const input = createEl("input", { type: "text", cls: "gf-etq-input", value: original });
    input.maxLength = _GestorEtiquetasModal.LARGO_MAX;
    nombre.replaceWith(input);
    const error = tdNombre.createDiv({ cls: "gf-campo-error" });
    error.hide();
    input.focus();
    input.select();
    let terminado = false;
    const confirmar = async () => {
      var _a, _b, _c, _d;
      if (terminado)
        return;
      const valor = input.value.trim();
      if (!valor || valor === original) {
        terminado = true;
        this.render();
        return;
      }
      if (valor.length > _GestorEtiquetasModal.LARGO_MAX) {
        error.setText(`M\xE1ximo ${_GestorEtiquetasModal.LARGO_MAX} caracteres.`);
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
      try {
        if (this.opts.porEpica) {
          if (this.epicaActual) {
            await ((_b = (_a = this.opts.porEpica).renombrar) == null ? void 0 : _b.call(_a, this.epicaActual, original, valor));
          }
        } else {
          await ((_d = (_c = this.opts).alRenombrar) == null ? void 0 : _d.call(_c, original, valor));
        }
      } catch (e) {
        console.error(e);
      }
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
  onClose() {
    var _a, _b;
    this.contentEl.empty();
    (_b = (_a = this.opts).onCerrar) == null ? void 0 : _b.call(_a);
  }
};
/** Longitud permitida para el nombre de una etiqueta. */
_GestorEtiquetasModal.LARGO_MIN = 1;
_GestorEtiquetasModal.LARGO_MAX = 50;
var GestorEtiquetasModal = _GestorEtiquetasModal;
var ConfirmarModal = class extends import_obsidian3.Modal {
  constructor(app, mensaje, aviso, onConfirmar) {
    super(app);
    this.mensaje = mensaje;
    this.aviso = aviso;
    this.onConfirmar = onConfirmar;
  }
  onOpen() {
    this.titleEl.setText("Confirmar");
    this.contentEl.createEl("p", { text: this.mensaje });
    if (this.aviso)
      this.contentEl.createEl("p", { cls: "gf-campo-aviso", text: this.aviso });
    const row = this.contentEl.createDiv({ cls: "gf-botones" });
    const cancelar = row.createEl("button", { text: "Cancelar" });
    cancelar.addEventListener("click", () => this.close());
    const ok = row.createEl("button", { text: "Eliminar", cls: "mod-warning" });
    ok.addEventListener("click", () => {
      this.close();
      void this.onConfirmar();
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/settings.ts
var CARRIL_DOCS_TODOS = "todos";
var NUM_SPRINTS_DEFECTO = 24;
var COLOR_ETIQUETA_DEFECTO = "#5082ff";
var COLABORADOR_DEFECTO = { nombre: "Yo", color: "#2D9CFF" };
var INCIDENCIAS_DEFECTO = [
  { nombre: "Tarea", color: "#2D9CFF", visible: true },
  { nombre: "Pendiente", color: "#FF9F2E", visible: true },
  { nombre: "Bug", color: "#FA4D56", visible: true }
];
var DOCUMENTOS_DEFECTO = [
  { nombre: "Documento", color: "#2D9CFF", visible: true },
  { nombre: "Apunte de reuni\xF3n", color: "#C950E8", visible: true },
  { nombre: "Regla de negocio", color: "#2BC275", visible: true }
];
var CARRILES_DEFECTO = [
  { nombre: "Backlog", valor: "backlog", color: "#B9BEC6", visible: true },
  { nombre: "Por hacer", valor: "por-hacer", color: "#FFC93C", visible: true },
  { nombre: "En progreso", valor: "en-progreso", color: "#2D9CFF", visible: true },
  { nombre: "Hecho", valor: "completado", color: "#2BC275", visible: true }
];
var ESTADO_LEGACY = { pendiente: "por-hacer" };
function normalizarEstado(valor) {
  var _a;
  return (_a = ESTADO_LEGACY[valor]) != null ? _a : valor;
}
var DEFAULT_SETTINGS = {
  carpetaAdmin: CARPETA_ACTIVAS,
  etiquetas: [],
  carriles: CARRILES_DEFECTO.map((c) => ({ ...c })),
  colaboradores: [{ ...COLABORADOR_DEFECTO }],
  incidencias: INCIDENCIAS_DEFECTO.map((i) => ({ ...i })),
  documentos: DOCUMENTOS_DEFECTO.map((i) => ({ ...i })),
  numSprints: NUM_SPRINTS_DEFECTO,
  favoritos: [],
  ordenFunc: [],
  ordenIncidenciasColab: [],
  ordenGruposDocumentos: [],
  organizacionDocs: {},
  sprintActual: { anio: (/* @__PURE__ */ new Date()).getFullYear(), sprint: 1 },
  kanban: {
    tareas: {},
    pendientes: {},
    ordenIncidencias: [],
    filtroSprints: { desde: 1, hasta: NUM_SPRINTS_DEFECTO }
  }
};
var GestorSettingTab = class extends import_obsidian4.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian4.Setting(containerEl).setName("Configuraci\xF3n del Sprint").setHeading();
    this.renderSprintCard(containerEl);
    this.renderTarjeta(
      "Tipos de incidencia",
      "Configura los tipos de incidencia disponibles al crear incidencias.",
      [
        {
          texto: "Configurar incidencias\u2026",
          onClick: () => this.plugin.abrirModal("configIncidencias")
        }
      ]
    );
    this.renderTarjeta(
      "Tipos de documento",
      "Configura los tipos de documento disponibles al crear documentos.",
      [
        {
          texto: "Configurar documentos\u2026",
          onClick: () => this.plugin.abrirModal("configDocumentos")
        }
      ]
    );
    this.renderTarjeta(
      "Importar / exportar configuraci\xF3n",
      "Descarga o carga la configuraci\xF3n del plugin en un archivo .json.",
      [
        { texto: "Exportar\u2026", onClick: () => new ExportarConfigModal(this.plugin).open() },
        {
          texto: "Importar\u2026",
          onClick: () => new ImportarConfigModal(this.plugin, () => this.display()).open()
        }
      ]
    );
    new import_obsidian4.Setting(containerEl).setName("Apoyar el desarrollo").setDesc("Si este plugin te resulta \xFAtil, puedes invitarme un caf\xE9.").addButton(
      (btn) => btn.setButtonText("Buy Me a Coffee").setCta().onClick(() => {
        window.open("https://buymeacoffee.com/leonardoruano");
      })
    );
  }
  /** Tarjeta con título, descripción a la izquierda y botones a la derecha. */
  renderTarjeta(titulo, desc, acciones) {
    new import_obsidian4.Setting(this.containerEl).setName(titulo).setHeading();
    const card = this.containerEl.createDiv({ cls: "gf-sprint-card" });
    const fila = card.createDiv({ cls: "gf-card-fila" });
    fila.createEl("span", { cls: "gf-card-desc", text: desc });
    for (const a of acciones) {
      const btn = fila.createEl("button", { cls: "gf-sprint-card-btn", text: a.texto });
      btn.addEventListener("click", a.onClick);
    }
  }
  // ----- Configuración del Sprint (tarjeta) -----
  /** Tarjeta que reúne el número de sprints y el acceso a las etiquetas de
   * sprint, con un estilo de bloque destacado. */
  renderSprintCard(cont) {
    const card = cont.createDiv({ cls: "gf-sprint-card" });
    card.createEl("p", {
      cls: "gf-sprint-card-desc",
      text: `Aqu\xED puedes configurar el n\xFAmero de sprints que se incluyen en tu roadmap. Las etiquetas que agregues pueden asignarse a cada sprint para identificarlos visualmente.`
    });
    const fila = card.createDiv({ cls: "gf-sprint-card-fila" });
    fila.createEl("label", { cls: "gf-sprint-card-label", text: "N\xFAmero de sprints" });
    const input = fila.createEl("input", { type: "number", cls: "gf-sprint-card-input" });
    input.min = "1";
    input.value = String(this.plugin.settings.numSprints);
    const guardar = async () => {
      let n = Math.trunc(Number(input.value));
      if (!Number.isFinite(n) || n < 1)
        n = 1;
      input.value = String(n);
      this.plugin.settings.numSprints = n;
      const f = this.plugin.settings.kanban.filtroSprints;
      if (f.hasta > n)
        f.hasta = n;
      if (f.desde > n)
        f.desde = n;
      await this.plugin.saveSettings();
    };
    input.addEventListener("change", () => void guardar());
    const btn = fila.createEl("button", {
      cls: "gf-sprint-card-btn",
      text: "Configurar equipos\u2026"
    });
    btn.addEventListener(
      "click",
      () => new GestorEtiquetasModal(this.plugin, {
        titulo: "Configurar equipos",
        conVisible: true,
        avisoEliminar: "Se quitar\xE1 de todos los sprints donde est\xE9 asignada. No se elimina ninguna carpeta.",
        alRenombrar: (ant, nue) => renombrarEtiquetaSprint(this.plugin.app, this.plugin.settings.carpetaAdmin, ant, nue),
        alEliminar: (nombre) => eliminarEtiquetaSprint(this.plugin.app, this.plugin.settings.carpetaAdmin, nombre),
        secciones: [
          {
            id: "sprint",
            titulo: "Etiquetas de sprint",
            getLista: () => this.plugin.settings.etiquetas
          }
        ]
      }).open()
    );
  }
};

// src/dashboard.ts
var import_obsidian5 = require("obsidian");
var SECCIONES_GESTIONADAS = ["Tareas", "Pendientes"];
function registerDashboard(plugin) {
  plugin.registerMarkdownPostProcessor((el, ctx) => {
    var _a, _b, _c;
    const fm = (_a = plugin.app.metadataCache.getCache(ctx.sourcePath)) == null ? void 0 : _a.frontmatter;
    if (!fm || fm.tipo !== "epica" && fm.tipo !== "funcionalidad" && fm.tipo !== "historia") {
      return;
    }
    const h2 = el.querySelector("h2");
    const titulo = (_c = (_b = h2 == null ? void 0 : h2.textContent) == null ? void 0 : _b.trim()) != null ? _c : "";
    if (h2 && SECCIONES_GESTIONADAS.includes(titulo)) {
      const funcFolder = carpetaDeFuncionalidad(plugin, ctx.sourcePath);
      if (!funcFolder)
        return;
      h2.createSpan({ cls: "gf-contador", text: ` (${contar(plugin, funcFolder, titulo)})` });
      const cont = el.createDiv({ cls: "gf-dash" });
      h2.insertAdjacentElement("afterend", cont);
      renderSeccion(plugin, cont, funcFolder, ctx.sourcePath, titulo);
      return;
    }
    const info = ctx.getSectionInfo(el);
    if (info && enSeccionGestionada(info.text, info.lineStart)) {
      el.addClass("gf-hidden");
    }
  });
}
function carpetaDeFuncionalidad(plugin, sourcePath) {
  const main = plugin.app.vault.getAbstractFileByPath(sourcePath);
  if (!(main instanceof import_obsidian5.TFile) || !main.parent)
    return null;
  return main.parent;
}
function enSeccionGestionada(textoCompleto, linea) {
  const lines = textoCompleto.split("\n");
  let actual = null;
  for (let i = 0; i <= linea && i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+(.*)$/);
    if (m) {
      actual = m[1].length === 2 ? m[2].trim() : null;
    }
  }
  return actual !== null && SECCIONES_GESTIONADAS.includes(actual);
}
function contar(plugin, funcFolder, titulo) {
  if (titulo === "Tareas") {
    const dir = funcFolder.children.find(
      (c) => c instanceof import_obsidian5.TFolder && c.name === "tareas"
    );
    if (!dir)
      return 0;
    return dir.children.filter((c) => c instanceof import_obsidian5.TFolder).length;
  }
  return listPendientes(plugin.app, funcFolder).length;
}
function renderSeccion(plugin, cont, funcFolder, sourcePath, titulo) {
  if (titulo === "Tareas") {
    renderTareas(plugin, cont, funcFolder, sourcePath);
  } else {
    renderPendientes(plugin, cont, funcFolder, sourcePath);
  }
}
function renderTareas(plugin, cont, funcFolder, sourcePath) {
  const tareas = listTareas(plugin.app, funcFolder);
  if (tareas.length === 0) {
    cont.createEl("em", { text: "Sin tareas a\xFAn." });
    return;
  }
  const ul = cont.createEl("ul", { cls: "gf-lista-tareas contains-task-list" });
  for (const t of tareas) {
    itemTarea(plugin, ul, t.file, t.nombre, sourcePath);
  }
}
function renderPendientes(plugin, cont, funcFolder, sourcePath) {
  const app = plugin.app;
  const pendientes = listPendientes(app, funcFolder);
  if (pendientes.length === 0) {
    cont.createEl("em", { text: "Sin pendientes a\xFAn." });
    return;
  }
  const items = pendientes.map((p) => {
    var _a, _b, _c;
    const fm = (_a = app.metadataCache.getFileCache(p.file)) == null ? void 0 : _a.frontmatter;
    const fechaFm = (fm == null ? void 0 : fm.fecha) ? String(fm.fecha).slice(0, 10) : "";
    const fecha = fechaFm || ((_c = (_b = p.slug.match(/^\d{4}-\d{2}-\d{2}/)) == null ? void 0 : _b[0]) != null ? _c : "");
    return { ...p, fecha };
  });
  items.sort((a, b) => b.fecha.localeCompare(a.fecha));
  const ul = cont.createEl("ul", { cls: "contains-task-list" });
  for (const p of items) {
    const li = itemTarea(plugin, ul, p.file, p.nombre, sourcePath);
    if (p.fecha)
      li.appendText(` \u2014 ${p.fecha}`);
  }
}
function itemTarea(plugin, ul, file, nombre, sourcePath) {
  var _a, _b;
  const app = plugin.app;
  const completado = ((_b = (_a = app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter) == null ? void 0 : _b.estado) === "completado";
  const li = ul.createEl("li", { cls: "task-list-item gf-tarea-item" });
  if (completado)
    li.addClass("is-checked");
  const cb = li.createEl("input", { type: "checkbox", cls: "task-list-item-checkbox" });
  cb.checked = completado;
  cb.addEventListener("change", () => {
    void app.fileManager.processFrontMatter(file, (f) => {
      f.estado = cb.checked ? "completado" : "por-hacer";
    });
    li.toggleClass("is-checked", cb.checked);
  });
  const a = li.createEl("a", { cls: "internal-link", text: nombre });
  a.addEventListener("click", (e) => {
    e.preventDefault();
    void app.workspace.openLinkText(file.path, sourcePath);
  });
  return li;
}

// src/acciones.ts
var import_obsidian7 = require("obsidian");

// src/icono.ts
var ICONO_PLUGIN = "gestion-producto";
var ICONO_MATERIAL = (d) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path fill="currentColor" d="${d}"/></svg>`;
var ICONOS_TAB = {
  favoritos: ICONO_MATERIAL(
    "m233-120 65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Z"
  ),
  // Icono de épicas: espadas cruzadas (Material Symbols).
  epicas: ICONO_MATERIAL(
    "M762-96 645-212l-88 88-28-28q-23-23-23-57t23-57l169-169q23-23 57-23t57 23l28 28-88 88 116 117q12 12 12 28t-12 28l-50 50q-12 12-28 12t-28-12Zm118-628L426-270l5 4q23 23 23 57t-23 57l-28 28-88-88L198-96q-12 12-28 12t-28-12l-50-50q-12-12-12-28t12-28l116-117-88-88 28-28q23-23 57-23t57 23l4 5 454-454h160v160ZM334-583l24-23 23-24-23 24-24 23Zm-56 57L80-724v-160h160l198 198-57 56-174-174h-47v47l174 174-56 57Zm92 199 430-430v-47h-47L323-374l47 47Zm0 0-24-23-23-24 23 24 24 23Z"
  ),
  incidencias: ICONO_MATERIAL(
    "M400-120q-17 0-28.5-11.5T360-160v-480H160q0-83 58.5-141.5T360-840h240v120l120-120h80v320h-80L600-640v480q0 17-11.5 28.5T560-120H400Zm40-80h80v-240h-80v240Zm0-320h80v-240H360q-26 0-49 10.5T271-720h169v200Zm40 40Z"
  ),
  colaboradores: ICONO_MATERIAL(
    "M360-80v-529q-91-24-145.5-100.5T160-880h80q0 83 53.5 141.5T430-680h100q30 0 56 11t47 32l181 181-56 56-158-158v478h-80v-240h-80v240h-80Zm63.5-663.5Q400-767 400-800t23.5-56.5Q447-880 480-880t56.5 23.5Q560-833 560-800t-23.5 56.5Q513-720 480-720t-56.5-23.5Z"
  )
};
function crearIconoTab(parent, id) {
  const markup = ICONOS_TAB[id];
  if (!markup)
    return;
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  const svg = doc.documentElement;
  if (svg.nodeName.toLowerCase() !== "svg")
    return;
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "18");
  parent.appendChild(activeDocument.importNode(svg, true));
}
var ICONO_PLUGIN_SVG = `<g transform="scale(0.19230769)" fill="currentColor"><g transform="matrix(1.472877,0,0,1.51955,-204.704019,-73.839992)"><path d="M311.84,336.445C310.777,341.514 306.122,345.335 300.548,345.335C294.19,345.335 289.029,340.364 289.029,334.241L289.029,259.925L226.583,304.643C221.543,308.252 214.409,307.09 210.661,302.05C206.913,297.01 207.963,289.988 213.003,286.379L289.029,231.936L289.029,183.801L213.907,183.801C207.667,183.801 202.602,178.736 202.602,172.497C202.602,166.257 207.667,161.192 213.907,161.192L268.038,161.192L221.755,128.048C216.715,124.439 215.666,117.416 219.413,112.377C223.161,107.337 230.296,106.175 235.336,109.784L307.123,161.192L323.893,161.192L395.68,109.784C400.72,106.175 407.854,107.337 411.602,112.377C415.35,117.416 414.301,124.439 409.261,128.048L362.977,161.192L417.109,161.192C423.348,161.192 428.414,166.257 428.414,172.497C428.414,178.736 423.348,183.801 417.109,183.801L341.987,183.801L341.987,231.936L418.013,286.379C423.053,289.988 424.102,297.01 420.354,302.05C416.607,307.09 409.472,308.252 404.432,304.643L341.987,259.925L341.987,334.241C341.987,340.364 336.825,345.335 330.467,345.335C324.893,345.335 320.239,341.514 319.176,336.445L319.176,244.305L319.162,244.305C318.997,242.49 317.423,241.064 315.508,241.064C313.592,241.064 312.018,242.49 311.854,244.305L311.84,244.305L311.84,336.445ZM315.508,151.615C303.155,151.615 293.125,141.773 293.125,129.65C293.125,117.527 303.155,107.685 315.508,107.685C327.861,107.685 337.89,117.527 337.89,129.65C337.89,141.773 327.861,151.615 315.508,151.615Z"/></g><g transform="matrix(1.472877,0,0,1.491196,-136.582285,-55.779129)"><path d="M269.257,50.911C358.057,50.911 430.194,122.963 430.194,211.762C430.194,300.562 358.057,372.614 269.257,372.614C180.457,372.614 108.32,300.562 108.32,211.762C108.32,122.963 180.457,50.911 269.257,50.911ZM269.257,64.695C188.112,64.695 122.276,130.617 122.276,211.762C122.276,292.907 188.112,358.829 269.257,358.829C350.402,358.829 416.238,292.907 416.238,211.762C416.238,130.617 350.402,64.695 269.257,64.695Z"/></g></g>`;

// src/ui.ts
var import_obsidian6 = require("obsidian");
function habilitarScrollHorizontal(cont) {
  cont.addEventListener(
    "wheel",
    (e) => {
      if (e.deltaY === 0 || e.shiftKey)
        return;
      if (cont.scrollWidth <= cont.clientWidth)
        return;
      cont.scrollLeft += e.deltaY;
      e.preventDefault();
    },
    { passive: false }
  );
  let dir = 0;
  let timer = null;
  const parar = () => {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
    dir = 0;
  };
  cont.addEventListener("dragover", (e) => {
    const r = cont.getBoundingClientRect();
    const margen = 64;
    if (e.clientX < r.left + margen)
      dir = -1;
    else if (e.clientX > r.right - margen)
      dir = 1;
    else
      dir = 0;
    if (dir !== 0 && timer === null) {
      timer = window.setInterval(() => {
        cont.scrollLeft += dir * 16;
      }, 16);
    } else if (dir === 0) {
      parar();
    }
  });
  cont.addEventListener("dragleave", parar);
  cont.addEventListener("drop", parar);
  cont.addEventListener("dragend", parar);
}
function crearMultiSelect(opts) {
  const wrap = opts.parent.createDiv({ cls: "gf-multiselect" });
  const btn = wrap.createEl("button", { cls: "gf-multiselect-btn" });
  const panel = wrap.createDiv({ cls: "gf-multiselect-panel" });
  let abierto = false;
  const onDocClick = (ev) => {
    if (!wrap.contains(ev.target))
      setAbierto(false);
  };
  const setAbierto = (v) => {
    abierto = v;
    panel.toggleClass("gf-multiselect-abierto", v);
    if (v)
      activeDocument.addEventListener("click", onDocClick);
    else
      activeDocument.removeEventListener("click", onDocClick);
  };
  setAbierto(false);
  const actualizarLabel = () => {
    const total = opts.opciones.length;
    const n = opts.opciones.filter((o) => opts.seleccion.has(o.valor)).length;
    const resumen = total > 0 && n === total ? "Todos" : n === 0 ? "Ninguno" : `${n} sel.`;
    btn.setText(`${opts.etiqueta}: ${resumen} \u25BE`);
  };
  for (const o of opts.opciones) {
    const fila = panel.createEl("label", { cls: "gf-chk" });
    const chk = fila.createEl("input", { type: "checkbox" });
    chk.checked = opts.seleccion.has(o.valor);
    fila.appendText(` ${o.texto}`);
    chk.addEventListener("change", () => {
      if (chk.checked)
        opts.seleccion.add(o.valor);
      else
        opts.seleccion.delete(o.valor);
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
function crearSelect(opts) {
  var _a, _b, _c, _d;
  const wrap = opts.parent.createDiv({ cls: "gf-multiselect gf-select" });
  const btn = wrap.createEl("button", { cls: "gf-multiselect-btn" });
  const panel = createDiv({ cls: "gf-multiselect-panel gf-select-panel-float" });
  let opciones = opts.opciones;
  let valor = (_c = (_b = opts.valor) != null ? _b : (_a = opciones[0]) == null ? void 0 : _a.valor) != null ? _c : "";
  let disabled = (_d = opts.disabled) != null ? _d : false;
  let abierto = false;
  const onDocClick = (ev) => {
    const t = ev.target;
    if (!panel.contains(t) && t !== btn && !btn.contains(t))
      cerrar();
  };
  const onKey = (ev) => {
    if (ev.key === "Escape")
      cerrar();
  };
  const onScroll = (ev) => {
    if (!panel.contains(ev.target))
      cerrar();
  };
  function cerrar() {
    if (!abierto)
      return;
    abierto = false;
    panel.remove();
    activeDocument.removeEventListener("click", onDocClick, true);
    window.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", cerrar);
    activeDocument.removeEventListener("keydown", onKey, true);
  }
  function abrir() {
    if (abierto || disabled)
      return;
    activeDocument.body.appendChild(panel);
    const r = btn.getBoundingClientRect();
    panel.setCssStyles({
      top: `${r.bottom + 4}px`,
      left: `${r.left}px`,
      minWidth: `${r.width}px`,
      display: "block"
    });
    abierto = true;
    window.setTimeout(() => {
      activeDocument.addEventListener("click", onDocClick, true);
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", cerrar);
      activeDocument.addEventListener("keydown", onKey, true);
    }, 0);
  }
  const setAbierto = (v) => {
    if (v && !disabled)
      abrir();
    else
      cerrar();
  };
  const textoDe = (v) => {
    var _a2, _b2;
    return (_b2 = (_a2 = opciones.find((o) => o.valor === v)) == null ? void 0 : _a2.texto) != null ? _b2 : "\u2014";
  };
  const pintarBtn = () => {
    btn.setText(`${textoDe(valor)} \u25BE`);
    btn.toggleClass("gf-select-disabled", disabled);
  };
  const pintarPanel = () => {
    panel.empty();
    for (const o of opciones) {
      const fila = panel.createEl("button", {
        cls: "gf-select-opcion" + (o.valor === valor ? " gf-select-opcion-on" : ""),
        text: o.texto
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
    if (!disabled)
      setAbierto(!abierto);
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
      var _a2, _b2;
      opciones = ops;
      if (v !== void 0)
        valor = v;
      else if (!opciones.some((o) => o.valor === valor))
        valor = (_b2 = (_a2 = opciones[0]) == null ? void 0 : _a2.valor) != null ? _b2 : "";
      pintarBtn();
      pintarPanel();
    },
    setDisabled: (d) => {
      disabled = d;
      if (d)
        setAbierto(false);
      pintarBtn();
    }
  };
}
var AnioPickerModal = class extends import_obsidian6.Modal {
  constructor(app, anio, onPick) {
    super(app);
    this.anio = anio;
    this.onPick = onPick;
    this.base = anio - anio % 12;
  }
  onOpen() {
    this.titleEl.setText("Seleccionar a\xF1o");
    this.render();
  }
  render() {
    this.contentEl.empty();
    const nav = this.contentEl.createDiv({ cls: "gf-anio-nav" });
    const prev = nav.createEl("button", { text: "\u2039" });
    nav.createEl("span", { text: `${this.base} \u2013 ${this.base + 11}`, cls: "gf-anio-rango" });
    const next = nav.createEl("button", { text: "\u203A" });
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
        cls: "gf-anio-celda" + (y === this.anio ? " gf-anio-on" : "")
      });
      b.addEventListener("click", () => {
        this.onPick(y);
        this.close();
      });
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/acciones.ts
var VIEW_TYPE_ACCIONES = "gestor-funciones-acciones";
var REGISTRO = [
  // Épicas — administración
  { id: "crear-epica", icono: "folder-plus", texto: "Crear \xE9pica", accion: (p) => p.abrirModal("funcionalidad") },
  { id: "crear-funcionalidad", icono: "puzzle", texto: "Crear historia", accion: (p) => p.abrirModal("crearfn") },
  { id: "asignar-sprint", icono: "calendar-days", texto: "Asignar sprint", accion: (p) => p.abrirModal("sprint") },
  { id: "asignar-etiquetas", icono: "tag", texto: "Etiquetas de historias", accion: (p) => void p.abrirEtiquetarHistorias() },
  { id: "editar-nombre", icono: "pencil", texto: "Editar nombre", accion: (p) => p.abrirModal("editarNombre") },
  { id: "mover-historia", icono: "folder-tree", texto: "Historias", accion: (p) => void p.abrirHistorias() },
  { id: "archivar-epica", icono: "archive", texto: "Archivar \xE9picas", accion: (p) => p.abrirModal("mover") },
  { id: "eliminar-epica-historia", icono: "trash-2", texto: "Eliminar \xE9pica o historia", accion: (p) => p.abrirModal("eliminarEpicaHistoria") },
  // Épicas — tableros
  { id: "roadmap", icono: "map", texto: "Roadmap", accion: (p) => void p.abrirRoadmap() },
  { id: "gestor-funcionalidades", icono: "calendar-range", texto: "Planeaci\xF3n", accion: (p) => void p.abrirGestorFuncionalidades() },
  // Incidencias
  { id: "crear-incidencia", icono: "circle-dot", texto: "Crear incidencia", accion: (p) => p.abrirModal("incidencia") },
  { id: "editar-incidencia", icono: "replace", texto: "Editar incidencia", accion: (p) => p.abrirModal("editarIncidencia") },
  { id: "eliminar-incidencia", icono: "trash-2", texto: "Eliminar incidencia", accion: (p) => p.abrirModal("eliminarIncidencia") },
  // Documentos
  { id: "crear-documento", icono: "file-plus", texto: "Crear documento", accion: (p) => p.abrirModal("documento") },
  { id: "editar-documento", icono: "replace", texto: "Editar documento", accion: (p) => p.abrirModal("editarDocumento") },
  { id: "eliminar-documento", icono: "trash-2", texto: "Eliminar documento", accion: (p) => p.abrirModal("eliminarDocumento") },
  { id: "documentos", icono: "file-text", texto: "Documentos por \xE9pica", accion: (p) => void p.abrirDocumentos() },
  { id: "organizar-documentos", icono: "layout-grid", texto: "Tablero de documentos", accion: (p) => void p.abrirOrganizarDocumentos() },
  // Colaboradores
  { id: "colaboradores", icono: "users", texto: "Configurar colaboradores", accion: (p) => p.abrirModal("colaboradores") },
  { id: "asignar-colaborador", icono: "user-plus", texto: "Asignar colaborador", accion: (p) => p.abrirModal("asignar") },
  // Tableros por colaborador. El tablero "Gestión de incidencias" (kanban) se
  // dejó oculto del panel a propósito; sigue accesible por comando
  // ("Abrir gestión de incidencias") y se puede reactivar añadiéndolo a una sección.
  { id: "incidencias-por-colaborador", icono: "user-check", texto: "Incidencias por colaborador", accion: (p) => void p.abrirTareasColaborador() }
];
var POR_ID = new Map(REGISTRO.map((a) => [a.id, a]));
var SECCIONES_PANEL = [
  { id: "epicas-admin", titulo: "Administraci\xF3n", acciones: ["crear-epica", "crear-funcionalidad", "asignar-sprint"] },
  { id: "epicas-colaboradores", titulo: "Colaboradores", acciones: ["colaboradores", "asignar-colaborador"] },
  { id: "epicas-acciones", titulo: "Acciones", acciones: ["editar-nombre", "archivar-epica", "eliminar-epica-historia"] },
  { id: "epicas-tableros", titulo: "Tableros", acciones: ["roadmap", "mover-historia", "asignar-etiquetas", "gestor-funcionalidades"] },
  { id: "incidencias", titulo: "Incidencias", acciones: ["crear-incidencia", "editar-incidencia", "eliminar-incidencia"] },
  { id: "documentos", titulo: "Documentos", acciones: ["crear-documento", "editar-documento", "eliminar-documento"] },
  { id: "incidencias-tableros", titulo: "Tableros", acciones: ["incidencias-por-colaborador", "documentos", "organizar-documentos"] }
];
var TABS = [
  { id: "favoritos", titulo: "Favoritos", secciones: [] },
  { id: "epicas", titulo: "\xC9picas", secciones: ["epicas-admin", "epicas-colaboradores", "epicas-acciones", "epicas-tableros"] },
  { id: "incidencias", titulo: "Incidencias", secciones: ["incidencias", "documentos", "incidencias-tableros"] }
];
function resolverAccion(_plugin, id) {
  var _a;
  return (_a = POR_ID.get(id)) != null ? _a : null;
}
function listarTodasLasAcciones(_plugin) {
  return [...REGISTRO];
}
var AccionesView = class extends import_obsidian7.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    /** Pestaña activa; no se persiste entre sesiones. */
    /** Pestaña activa; null hasta el primer render (se elige según haya favoritos). */
    this.tabActiva = null;
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_ACCIONES;
  }
  getDisplayText() {
    return "Gesti\xF3n de \xE9picas";
  }
  getIcon() {
    return ICONO_PLUGIN;
  }
  async onOpen() {
    const refrescar = (file) => {
      if (file.path === CARPETA_ACTIVAS || file.path === CARPETA_INACTIVAS)
        this.render();
    };
    this.registerEvent(this.app.vault.on("create", refrescar));
    this.registerEvent(this.app.vault.on("delete", refrescar));
    this.render();
  }
  /** Acciones de una sección del panel. */
  accionesDeSeccion(secId) {
    const sec = SECCIONES_PANEL.find((s) => s.id === secId);
    if (!sec)
      return [];
    const out = [];
    for (const id of sec.acciones) {
      const a = POR_ID.get(id);
      if (a)
        out.push(a);
    }
    return out;
  }
  render() {
    var _a, _b;
    const cont = this.contentEl;
    cont.empty();
    cont.addClass("gf-acciones");
    if (!carpetasGestionListas(this.app)) {
      const btn = cont.createEl("button", { cls: "gf-accion mod-cta" });
      const icono = btn.createSpan({ cls: "gf-accion-icono" });
      (0, import_obsidian7.setIcon)(icono, "folder-plus");
      btn.createSpan({ text: "Crear carpetas de gesti\xF3n" });
      btn.addEventListener("click", () => void (async () => {
        try {
          await crearCarpetasGestion(this.app);
          new import_obsidian7.Notice("Gesti\xF3n de \xE9picas: carpetas de gesti\xF3n creadas.");
          this.render();
        } catch (e) {
          console.error(e);
          new import_obsidian7.Notice("Gesti\xF3n de \xE9picas: no se pudieron crear las carpetas.");
        }
      })());
      cont.createDiv({
        cls: "gf-campo-aviso",
        text: 'Se crear\xE1n "\xC9picas" y "\xC9picas archivadas" en la ra\xEDz del vault.'
      });
      return;
    }
    this.renderSprintSelector(cont);
    if (this.tabActiva === null) {
      this.tabActiva = this.plugin.settings.favoritos.length > 0 ? "favoritos" : "epicas";
    }
    if (!TABS.some((t) => t.id === this.tabActiva))
      this.tabActiva = "favoritos";
    this.renderTabs(cont);
    const contenido = cont.createDiv({ cls: "gf-tab-contenido" });
    if (this.tabActiva === "favoritos") {
      this.renderFavoritos(contenido);
      return;
    }
    const tab = TABS.find((t) => t.id === this.tabActiva);
    const conEtiqueta = ((_a = tab == null ? void 0 : tab.secciones.length) != null ? _a : 0) > 1;
    for (const secId of (_b = tab == null ? void 0 : tab.secciones) != null ? _b : []) {
      const sec = SECCIONES_PANEL.find((s) => s.id === secId);
      if (!sec)
        continue;
      this.renderSeccion(contenido, conEtiqueta ? sec.titulo : null, this.accionesDeSeccion(secId));
    }
  }
  /** Selector "Sprint en curso": año (datepicker) + sprint. Persiste en ajustes. */
  renderSprintSelector(cont) {
    const s = this.plugin.settings;
    if (s.sprintActual.sprint > s.numSprints)
      s.sprintActual.sprint = s.numSprints;
    const wrap = cont.createDiv({ cls: "gf-acciones-sprint" });
    wrap.createDiv({ cls: "gf-acciones-sprint-titulo", text: "Sprint en curso:" });
    const fila = wrap.createDiv({ cls: "gf-acciones-sprint-fila" });
    const anioBtn = fila.createEl("button", {
      cls: "gf-multiselect-btn gf-acciones-anio",
      text: `${s.sprintActual.anio} \u25BE`
    });
    anioBtn.addEventListener("click", (e) => {
      e.preventDefault();
      new AnioPickerModal(this.app, s.sprintActual.anio, (y) => {
        s.sprintActual.anio = y;
        anioBtn.setText(`${y} \u25BE`);
        void this.plugin.saveSettings();
      }).open();
    });
    const opciones = [];
    for (let n = 1; n <= s.numSprints; n++)
      opciones.push({ valor: String(n), texto: `Sprint ${n}` });
    const sprintWrap = fila.createDiv({ cls: "gf-acciones-sprint-sel" });
    crearSelect({
      parent: sprintWrap,
      opciones,
      valor: String(s.sprintActual.sprint),
      onChange: (v) => {
        s.sprintActual.sprint = Number(v);
        void this.plugin.saveSettings();
      }
    });
  }
  renderTabs(cont) {
    const barra = cont.createDiv({ cls: "gf-tabs" });
    for (const tab of TABS) {
      const btn = barra.createEl("button", {
        cls: "gf-tab" + (this.tabActiva === tab.id ? " gf-tab-activa" : "")
      });
      const icono = btn.createSpan({ cls: "gf-tab-icono" });
      crearIconoTab(icono, tab.id);
      if (tab.id !== "favoritos")
        btn.createSpan({ cls: "gf-tab-texto", text: tab.titulo });
      btn.setAttr("aria-label", tab.titulo);
      btn.addEventListener("click", () => {
        this.tabActiva = tab.id;
        this.render();
      });
    }
  }
  /** Contenido de la pestaña Favoritos: botón ＋ para elegir + lista elegida. */
  renderFavoritos(cont) {
    const favs = this.plugin.settings.favoritos.map((id) => resolverAccion(this.plugin, id)).filter((a) => a !== null);
    const barra = cont.createDiv({ cls: "gf-favoritos-barra" });
    if (favs.length === 0) {
      barra.createSpan({ cls: "gf-campo-aviso", text: "Usa el l\xE1piz para agregar elementos" });
    }
    const add = barra.createEl("button", { cls: "gf-favoritos-add" });
    (0, import_obsidian7.setIcon)(add, "pencil");
    add.setAttr("title", "Editar favoritos");
    add.addEventListener(
      "click",
      () => new FavoritosPickerModal(this.plugin, () => this.render()).open()
    );
    const renderidos = /* @__PURE__ */ new Set();
    for (const sec of SECCIONES_PANEL) {
      const ids = new Set(sec.acciones);
      const delSeccion = favs.filter((a) => ids.has(a.id));
      if (delSeccion.length === 0)
        continue;
      cont.createDiv({ cls: "gf-seccion-label", text: sec.titulo });
      for (const accion of delSeccion) {
        this.renderBoton(cont, accion);
        renderidos.add(accion.id);
      }
    }
    for (const accion of favs) {
      if (!renderidos.has(accion.id))
        this.renderBoton(cont, accion);
    }
  }
  renderSeccion(cont, titulo, acciones) {
    if (titulo)
      cont.createDiv({ cls: "gf-seccion-label", text: titulo });
    if (acciones.length === 0) {
      cont.createDiv({ cls: "gf-campo-aviso", text: "Sin elementos activos." });
      return;
    }
    for (const accion of acciones)
      this.renderBoton(cont, accion);
  }
  renderBoton(cont, accion) {
    const btn = cont.createEl("button", { cls: "gf-accion" });
    const icono = btn.createSpan({ cls: "gf-accion-icono" });
    (0, import_obsidian7.setIcon)(icono, accion.icono);
    btn.createSpan({ text: accion.texto });
    btn.addEventListener("click", () => accion.accion(this.plugin));
  }
};
var FavoritosPickerModal = class extends import_obsidian7.Modal {
  constructor(plugin, onCerrar) {
    super(plugin.app);
    this.plugin = plugin;
    this.onCerrar = onCerrar;
  }
  onOpen() {
    this.titleEl.setText("Favoritos");
    this.contentEl.createEl("p", {
      cls: "gf-campo-aviso",
      text: "Marca los elementos que quieres ver en la secci\xF3n Favoritos."
    });
    const lista = this.contentEl.createDiv({ cls: "gf-panel-items" });
    for (const accion of listarTodasLasAcciones(this.plugin)) {
      const fila = lista.createEl("label", { cls: "gf-chk" });
      const chk = fila.createEl("input", { type: "checkbox" });
      chk.checked = this.plugin.settings.favoritos.includes(accion.id);
      const icono = fila.createSpan({ cls: "gf-accion-icono" });
      (0, import_obsidian7.setIcon)(icono, accion.icono);
      fila.appendText(` ${accion.texto}`);
      chk.addEventListener("change", () => void (async () => {
        const favs = this.plugin.settings.favoritos;
        if (chk.checked) {
          if (!favs.includes(accion.id))
            favs.push(accion.id);
        } else {
          this.plugin.settings.favoritos = favs.filter((x) => x !== accion.id);
        }
        await this.plugin.saveSettings();
      })());
    }
    const row = this.contentEl.createDiv({ cls: "gf-botones" });
    const cerrar = row.createEl("button", { text: "Cerrar", cls: "mod-cta" });
    cerrar.addEventListener("click", () => this.close());
  }
  onClose() {
    this.contentEl.empty();
    this.onCerrar();
  }
};

// src/kanban.ts
var import_obsidian9 = require("obsidian");

// src/modals.ts
var import_obsidian8 = require("obsidian");
var MSG_OBLIGATORIO = "Este campo es obligatorio.";
var MSG_DUPLICADO = "Ya existe un elemento con ese nombre. Haz clic en \xABCrear\xBB otra vez para crearlo con un sufijo num\xE9rico.";
var GestorModal = class extends import_obsidian8.Modal {
  constructor(plugin) {
    super(plugin.app);
    this.plugin = plugin;
  }
  /** Encabezado de sección dentro del modal, para agrupar campos. */
  seccion(texto) {
    this.contentEl.createEl("div", { cls: "gf-modal-seccion", text: texto });
  }
  campoTexto(label, placeholder) {
    const wrap = this.contentEl.createDiv({ cls: "gf-campo" });
    wrap.createEl("label", { text: label, cls: "gf-campo-label" });
    const input = wrap.createEl("input", {
      type: "text",
      cls: "gf-campo-input",
      attr: { placeholder }
    });
    const error = wrap.createDiv({ cls: "gf-campo-error" });
    error.hide();
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (!this.crearBtn.disabled)
          this.crearBtn.click();
      }
    });
    return { wrap, input, error };
  }
  /** Área de texto multilínea (p. ej. para la descripción que va al cuerpo). */
  campoTextArea(label, placeholder) {
    const wrap = this.contentEl.createDiv({ cls: "gf-campo" });
    wrap.createEl("label", { text: label, cls: "gf-campo-label" });
    const input = wrap.createEl("textarea", {
      cls: "gf-campo-input gf-campo-textarea",
      attr: { placeholder, rows: "4" }
    });
    return { wrap, input };
  }
  campoSelect(label, placeholder) {
    const wrap = this.contentEl.createDiv({ cls: "gf-campo" });
    wrap.createEl("label", { text: label, cls: "gf-campo-label" });
    const select = wrap.createEl("select", { cls: "dropdown gf-campo-select" });
    this.setOpciones(select, placeholder, []);
    const error = wrap.createDiv({ cls: "gf-campo-error" });
    error.hide();
    return { wrap, select, error };
  }
  setOpciones(select, placeholder, opciones) {
    select.empty();
    const ph = select.createEl("option", { text: placeholder, value: "" });
    ph.disabled = true;
    ph.selected = true;
    for (const o of opciones) {
      const op = select.createEl("option", { text: o.label, value: o.value });
      if (o.cls)
        op.addClass(o.cls);
    }
  }
  /** Selector de épica con todas las épicas disponibles. */
  campoEpica(funcs) {
    const campo = this.campoSelect("\xC9pica", "Seleccionar \xE9pica");
    this.setOpciones(
      campo.select,
      "Seleccionar \xE9pica",
      funcs.map((f) => ({ value: f.slug, label: f.nombre }))
    );
    return {
      ...campo,
      getFunc: () => funcs.find((f) => f.slug === campo.select.value),
      seleccionar: (slug) => {
        campo.select.value = slug;
        campo.select.dispatchEvent(new Event("change"));
      }
    };
  }
  /**
   * Selector opcional de funcionalidad, dependiente del selector de épica.
   * Sin selección, las acciones operan a nivel de épica.
   */
  campoFuncionalidad(epica) {
    const campo = this.campoSelect("Historia", "Nivel \xE9pica (sin historia)");
    let lista = [];
    const repoblar = () => {
      const f = epica.getFunc();
      lista = f ? listFuncionalidadesDe(this.app, f.folder) : [];
      campo.select.empty();
      const nivel = campo.select.createEl("option", {
        text: "Nivel \xE9pica (sin historia)",
        value: ""
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
      getFn: () => {
        var _a;
        return (_a = lista.find((x) => x.slug === campo.select.value)) != null ? _a : null;
      },
      seleccionar: (slug) => {
        if (!lista.some((x) => x.slug === slug))
          return;
        campo.select.value = slug;
        campo.select.dispatchEvent(new Event("change"));
      }
    };
  }
  /** Chips de colaboradores para asignar al crear una incidencia. Opcional. */
  campoColaboradores() {
    const wrap = this.contentEl.createDiv({ cls: "gf-campo" });
    wrap.createEl("label", { text: "Colaboradores (opcional)", cls: "gf-campo-label" });
    const chipsDiv = wrap.createDiv({ cls: "gf-sprint-chips gf-colab-chips" });
    const seleccion = /* @__PURE__ */ new Set();
    const colaboradores = this.plugin.settings.colaboradores.filter((c) => c.visible !== false);
    const render = () => {
      chipsDiv.empty();
      if (colaboradores.length === 0) {
        chipsDiv.createEl("span", {
          cls: "gf-campo-aviso",
          text: "No hay colaboradores registrados."
        });
        return;
      }
      for (const colab of colaboradores) {
        const activo = seleccion.has(colab.nombre);
        const chip = chipsDiv.createEl("button", {
          text: colab.nombre,
          cls: "gf-chip" + (activo ? " gf-chip-on" : "")
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
          if (activo)
            seleccion.delete(colab.nombre);
          else
            seleccion.add(colab.nombre);
          render();
        });
      }
    };
    render();
    return { getSeleccionados: () => [...seleccion] };
  }
  async aplicarAsignados(file, asignados) {
    if (asignados.length === 0)
      return;
    await this.app.fileManager.processFrontMatter(file, (fm) => {
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
  campoAnio(anioInicial = (/* @__PURE__ */ new Date()).getFullYear(), onChange) {
    let anio = anioInicial;
    const wrap = this.contentEl.createDiv({ cls: "gf-campo" });
    wrap.createEl("label", { text: "A\xF1o", cls: "gf-campo-label" });
    const btn = wrap.createEl("button", { cls: "gf-campo-input gf-anio-btn", text: `${anio} \u25BE` });
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      new AnioPickerModal(this.app, anio, (y) => {
        anio = y;
        btn.setText(`${y} \u25BE`);
        onChange == null ? void 0 : onChange(y);
      }).open();
    });
    return { getAnio: () => anio };
  }
  campoSprintOpcional() {
    const anioCampo = this.campoAnio();
    const wrap = this.contentEl.createDiv({ cls: "gf-campo" });
    wrap.createEl("label", { text: "Asignar sprint", cls: "gf-campo-label" });
    const listaWrap = wrap.createDiv({ cls: "gf-sprints-lista" });
    const edicion = /* @__PURE__ */ new Map();
    renderListaSprints(this.plugin, listaWrap, edicion);
    return {
      getSprints: () => [...edicion.entries()].map(([sprint, etiquetas]) => ({
        anio: anioCampo.getAnio(),
        sprint,
        etiquetas
      }))
    };
  }
  mostrarError(campo, msg) {
    campo.error.setText(msg);
    campo.error.show();
  }
  limpiarError(campo) {
    campo.error.hide();
    campo.error.setText("");
  }
  botones(onCrear, textoPrimario = "Crear") {
    const row = this.contentEl.createDiv({ cls: "gf-botones" });
    const cancelar = row.createEl("button", { text: "Cancelar" });
    cancelar.addEventListener("click", () => this.close());
    this.crearBtn = row.createEl("button", { text: textoPrimario, cls: "mod-cta" });
    this.crearBtn.addEventListener("click", () => void onCrear());
  }
  sinEpicas(func) {
    func.select.disabled = true;
    func.wrap.createDiv({
      cls: "gf-campo-aviso",
      text: "No hay \xE9picas a\xFAn. Crea una primero."
    });
    this.crearBtn.disabled = true;
  }
  async abrirNota(file) {
    await this.app.workspace.getLeaf(false).openFile(file);
  }
  onClose() {
    this.contentEl.empty();
  }
};
var AvisoConfiguracionModal = class extends import_obsidian8.Modal {
  constructor(plugin) {
    super(plugin.app);
    this.plugin = plugin;
  }
  onOpen() {
    this.titleEl.setText("Gesti\xF3n de \xE9picas");
    this.contentEl.createEl("p", {
      text: "Crea las carpetas de gesti\xF3n con el bot\xF3n \xABCrear carpetas de gesti\xF3n\xBB del panel de acciones antes de continuar."
    });
    const row = this.contentEl.createDiv({ cls: "gf-botones" });
    const btn = row.createEl("button", { text: "Abrir panel de acciones", cls: "mod-cta" });
    btn.addEventListener("click", () => {
      this.close();
      void this.plugin.abrirAcciones();
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
var CrearFuncionalidadModal = class extends GestorModal {
  constructor() {
    super(...arguments);
    /** Si está marcado, al crear no se cierra el modal: vacía el formulario. */
    this.crearNuevo = false;
  }
  onOpen() {
    this.titleEl.setText("Crear \xE9pica");
    const nombre = this.campoTexto("Nombre de la \xE9pica", "Escribe nombre de la \xE9pica");
    const sprintOpc = this.campoSprintOpcional();
    const colabSel = /* @__PURE__ */ new Set();
    const colWrap = this.contentEl.createDiv({ cls: "gf-campo" });
    colWrap.createEl("label", { text: "Asignar colaboradores", cls: "gf-campo-label" });
    crearSelectorEtiquetas({
      parent: colWrap.createDiv(),
      etiquetas: this.plugin.settings.colaboradores.filter((c) => c.visible !== false),
      seleccion: colabSel,
      textoBtn: "Asignar colaboradores\u2026",
      textoVacio: "No hay colaboradores registrados."
    });
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
        const file = await createFuncionalidad(
          this.app,
          this.plugin.settings.carpetaAdmin,
          valor
        );
        const sps = sprintOpc.getSprints();
        if (sps.length > 0) {
          const ref = funcRefDesdeCarpeta(
            this.app,
            `${this.plugin.settings.carpetaAdmin}/${slugify(valor)}`
          );
          if (ref)
            await guardarSprints(this.app, ref, sps);
        }
        await this.aplicarAsignados(file, [...colabSel]);
        if (this.crearNuevo) {
          new import_obsidian8.Notice(`Gesti\xF3n de \xE9picas: \xE9pica "${valor}" creada.`);
          nombre.input.value = "";
          this.limpiarError(nombre);
          nombre.input.focus();
        } else {
          this.close();
          await this.abrirNota(file);
        }
      } catch (e) {
        if (e instanceof YaExisteError) {
          this.mostrarError(nombre, "Ya existe una \xE9pica con ese nombre.");
        } else {
          console.error(e);
          new import_obsidian8.Notice("Gesti\xF3n de \xE9picas: error al crear la \xE9pica.");
        }
      }
    });
    nombre.input.focus();
  }
};
var EditarNombreModal = class extends GestorModal {
  onOpen() {
    this.titleEl.setText("Editar nombre");
    const funcs = listFuncionalidades(this.app, this.plugin.settings.carpetaAdmin);
    const epica = this.campoEpica(funcs);
    const fn = this.campoFuncionalidad(epica);
    const incCampo = this.campoSelect("Incidencia (opcional)", "Toda la \xE9pica/historia");
    let incidencias = [];
    const repoblarInc = () => {
      var _a;
      const base = (_a = fn.getFn()) != null ? _a : epica.getFunc();
      incidencias = base ? listIncidencias(this.app, base, this.plugin.settings.incidencias) : [];
      this.setOpciones(
        incCampo.select,
        "Toda la \xE9pica/historia",
        incidencias.map((i, idx) => ({ value: String(idx), label: `${i.tipoNombre}: ${i.nombre}` }))
      );
      incCampo.select.dispatchEvent(new Event("change"));
    };
    const nombre = this.campoTexto("Nuevo nombre", "Escribe el nuevo nombre");
    const incSeleccionada = () => {
      var _a;
      const v = incCampo.select.value;
      return v === "" ? null : (_a = incidencias[Number(v)]) != null ? _a : null;
    };
    const sincronizar = () => {
      var _a;
      const inc = incSeleccionada();
      if (inc) {
        nombre.input.value = inc.nombre;
        return;
      }
      const o = (_a = fn.getFn()) != null ? _a : epica.getFunc();
      nombre.input.value = o ? o.nombre : "";
    };
    epica.select.addEventListener("change", repoblarInc);
    fn.select.addEventListener("change", repoblarInc);
    incCampo.select.addEventListener("change", sincronizar);
    repoblarInc();
    this.botones(async () => {
      var _a, _b;
      this.limpiarError(epica);
      this.limpiarError(nombre);
      const inc = incSeleccionada();
      const o = (_b = (_a = fn.getFn()) != null ? _a : epica.getFunc()) != null ? _b : null;
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
        if (inc)
          await renombrarIncidencia(this.app, inc.file, valor);
        else
          await renombrarFuncionalidad(this.app, o, valor);
        new import_obsidian8.Notice("Gesti\xF3n de \xE9picas: nombre actualizado.");
        this.close();
      } catch (e) {
        console.error(e);
        new import_obsidian8.Notice("Gesti\xF3n de \xE9picas: no se pudo renombrar.");
      }
    }, "Guardar");
    if (funcs.length === 0)
      this.sinEpicas(epica);
  }
};
var MoverIncidenciaModal = class extends GestorModal {
  constructor(plugin, cfg) {
    super(plugin);
    this.cfg = {
      titulo: "Editar incidencia",
      singular: "incidencia",
      tipos: () => plugin.settings.incidencias,
      accionConfig: "Configurar incidencias",
      conColaboradores: true,
      ...cfg
    };
  }
  onOpen() {
    this.titleEl.setText(this.cfg.titulo);
    this.modalEl.addClass("gf-modal-sprints");
    const funcs = listFuncionalidades(this.app, this.plugin.settings.carpetaAdmin);
    this.seccion(`${this.cfg.singular === "documento" ? "Documento" : "Incidencia"} a editar`);
    const epica = this.campoEpica(funcs);
    const fn = this.campoFuncionalidad(epica);
    const incCampo = this.campoSelect(
      this.cfg.singular === "documento" ? "Documento" : "Incidencia",
      "Seleccionar"
    );
    let incidencias = [];
    const repoblarInc = () => {
      var _a;
      const base = (_a = fn.getFn()) != null ? _a : epica.getFunc();
      incidencias = base ? listIncidencias(this.app, base, this.cfg.tipos()) : [];
      this.setOpciones(
        incCampo.select,
        "Seleccionar incidencia",
        incidencias.map((i, idx) => ({ value: String(idx), label: `${i.tipoNombre}: ${i.nombre}` }))
      );
      incCampo.select.dispatchEvent(new Event("change"));
    };
    epica.select.addEventListener("change", repoblarInc);
    fn.select.addEventListener("change", repoblarInc);
    const incSel = () => {
      var _a;
      const v = incCampo.select.value;
      return v === "" ? null : (_a = incidencias[Number(v)]) != null ? _a : null;
    };
    this.seccion("Cambios");
    const nombre = this.campoTexto("Nombre", "Nombre de la incidencia");
    const tipo = this.campoSelect("Tipo", "Seleccionar tipo");
    this.setOpciones(
      tipo.select,
      "Seleccionar tipo",
      this.cfg.tipos().map((i) => ({ value: i.nombre, label: i.nombre }))
    );
    incCampo.select.addEventListener("change", () => {
      const i = incSel();
      if (i) {
        nombre.input.value = i.nombre;
        tipo.select.value = i.tipoNombre;
      }
    });
    this.seccion("Ubicaci\xF3n");
    const destEpica = this.campoSelect("\xC9pica", "Seleccionar \xE9pica");
    this.setOpciones(
      destEpica.select,
      "Seleccionar \xE9pica",
      funcs.map((f) => ({ value: f.slug, label: f.nombre }))
    );
    const destFn = this.campoSelect("Historia (opcional)", "Nivel \xE9pica");
    let destHist = [];
    const repoblarDest = () => {
      const e = funcs.find((f) => f.slug === destEpica.select.value);
      destHist = e ? listFuncionalidadesDe(this.app, e.folder) : [];
      this.setOpciones(
        destFn.select,
        "Nivel \xE9pica",
        destHist.map((h) => ({ value: h.slug, label: h.nombre }))
      );
    };
    destEpica.select.addEventListener("change", repoblarDest);
    const sincronizarDestino = () => {
      const ep = epica.getFunc();
      if (ep) {
        destEpica.select.value = ep.slug;
        repoblarDest();
        const h = fn.getFn();
        if (h)
          destFn.select.value = h.slug;
      }
    };
    epica.select.addEventListener("change", sincronizarDestino);
    fn.select.addEventListener("change", sincronizarDestino);
    repoblarInc();
    repoblarDest();
    this.botones(async () => {
      var _a, _b, _c, _d;
      this.limpiarError(incCampo);
      this.limpiarError(nombre);
      this.limpiarError(tipo);
      this.limpiarError(destEpica);
      const i = incSel();
      const origen = (_b = (_a = fn.getFn()) != null ? _a : epica.getFunc()) != null ? _b : null;
      const destE = (_c = funcs.find((f) => f.slug === destEpica.select.value)) != null ? _c : null;
      const destH = (_d = destHist.find((h) => h.slug === destFn.select.value)) != null ? _d : null;
      const destFunc = destH != null ? destH : destE;
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
        await moverIncidencia(this.app, i.file, origen, destFunc, nuevoTipo, nuevoNombre);
        new import_obsidian8.Notice("Gesti\xF3n de \xE9picas: incidencia actualizada.");
        this.close();
      } catch (e) {
        console.error(e);
        new import_obsidian8.Notice("Gesti\xF3n de \xE9picas: no se pudo actualizar la incidencia.");
      }
    }, "Guardar");
    if (funcs.length === 0)
      this.sinEpicas(epica);
  }
};
var CrearTareaModal = class extends GestorModal {
  constructor() {
    super(...arguments);
    this.duplicadoPendiente = null;
  }
  onOpen() {
    this.titleEl.setText("Crear tarea");
    const funcs = listFuncionalidades(this.app, this.plugin.settings.carpetaAdmin);
    const func = this.campoEpica(funcs);
    const fn = this.campoFuncionalidad(func);
    const nombre = this.campoTexto("Nombre de la tarea", "Escribe nombre de la tarea");
    const colaboradores = this.campoColaboradores();
    this.botones(async () => {
      var _a;
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
      if (!ok || !f)
        return;
      const destino = (_a = fn.getFn()) != null ? _a : f;
      let slug = slugify(valor);
      const dir = `${destino.folder.path}/tareas`;
      if (existeEnDir(this.app, dir, slug)) {
        const clave = `${destino.folder.path}/${slug}`;
        if (this.duplicadoPendiente !== clave) {
          this.duplicadoPendiente = clave;
          this.mostrarError(nombre, MSG_DUPLICADO);
          return;
        }
        slug = slugDisponible(this.app, dir, slug);
      }
      try {
        const file = await createTarea(this.app, destino, slug, valor);
        await this.aplicarAsignados(file, colaboradores.getSeleccionados());
        const admin = this.plugin.settings.carpetaAdmin;
        this.plugin.settings.kanban.tareas[claveRelativa(admin, `${dir}/${slug}`)] = "POR HACER";
        await this.plugin.saveSettings();
        this.close();
        await this.abrirNota(file);
      } catch (e) {
        console.error(e);
        new import_obsidian8.Notice("Gesti\xF3n de \xE9picas: error al crear la tarea.");
      }
    });
    if (funcs.length === 0) {
      this.sinEpicas(func);
    }
  }
};
var CrearIncidenciaModal = class extends GestorModal {
  constructor(plugin, cfg) {
    super(plugin);
    this.duplicadoPendiente = null;
    this.cfg = {
      titulo: "Crear incidencia",
      singular: "incidencia",
      tipos: () => plugin.settings.incidencias,
      accionConfig: "Configurar incidencias",
      conColaboradores: true,
      ...cfg
    };
  }
  onOpen() {
    this.titleEl.setText(this.cfg.titulo);
    const funcs = listFuncionalidades(this.app, this.plugin.settings.carpetaAdmin);
    const func = this.campoEpica(funcs);
    const fn = this.campoFuncionalidad(func);
    const tipo = this.campoSelect(`Tipo de ${this.cfg.singular}`, "Seleccionar tipo");
    this.setOpciones(
      tipo.select,
      "Seleccionar tipo",
      this.cfg.tipos().map((i) => ({ value: i.nombre, label: i.nombre }))
    );
    const nombre = this.campoTexto(`Nombre`, `Escribe el nombre`);
    const descripcion = this.campoTextArea(
      "Descripci\xF3n",
      "Aparece en el cuerpo de la nota (secci\xF3n Descripci\xF3n)"
    );
    let colabCampo = null;
    if (this.cfg.conColaboradores) {
      colabCampo = this.campoSelect("Colaborador (opcional)", "Sin colaborador");
      this.setOpciones(
        colabCampo.select,
        "Sin colaborador",
        this.plugin.settings.colaboradores.filter((c) => c.visible !== false).map((c) => ({ value: c.nombre, label: c.nombre }))
      );
    }
    this.botones(async () => {
      var _a, _b;
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
      if (!ok || !f)
        return;
      const destino = (_a = fn.getFn()) != null ? _a : f;
      const tipoSlug = slugify(tipoNombre);
      let base = slugify(valor);
      const dir = `${destino.folder.path}/${tipoSlug}`;
      if (existeEnDir(this.app, dir, base)) {
        const clave = `${destino.folder.path}/${tipoSlug}/${base}`;
        if (this.duplicadoPendiente !== clave) {
          this.duplicadoPendiente = clave;
          this.mostrarError(nombre, MSG_DUPLICADO);
          return;
        }
        base = slugDisponible(this.app, dir, base);
      }
      try {
        const file = await createIncidencia(
          this.app,
          destino,
          base,
          valor,
          tipoSlug,
          tipoNombre,
          descripcion.input.value
        );
        const colab = (_b = colabCampo == null ? void 0 : colabCampo.select.value) != null ? _b : "";
        await this.aplicarAsignados(file, colab ? [colab] : []);
        this.close();
        await this.abrirNota(file);
      } catch (e) {
        console.error(e);
        new import_obsidian8.Notice(`Gesti\xF3n de \xE9picas: error al crear ${this.cfg.singular === "documento" ? "el documento" : "la incidencia"}.`);
      }
    });
    if (funcs.length === 0) {
      this.sinEpicas(func);
    }
    if (this.cfg.tipos().length === 0) {
      tipo.wrap.createDiv({
        cls: "gf-campo-aviso",
        text: `No hay tipos. Cr\xE9alos con "${this.cfg.accionConfig}".`
      });
    }
  }
};
var CrearFechadoModal = class extends GestorModal {
  constructor() {
    super(...arguments);
    /** Las incidencias (pendientes) ofrecen asignar colaboradores al crear. */
    this.conColaboradores = false;
    /** Si el nombre del archivo lleva prefijo de fecha. */
    this.conFechaEnNombre = true;
    this.duplicadoPendiente = null;
  }
  onOpen() {
    this.titleEl.setText(this.titulo);
    const funcs = listFuncionalidades(this.app, this.plugin.settings.carpetaAdmin);
    const func = this.campoEpica(funcs);
    const fn = this.campoFuncionalidad(func);
    const nombre = this.campoTexto(this.labelNombre, this.placeholderNombre);
    const colaboradores = this.conColaboradores ? this.campoColaboradores() : null;
    this.botones(async () => {
      var _a;
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
      if (!ok || !f)
        return;
      const destino = (_a = fn.getFn()) != null ? _a : f;
      const fecha = hoy();
      let base = this.conFechaEnNombre ? `${fecha}-${slugify(valor)}` : slugify(valor);
      const dir = this.carpeta(destino);
      if (existeEnDir(this.app, dir, base)) {
        const clave = `${destino.folder.path}/${base}`;
        if (this.duplicadoPendiente !== clave) {
          this.duplicadoPendiente = clave;
          this.mostrarError(nombre, MSG_DUPLICADO);
          return;
        }
        base = slugDisponible(this.app, dir, base);
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
        new import_obsidian8.Notice("Gesti\xF3n de \xE9picas: error al crear el elemento.");
      }
    });
    if (funcs.length === 0) {
      this.sinEpicas(func);
    }
  }
};
var AgregarLinkModal = class extends GestorModal {
  constructor(plugin, editor) {
    super(plugin);
    this.editor = editor;
  }
  onOpen() {
    this.titleEl.setText("Agregar link");
    const nombre = this.campoTexto("Nombre", "Ej: Ticket de Jira");
    const desc = this.campoTexto("Descripci\xF3n", "Ej: Ticket relacionado al flujo de login");
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
    this.crearBtn.disabled = true;
    const actualizar = () => {
      this.crearBtn.disabled = !(nombre.input.value.trim() || desc.input.value.trim() || link.input.value.trim());
    };
    for (const campo of [nombre, desc, link]) {
      campo.input.addEventListener("input", actualizar);
    }
    nombre.input.focus();
  }
  insertarEnCursor(callout) {
    const editor = this.editor;
    const cursor = editor.getCursor();
    const linea = editor.getLine(cursor.line);
    const haySiguienteConTexto = cursor.line + 1 < editor.lineCount() && editor.getLine(cursor.line + 1).trim() !== "";
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
};
function construirCalloutLink(nombre, descripcion, link) {
  const titulo = nombre || "Link";
  const lineas = [`> [!link] ${titulo}`];
  if (descripcion)
    lineas.push(`> ${descripcion}`);
  if (link)
    lineas.push(`> [${nombre || link}](${link})`);
  return lineas.join("\n");
}
var AsignarSprintModal = class extends GestorModal {
  constructor(plugin, opts = {}) {
    super(plugin);
    /** Asignaciones del año visible: nº de sprint → sus etiquetas (con su nº de
     * colaboradores). La presencia en el mapa indica que el sprint está asignado. */
    this.edicion = /* @__PURE__ */ new Map();
    /** Todas las asignaciones leídas del archivo (todos los años). */
    this.todosLosSprints = [];
    this.opts = opts;
  }
  onOpen() {
    this.titleEl.setText("Asignar sprints");
    this.modalEl.addClass("gf-modal-sprints");
    const funcs = listFuncionalidades(this.app, this.plugin.settings.carpetaAdmin);
    const epica = this.campoEpica(funcs);
    const actual = (/* @__PURE__ */ new Date()).getFullYear();
    const anioCampo = this.campoAnio(
      this.opts.anio && this.opts.anio > 0 ? this.opts.anio : actual,
      () => {
        this.armarEdicion(leerAnio());
        this.renderLista(listaWrap);
      }
    );
    const leerAnio = () => anioCampo.getAnio();
    const listaWrap = this.contentEl.createDiv({ cls: "gf-sprints-lista" });
    const objetivo = () => epica.getFunc();
    this.botones(async () => {
      this.limpiarError(epica);
      const obj = objetivo();
      if (!obj) {
        this.mostrarError(epica, MSG_OBLIGATORIO);
        return;
      }
      const anio = leerAnio();
      const otros = this.todosLosSprints.filter((s) => s.anio !== anio);
      const visibles = [...this.edicion.entries()].map(
        ([sprint, etiquetas]) => ({ anio, sprint, etiquetas })
      );
      try {
        await guardarSprints(this.app, obj, [...otros, ...visibles]);
        this.close();
      } catch (e) {
        console.error(e);
        new import_obsidian8.Notice("Gesti\xF3n de \xE9picas: error al guardar los sprints.");
      }
    }, "Guardar");
    this.crearBtn.disabled = true;
    const cargar = async () => {
      const obj = objetivo();
      this.todosLosSprints = obj ? await leerSprints(this.app, obj) : [];
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
  armarEdicion(anio) {
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
  renderLista(cont) {
    renderListaSprints(this.plugin, cont, this.edicion, this.opts.sprint);
  }
};
function renderListaSprints(plugin, cont, edicion, scrollSprint) {
  var _a, _b;
  const scrollPrevio = cont.scrollTop;
  cont.empty();
  const disponibles = plugin.settings.etiquetas.filter((e) => e.visible !== false);
  const colorEtiqueta = (nombre) => {
    var _a2, _b2;
    return (_b2 = (_a2 = plugin.settings.etiquetas.find((e) => e.nombre === nombre)) == null ? void 0 : _a2.color) != null ? _b2 : "#B9BEC6";
  };
  for (let n = 1; n <= plugin.settings.numSprints; n++) {
    const fila = cont.createDiv({ cls: "gf-sprint-fila", attr: { "data-sprint": String(n) } });
    const cabecera = fila.createDiv({ cls: "gf-sprint-cabecera" });
    const chk = cabecera.createEl("input", { type: "checkbox" });
    chk.checked = edicion.has(n);
    cabecera.createEl("span", { text: `Sprint ${n}`, cls: "gf-sprint-nombre" });
    const engrane = cabecera.createEl("button", { cls: "gf-sprint-engrane" });
    (0, import_obsidian8.setIcon)(engrane, "settings");
    engrane.setAttr("title", "Configurar etiquetas del sprint");
    engrane.addEventListener("click", (e) => {
      var _a2;
      e.preventDefault();
      new ConfigurarSprintModal(plugin, n, disponibles, (_a2 = edicion.get(n)) != null ? _a2 : [], (lista) => {
        if (lista.length > 0)
          edicion.set(n, lista);
        else if (edicion.has(n))
          edicion.set(n, []);
        renderListaSprints(plugin, cont, edicion, scrollSprint);
      }).open();
    });
    const chipsWrap = fila.createDiv({ cls: "gf-sprint-chips" });
    for (const et of (_a = edicion.get(n)) != null ? _a : []) {
      renderChipEtiqueta(chipsWrap, et.nombre, colorEtiqueta(et.nombre), et.num);
    }
    chk.addEventListener("change", () => {
      var _a2;
      if (chk.checked)
        edicion.set(n, (_a2 = edicion.get(n)) != null ? _a2 : []);
      else
        edicion.delete(n);
      renderListaSprints(plugin, cont, edicion, scrollSprint);
    });
  }
  if (scrollPrevio === 0 && scrollSprint) {
    (_b = cont.querySelector(`[data-sprint="${scrollSprint}"]`)) == null ? void 0 : _b.scrollIntoView({ block: "center" });
  } else {
    cont.scrollTop = scrollPrevio;
  }
}
var ConfigurarSprintModal = class extends import_obsidian8.Modal {
  constructor(plugin, sprint, disponibles, actuales, onGuardar) {
    super(plugin.app);
    this.plugin = plugin;
    this.sprint = sprint;
    this.disponibles = disponibles;
    this.actuales = actuales;
    this.onGuardar = onGuardar;
  }
  onOpen() {
    var _a;
    this.titleEl.setText("Configurar sprint");
    const filaSprint = this.contentEl.createDiv({ cls: "gf-config-sprint-cab" });
    filaSprint.createEl("span", { text: "Sprint", cls: "gf-campo-label" });
    filaSprint.createEl("span", {
      cls: "gf-config-sprint-nombre",
      text: `Sprint ${this.sprint}`
    });
    const seleccion = /* @__PURE__ */ new Map();
    for (const e of this.actuales)
      seleccion.set(e.nombre, (_a = e.num) != null ? _a : null);
    const caja = this.contentEl.createDiv({ cls: "gf-config-sprint-caja" });
    if (this.disponibles.length === 0) {
      caja.createEl("em", {
        cls: "gf-campo-aviso",
        text: "No hay etiquetas de sprint. Agr\xE9galas en los ajustes del plugin."
      });
    }
    for (const et of this.disponibles) {
      const fila = caja.createDiv({ cls: "gf-config-etq-fila" });
      const chk = fila.createEl("input", { type: "checkbox" });
      chk.checked = seleccion.has(et.nombre);
      renderChipEtiqueta(fila, et.nombre, et.color);
      const numWrap = fila.createSpan({ cls: "gf-config-num" });
      numWrap.createSpan({ cls: "gf-config-num-icono", text: "\u{1F464}" });
      const numInput = numWrap.createEl("input", {
        type: "number",
        cls: "gf-roadmap-num",
        attr: { min: "1", step: "1", placeholder: "\u2014" }
      });
      const cur = seleccion.get(et.nombre);
      numInput.value = cur ? String(cur) : "";
      numInput.disabled = !chk.checked;
      chk.addEventListener("change", () => {
        var _a2;
        if (chk.checked)
          seleccion.set(et.nombre, (_a2 = seleccion.get(et.nombre)) != null ? _a2 : null);
        else
          seleccion.delete(et.nombre);
        numInput.disabled = !chk.checked;
        if (!chk.checked)
          numInput.value = "";
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
      const lista = [];
      for (const et of this.disponibles) {
        if (!seleccion.has(et.nombre))
          continue;
        const num = seleccion.get(et.nombre);
        lista.push({ nombre: et.nombre, num: num && num > 0 ? num : void 0 });
      }
      this.onGuardar(lista);
      this.close();
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
function crearSelectorEtiquetas(opts) {
  const wrap = opts.parent.createDiv({ cls: "gf-selet" });
  const chips = wrap.createSpan({ cls: "gf-selet-chips" });
  const btn = wrap.createEl("button", { cls: "gf-selet-btn" });
  if (opts.textoBtn)
    btn.setText(opts.textoBtn);
  else
    (0, import_obsidian8.setIcon)(btn, "plus");
  const panel = createDiv({ cls: "gf-multiselect-panel gf-select-panel-float gf-selet-panel" });
  const renderChips = () => {
    chips.empty();
    for (const et of opts.etiquetas) {
      if (opts.seleccion.has(et.nombre))
        renderChipEtiqueta(chips, et.nombre, et.color);
    }
  };
  const renderPanel = () => {
    var _a;
    panel.empty();
    if (opts.etiquetas.length === 0) {
      panel.createEl("em", {
        cls: "gf-campo-aviso",
        text: (_a = opts.textoVacio) != null ? _a : "Esta \xE9pica no tiene etiquetas."
      });
      return;
    }
    for (const et of opts.etiquetas) {
      const fila = panel.createEl("label", { cls: "gf-chk gf-selet-opcion" });
      const chk = fila.createEl("input", { type: "checkbox" });
      chk.checked = opts.seleccion.has(et.nombre);
      renderChipEtiqueta(fila, et.nombre, et.color);
      chk.addEventListener("change", () => {
        var _a2;
        if (chk.checked)
          opts.seleccion.add(et.nombre);
        else
          opts.seleccion.delete(et.nombre);
        renderChips();
        (_a2 = opts.onChange) == null ? void 0 : _a2.call(opts);
      });
    }
  };
  let abierto = false;
  const onDocClick = (ev) => {
    const t = ev.target;
    if (!panel.contains(t) && t !== btn && !btn.contains(t))
      cerrar();
  };
  const onScroll = (ev) => {
    if (!panel.contains(ev.target))
      cerrar();
  };
  const onKey = (ev) => {
    if (ev.key === "Escape")
      cerrar();
  };
  function cerrar() {
    if (!abierto)
      return;
    abierto = false;
    panel.remove();
    activeDocument.removeEventListener("click", onDocClick, true);
    window.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", cerrar);
    activeDocument.removeEventListener("keydown", onKey, true);
  }
  function abrir() {
    if (abierto)
      return;
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
    if (abierto)
      cerrar();
    else
      abrir();
  });
  renderChips();
}
var CrearPendienteModal = class extends CrearFechadoModal {
  constructor() {
    super(...arguments);
    this.titulo = "Crear pendiente";
    this.labelNombre = "Nombre del pendiente";
    this.placeholderNombre = "Ej: Revisar mockups con el equipo";
    this.conColaboradores = true;
    this.conFechaEnNombre = false;
  }
  carpeta(func) {
    return `${func.folder.path}/pendientes`;
  }
  crear(func, base, nombre, fecha) {
    return createPendiente(this.app, func, base, nombre, fecha);
  }
};
var MoverEpicaModal = class extends GestorModal {
  constructor(plugin) {
    super(plugin);
    /** Todas las épicas (activas + archivadas), con su estado actual de archivado. */
    this.todas = [];
    /** Casilla deseada por ruta de épica (marcada = archivada). Persiste entre
     * repintados aunque el filtro oculte filas. */
    this.estados = /* @__PURE__ */ new Map();
    /** Filas visibles renderizadas (para leer sus casillas). */
    this.filas = [];
    /** Sprints por ruta de épica (año actual y previos), cargados al filtrar. */
    this.sprintsPorEpica = /* @__PURE__ */ new Map();
    this.filtroActivo = false;
    this.anio = (/* @__PURE__ */ new Date()).getFullYear();
    this.desde = 1;
    this.hasta = plugin.settings.numSprints;
  }
  onOpen() {
    this.titleEl.setText("Archivar \xE9picas");
    this.modalEl.addClass("gf-modal-etiquetas");
    const activas = listFuncionalidades(this.app, CARPETA_ACTIVAS);
    const inactivas = listFuncionalidades(this.app, CARPETA_INACTIVAS);
    this.todas = [
      ...activas.map((ref) => ({ ref, archivada: false })),
      ...inactivas.map((ref) => ({ ref, archivada: true }))
    ].sort((a, b) => a.ref.nombre.localeCompare(b.ref.nombre, "es"));
    for (const e of this.todas)
      this.estados.set(e.ref.folder.path, e.archivada);
    this.renderFiltro();
    this.listaWrap = this.contentEl.createDiv({ cls: "gf-etq-scroll" });
    this.pintarLista();
    this.botones(async () => {
      var _a;
      this.sincronizar();
      let movidas = 0;
      for (const ep of this.todas) {
        const quiere = (_a = this.estados.get(ep.ref.folder.path)) != null ? _a : ep.archivada;
        if (quiere === ep.archivada)
          continue;
        try {
          if (quiere) {
            const res = await archivarEpica(
              this.app,
              ep.ref,
              (/* @__PURE__ */ new Date()).getFullYear()
            );
            if (res.renombrada) {
              new import_obsidian8.Notice(
                `Gesti\xF3n de \xE9picas: ya exist\xEDa "${ep.ref.nombre}" archivada; se archiv\xF3 como "${res.nombre}".`
              );
            }
            movidas++;
          } else {
            const ruta = `${CARPETA_ACTIVAS}/${ep.ref.slug}`;
            if (this.app.vault.getAbstractFileByPath(ruta)) {
              new import_obsidian8.Notice(`Gesti\xF3n de \xE9picas: ya existe "${ep.ref.nombre}" en \xE9picas activas.`);
              continue;
            }
            await this.app.fileManager.renameFile(ep.ref.folder, ruta);
            movidas++;
          }
        } catch (e) {
          console.error(e);
          new import_obsidian8.Notice(`Gesti\xF3n de \xE9picas: no se pudo mover "${ep.ref.nombre}".`);
        }
      }
      if (movidas > 0)
        new import_obsidian8.Notice(`Gesti\xF3n de \xE9picas: ${movidas} \xE9pica(s) actualizada(s).`);
      this.close();
    }, "Guardar");
    if (this.todas.length === 0)
      this.crearBtn.disabled = true;
  }
  /** Controles de filtro: casilla para activarlo + año y rango de sprints. */
  renderFiltro() {
    const maxSprints = this.plugin.settings.numSprints;
    if (this.hasta > maxSprints)
      this.hasta = maxSprints;
    const wrap = this.contentEl.createDiv({ cls: "gf-campo" });
    const cab = wrap.createEl("label", { cls: "gf-chk" });
    const chk = cab.createEl("input", { type: "checkbox" });
    chk.checked = this.filtroActivo;
    cab.appendText(" Filtrar por a\xF1o y sprint");
    const controles = wrap.createDiv({ cls: "gf-roadmap-controles" });
    const pintarControles = () => {
      controles.empty();
      controles.toggle(this.filtroActivo);
      if (!this.filtroActivo)
        return;
      controles.createEl("span", { text: "A\xF1o", cls: "gf-roadmap-lbl" });
      const anioBtn = controles.createEl("button", {
        cls: "gf-multiselect-btn",
        text: `${this.anio} \u25BE`
      });
      anioBtn.addEventListener("click", (e) => {
        e.preventDefault();
        new AnioPickerModal(this.app, this.anio, (y) => {
          this.anio = y;
          anioBtn.setText(`${y} \u25BE`);
          void this.refiltrar();
        }).open();
      });
      const opcionesSprint = (desde) => {
        const ops = [];
        for (let n = desde; n <= maxSprints; n++)
          ops.push({ valor: String(n), texto: `Sprint ${n}` });
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
          if (this.hasta < this.desde)
            this.hasta = this.desde;
          finCtl.setOpciones(opcionesSprint(this.desde), String(this.hasta));
          void this.refiltrar();
        }
      });
      rango.createEl("span", { text: "fin", cls: "gf-roadmap-lbl" });
      const finCtl = crearSelect({
        parent: rango,
        opciones: opcionesSprint(this.desde),
        valor: String(this.hasta),
        onChange: (v) => {
          this.hasta = Number(v);
          void this.refiltrar();
        }
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
  sincronizar() {
    for (const f of this.filas)
      this.estados.set(f.ref.folder.path, f.chk.checked);
  }
  /** Carga los sprints que falten y vuelve a pintar la lista según el filtro. */
  async refiltrar() {
    this.sincronizar();
    if (this.filtroActivo) {
      for (const ep of this.todas) {
        if (!this.sprintsPorEpica.has(ep.ref.folder.path)) {
          this.sprintsPorEpica.set(
            ep.ref.folder.path,
            await leerSprints(this.app, ep.ref)
          );
        }
      }
    }
    this.pintarLista();
  }
  pasaFiltro(ref) {
    var _a;
    if (!this.filtroActivo)
      return true;
    const sprints = (_a = this.sprintsPorEpica.get(ref.folder.path)) != null ? _a : [];
    return sprints.some(
      (s) => s.anio === this.anio && s.sprint >= this.desde && s.sprint <= this.hasta
    );
  }
  pintarLista() {
    var _a;
    this.listaWrap.empty();
    this.filas = [];
    const visibles = this.todas.filter((e) => this.pasaFiltro(e.ref));
    if (visibles.length === 0) {
      this.listaWrap.createEl("em", {
        cls: "gf-campo-aviso",
        text: this.todas.length === 0 ? "No hay \xE9picas." : "Ninguna \xE9pica cumple el filtro."
      });
      return;
    }
    const tbody = this.listaWrap.createEl("table", { cls: "gf-etq-tabla" }).createEl("tbody");
    for (const ep of visibles) {
      const tr = tbody.createEl("tr", { cls: "gf-etq-fila" });
      const tdChk = tr.createEl("td", { cls: "gf-etq-visible-td" });
      const chk = tdChk.createEl("input", { type: "checkbox" });
      chk.checked = (_a = this.estados.get(ep.ref.folder.path)) != null ? _a : ep.archivada;
      chk.setAttr("title", "Marcada = archivada");
      tr.createEl("td", { cls: "gf-etq-nombre-td" }).createEl("span", {
        cls: "gf-etq-nombre",
        text: ep.ref.nombre
      });
      this.filas.push({ ref: ep.ref, chk });
    }
  }
};
var AsignarColaboradorModal = class extends GestorModal {
  constructor() {
    super(...arguments);
    this.seleccion = /* @__PURE__ */ new Set();
  }
  onOpen() {
    this.titleEl.setText("Asignar colaborador");
    const funcs = listFuncionalidades(this.app, this.plugin.settings.carpetaAdmin);
    const epica = this.campoEpica(funcs);
    const fn = this.campoFuncionalidad(epica);
    const colaboradores = this.plugin.settings.colaboradores.filter((c) => c.visible !== false);
    const wrap = this.contentEl.createDiv({ cls: "gf-campo" });
    wrap.createEl("label", { text: "Colaboradores", cls: "gf-campo-label" });
    const selCont = wrap.createDiv();
    const aviso = this.contentEl.createDiv({ cls: "gf-campo-aviso" });
    const objetivo = () => {
      var _a, _b;
      return (_b = (_a = fn.getFn()) != null ? _a : epica.getFunc()) != null ? _b : null;
    };
    const reconstruir = () => {
      selCont.empty();
      crearSelectorEtiquetas({
        parent: selCont,
        etiquetas: colaboradores,
        seleccion: this.seleccion,
        textoBtn: "Asignar colaboradores\u2026",
        textoVacio: "No hay colaboradores registrados."
      });
    };
    const sincronizar = () => {
      const o = objetivo();
      this.seleccion.clear();
      if (o) {
        for (const c of getAsignados(this.app, o.file)) {
          if (colaboradores.some((x) => x.nombre === c))
            this.seleccion.add(c);
        }
      }
      aviso.setText(
        o ? fn.getFn() ? `Se asignar\xE1n a la historia "${o.nombre}".` : `Se asignar\xE1n a la \xE9pica "${o.nombre}".` : "Selecciona una \xE9pica o historia."
      );
      reconstruir();
      this.crearBtn.disabled = !o;
    };
    epica.select.addEventListener("change", sincronizar);
    fn.select.addEventListener("change", sincronizar);
    this.botones(async () => {
      const o = objetivo();
      if (!o) {
        this.mostrarError(epica, MSG_OBLIGATORIO);
        return;
      }
      try {
        const arr = [...this.seleccion].sort((a, b) => a.localeCompare(b, "es"));
        await this.app.fileManager.processFrontMatter(o.file, (fm) => {
          if (arr.length > 0)
            fm.asignados = arr;
          else
            delete fm.asignados;
        });
        new import_obsidian8.Notice("Gesti\xF3n de \xE9picas: colaboradores asignados.");
        this.close();
      } catch (e) {
        console.error(e);
        new import_obsidian8.Notice("Gesti\xF3n de \xE9picas: error al guardar las asignaciones.");
      }
    }, "Guardar");
    sincronizar();
    if (funcs.length === 0) {
      this.sinEpicas(epica);
    }
  }
};
var CrearFuncionalidadNuevaModal = class extends GestorModal {
  constructor() {
    super(...arguments);
    /** Si está marcado, al crear no se cierra el modal: vacía el formulario. */
    this.crearNuevo = false;
  }
  onOpen() {
    this.titleEl.setText("Crear historia");
    const funcs = listFuncionalidades(this.app, this.plugin.settings.carpetaAdmin);
    const epica = this.campoEpica(funcs);
    const nombre = this.campoTexto(
      "Nombre de la historia",
      "Escribe nombre de la historia"
    );
    const colabSel = /* @__PURE__ */ new Set();
    const colWrap = this.contentEl.createDiv({ cls: "gf-campo" });
    colWrap.createEl("label", { text: "Asignar colaboradores", cls: "gf-campo-label" });
    crearSelectorEtiquetas({
      parent: colWrap.createDiv(),
      etiquetas: this.plugin.settings.colaboradores.filter((c) => c.visible !== false),
      seleccion: colabSel,
      textoBtn: "Asignar colaboradores\u2026",
      textoVacio: "No hay colaboradores registrados."
    });
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
      if (!ok || !f)
        return;
      try {
        const file = await createFuncionalidadEn(this.app, f, valor);
        await this.aplicarAsignados(file, [...colabSel]);
        if (this.crearNuevo) {
          new import_obsidian8.Notice(`Gesti\xF3n de \xE9picas: historia "${valor}" creada.`);
          nombre.input.value = "";
          this.limpiarError(nombre);
          nombre.input.focus();
        } else {
          this.close();
          await this.abrirNota(file);
        }
      } catch (e) {
        if (e instanceof YaExisteError) {
          this.mostrarError(nombre, "Ya existe una historia con ese nombre.");
        } else {
          console.error(e);
          new import_obsidian8.Notice("Gesti\xF3n de \xE9picas: error al crear la historia.");
        }
      }
    });
    if (funcs.length === 0) {
      this.sinEpicas(epica);
    }
  }
};
var ConfirmacionModal = class extends import_obsidian8.Modal {
  constructor(plugin, titulo, mensaje, textoOk, onOk) {
    super(plugin.app);
    this.plugin = plugin;
    this.titulo = titulo;
    this.mensaje = mensaje;
    this.textoOk = textoOk;
    this.onOk = onOk;
  }
  onOpen() {
    this.titleEl.setText(this.titulo);
    this.contentEl.createEl("p", { cls: "gf-campo-aviso", text: this.mensaje });
    const row = this.contentEl.createDiv({ cls: "gf-botones" });
    const cancelar = row.createEl("button", { text: "Cancelar" });
    cancelar.addEventListener("click", () => this.close());
    const ok = row.createEl("button", { text: this.textoOk, cls: "mod-warning" });
    ok.addEventListener("click", () => {
      this.close();
      void this.onOk();
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
var EliminarEpicaHistoriaModal = class extends GestorModal {
  onOpen() {
    this.titleEl.setText("Eliminar \xE9pica o historia");
    const funcs = listFuncionalidades(this.app, this.plugin.settings.carpetaAdmin);
    const epica = this.campoEpica(funcs);
    const fn = this.campoFuncionalidad(epica);
    this.contentEl.createDiv({
      cls: "gf-campo-aviso",
      text: "Si eliges solo la \xE9pica se elimina toda la \xE9pica. Si eliges una historia, se elimina solo esa historia."
    });
    this.botones(() => {
      var _a, _b;
      this.limpiarError(epica);
      const objetivo = (_b = (_a = fn.getFn()) != null ? _a : epica.getFunc()) != null ? _b : null;
      if (!objetivo) {
        this.mostrarError(epica, MSG_OBLIGATORIO);
        return;
      }
      const esHistoria = fn.getFn() !== null;
      const tipo = esHistoria ? "la historia" : "la \xE9pica";
      new ConfirmacionModal(
        this.plugin,
        `Eliminar ${tipo}`,
        `Se enviar\xE1 ${tipo} "${objetivo.nombre}" y TODO su contenido (${esHistoria ? "incidencias, documentos y notas" : "historias, incidencias, documentos y notas"}) a la papelera de Obsidian. \xBFContinuar?`,
        "Eliminar",
        async () => {
          try {
            await eliminarFuncionalidad(this.app, objetivo);
            new import_obsidian8.Notice(`Gesti\xF3n de \xE9picas: "${objetivo.nombre}" eliminada.`);
            this.close();
          } catch (e) {
            console.error(e);
            new import_obsidian8.Notice("Gesti\xF3n de \xE9picas: no se pudo eliminar.");
          }
        }
      ).open();
    }, "Eliminar\u2026");
    if (funcs.length === 0)
      this.sinEpicas(epica);
  }
};
var EliminarIncidenciaModal = class extends GestorModal {
  constructor(plugin, cfg) {
    super(plugin);
    this.cfg = {
      titulo: "Eliminar incidencia",
      singular: "incidencia",
      tipos: () => plugin.settings.incidencias,
      accionConfig: "Configurar incidencias",
      conColaboradores: false,
      ...cfg
    };
  }
  onOpen() {
    this.titleEl.setText(this.cfg.titulo);
    const esDoc = this.cfg.singular === "documento";
    const funcs = listFuncionalidades(this.app, this.plugin.settings.carpetaAdmin);
    const epica = this.campoEpica(funcs);
    const fn = this.campoFuncionalidad(epica);
    const incCampo = this.campoSelect(esDoc ? "Documento" : "Incidencia", "Seleccionar");
    let incidencias = [];
    const repoblarInc = () => {
      var _a;
      const base = (_a = fn.getFn()) != null ? _a : epica.getFunc();
      incidencias = base ? listIncidencias(this.app, base, this.cfg.tipos()) : [];
      this.setOpciones(
        incCampo.select,
        "Seleccionar",
        incidencias.map((i, idx) => ({ value: String(idx), label: `${i.tipoNombre}: ${i.nombre}` }))
      );
      incCampo.select.dispatchEvent(new Event("change"));
    };
    epica.select.addEventListener("change", repoblarInc);
    fn.select.addEventListener("change", repoblarInc);
    repoblarInc();
    const incSel = () => {
      var _a;
      const v = incCampo.select.value;
      return v === "" ? null : (_a = incidencias[Number(v)]) != null ? _a : null;
    };
    this.botones(() => {
      var _a, _b;
      this.limpiarError(incCampo);
      const i = incSel();
      const origen = (_b = (_a = fn.getFn()) != null ? _a : epica.getFunc()) != null ? _b : null;
      if (!i || !origen) {
        this.mostrarError(incCampo, `Selecciona ${esDoc ? "el documento" : "la incidencia"}.`);
        return;
      }
      const tipo = esDoc ? "el documento" : "la incidencia";
      new ConfirmacionModal(
        this.plugin,
        `Eliminar ${esDoc ? "documento" : "incidencia"}`,
        `Se enviar\xE1 ${tipo} "${i.nombre}" a la papelera de Obsidian y se quitar\xE1 del \xEDndice de su nota. \xBFContinuar?`,
        "Eliminar",
        async () => {
          try {
            await eliminarIncidencia(this.app, i.file, origen);
            new import_obsidian8.Notice(`Gesti\xF3n de \xE9picas: "${i.nombre}" eliminado.`);
            this.close();
          } catch (e) {
            console.error(e);
            new import_obsidian8.Notice("Gesti\xF3n de \xE9picas: no se pudo eliminar.");
          }
        }
      ).open();
    }, "Eliminar\u2026");
    if (funcs.length === 0)
      this.sinEpicas(epica);
  }
};

// src/kanban.ts
var VIEW_TYPE_KANBAN = "gestor-funciones-kanban";
var KanbanView = class extends import_obsidian9.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.renderTimer = null;
    this.cards = [];
    /** Scroll horizontal del tablero, para conservarlo entre repintados. */
    this.scrollLeft = 0;
    /** Filtros (no se persisten): por tipo de incidencia y por colaborador. */
    this.filtroTipos = /* @__PURE__ */ new Set();
    this.filtroColab = /* @__PURE__ */ new Set();
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_KANBAN;
  }
  getDisplayText() {
    return "Gesti\xF3n de incidencias \u2014 Gesti\xF3n de \xE9picas";
  }
  getIcon() {
    return "kanban-square";
  }
  async onOpen() {
    const refrescar = (file) => {
      const admin = (0, import_obsidian9.normalizePath)(this.plugin.settings.carpetaAdmin.trim() || "/");
      if (file.path === admin || file.path.startsWith(admin + "/"))
        this.renderSoon();
    };
    this.registerEvent(this.app.vault.on("create", refrescar));
    this.registerEvent(this.app.vault.on("delete", refrescar));
    this.registerEvent(this.app.vault.on("rename", refrescar));
    const s = this.plugin.settings;
    const sug = Math.min(Math.max(s.sprintActual.sprint, 1), s.numSprints);
    s.kanban.filtroSprints.desde = sug;
    if (s.kanban.filtroSprints.hasta < sug)
      s.kanban.filtroSprints.hasta = sug;
    await this.recargar();
  }
  async recargar() {
    await this.recolectar();
    this.render();
  }
  renderSoon() {
    if (this.renderTimer !== null)
      window.clearTimeout(this.renderTimer);
    this.renderTimer = window.setTimeout(() => {
      this.renderTimer = null;
      void this.recargar();
    }, 150);
  }
  async recolectar() {
    const admin = this.plugin.settings.carpetaAdmin.trim();
    this.cards = [];
    if (!admin)
      return;
    const { desde, hasta } = this.plugin.settings.kanban.filtroSprints;
    const filtrar = !(desde === 1 && hasta === this.plugin.settings.numSprints);
    const anio = (/* @__PURE__ */ new Date()).getFullYear();
    const pasaSprints = async (ref) => {
      const sprints = await leerSprints(this.app, ref);
      return sprints.some((s) => s.anio === anio && s.sprint >= desde && s.sprint <= hasta);
    };
    const tipos = this.plugin.settings.incidencias;
    const agregar = (ref, contexto) => {
      var _a;
      for (const inc of listIncidencias(this.app, ref, tipos)) {
        this.cards.push({
          file: inc.file,
          nombre: inc.nombre,
          contexto,
          tipo: inc.tipoNombre,
          colaboradores: getAsignados(this.app, inc.file),
          estado: (_a = this.estadoDe(inc.file)) != null ? _a : "por-hacer"
        });
      }
    };
    for (const epica of listFuncionalidades(this.app, admin)) {
      const epicaPasa = !filtrar || await pasaSprints(epica);
      if (epicaPasa)
        agregar(epica, epica.nombre);
      for (const fn of listFuncionalidadesDe(this.app, epica.folder)) {
        const fnPasa = epicaPasa || await pasaSprints(fn);
        if (fnPasa)
          agregar(fn, `${epica.nombre} \u203A ${fn.nombre}`);
      }
    }
  }
  estadoDe(file) {
    var _a, _b;
    const estado = (_b = (_a = this.app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter) == null ? void 0 : _b.estado;
    return estado ? String(estado) : void 0;
  }
  carrilesVisibles() {
    return this.plugin.settings.carriles.filter((c) => c.visible);
  }
  /** Nombre del carril visible donde cae una incidencia según su `estado`. */
  carrilDe(estado) {
    var _a, _b;
    const visibles = this.carrilesVisibles();
    const c = this.plugin.settings.carriles.find((x) => x.valor === normalizarEstado(estado));
    if (c && visibles.some((v) => v.nombre === c.nombre))
      return c.nombre;
    const pend = visibles.find((v) => v.valor === "por-hacer");
    return (_b = (_a = pend != null ? pend : visibles[0]) == null ? void 0 : _a.nombre) != null ? _b : "";
  }
  colorTipo(nombre) {
    var _a, _b;
    return (_b = (_a = this.plugin.settings.incidencias.find((i) => i.nombre === nombre)) == null ? void 0 : _a.color) != null ? _b : "#B9BEC6";
  }
  colorColab(nombre) {
    var _a, _b;
    return (_b = (_a = this.plugin.settings.colaboradores.find((c) => c.nombre === nombre)) == null ? void 0 : _a.color) != null ? _b : "#B9BEC6";
  }
  render() {
    const cont = this.contentEl;
    cont.empty();
    cont.addClass("gf-kanban");
    if (!carpetasGestionListas(this.app)) {
      const aviso = cont.createDiv({ cls: "gf-kanban-aviso" });
      aviso.createEl("p", {
        text: "Crea las carpetas de gesti\xF3n desde el panel de acciones antes de usar el tablero."
      });
      const btn = aviso.createEl("button", { text: "Abrir panel de acciones", cls: "mod-cta" });
      btn.addEventListener("click", () => void this.plugin.abrirAcciones());
      return;
    }
    const barra = cont.createDiv({ cls: "gf-roadmap-controles" });
    const filtro = this.plugin.settings.kanban.filtroSprints;
    const maxSprints = this.plugin.settings.numSprints;
    if (filtro.hasta > maxSprints)
      filtro.hasta = maxSprints;
    if (filtro.desde > maxSprints)
      filtro.desde = maxSprints;
    const opcionesSprint = (desde) => {
      const ops = [];
      for (let n = desde; n <= maxSprints; n++)
        ops.push({ valor: String(n), texto: `Sprint ${n}` });
      return ops;
    };
    const aplicarSprints = async () => {
      await this.plugin.saveSettings();
      await this.recargar();
    };
    const rango = barra.createDiv({ cls: "gf-roadmap-rango" });
    rango.createEl("span", { text: "Sprint inicio", cls: "gf-roadmap-lbl" });
    crearSelect({
      parent: rango,
      opciones: opcionesSprint(1),
      valor: String(filtro.desde),
      onChange: (v) => {
        filtro.desde = Number(v);
        if (filtro.hasta < filtro.desde)
          filtro.hasta = filtro.desde;
        finCtl.setOpciones(opcionesSprint(filtro.desde), String(filtro.hasta));
        void aplicarSprints();
      }
    });
    rango.createEl("span", { text: "fin", cls: "gf-roadmap-lbl" });
    const finCtl = crearSelect({
      parent: rango,
      opciones: opcionesSprint(filtro.desde),
      valor: String(filtro.hasta),
      onChange: (v) => {
        filtro.hasta = Number(v);
        void aplicarSprints();
      }
    });
    const boardCont = cont.createDiv();
    const pintarBoard = () => {
      boardCont.empty();
      this.renderBoard(boardCont);
    };
    barra.createEl("span", { text: "Incidencia", cls: "gf-roadmap-lbl" });
    crearSelectorEtiquetas({
      parent: barra,
      etiquetas: this.plugin.settings.incidencias.filter((i) => i.visible !== false),
      seleccion: this.filtroTipos,
      textoBtn: "Filtrar por incidencia",
      textoVacio: "No hay incidencias configuradas.",
      onChange: () => pintarBoard()
    });
    barra.createEl("span", { text: "Colaborador", cls: "gf-roadmap-lbl" });
    crearSelectorEtiquetas({
      parent: barra,
      etiquetas: this.plugin.settings.colaboradores.filter((c) => c.visible !== false),
      seleccion: this.filtroColab,
      textoBtn: "Filtrar por colaborador",
      textoVacio: "No hay colaboradores registrados.",
      onChange: () => pintarBoard()
    });
    const borrar = barra.createEl("button", { text: "Borrar filtros", cls: "gf-recargar-btn" });
    borrar.addEventListener("click", () => {
      this.filtroTipos.clear();
      this.filtroColab.clear();
      this.render();
    });
    const recargar = barra.createEl("button", { text: "Recargar", cls: "gf-recargar-btn" });
    recargar.setAttr("title", "Releer las notas desde el disco");
    recargar.addEventListener("click", () => void this.recargar());
    pintarBoard();
  }
  renderBoard(cont) {
    const board = cont.createDiv({ cls: "gf-kanban-board" });
    habilitarScrollHorizontal(board);
    board.addEventListener("scroll", () => {
      this.scrollLeft = board.scrollLeft;
    });
    const carriles = this.carrilesVisibles();
    if (carriles.length === 0) {
      board.createDiv({
        cls: "gf-kanban-vacio",
        text: "No hay carriles visibles. Act\xEDvalos en los ajustes del plugin."
      });
      return;
    }
    const filtradas = this.cards.filter(
      (c) => (this.filtroTipos.size === 0 || this.filtroTipos.has(c.tipo)) && (this.filtroColab.size === 0 || c.colaboradores.some((x) => this.filtroColab.has(x)))
    );
    for (const carril of carriles) {
      const col = board.createDiv({ cls: "gf-kanban-carril" });
      col.addEventListener("dragover", (e) => {
        e.preventDefault();
        col.addClass("gf-drop");
      });
      col.addEventListener("dragleave", () => col.removeClass("gf-drop"));
      col.addEventListener("drop", (e) => {
        e.preventDefault();
        col.removeClass("gf-drop");
        const payload = leerPayload(e);
        if (payload)
          void this.soltar(payload.path, carril.valor, null);
      });
      const header = col.createDiv({ cls: "gf-kanban-header" });
      const punto = header.createSpan({ cls: "gf-kanban-dot" });
      punto.setCssStyles({ backgroundColor: carril.color });
      header.createEl("span", { cls: "gf-kanban-titulo", text: carril.nombre });
      const tarjetas = this.ordenar(
        filtradas.filter((c) => this.carrilDe(c.estado) === carril.nombre)
      );
      header.createEl("span", { cls: "gf-kanban-conteo", text: String(tarjetas.length) });
      const cuerpo = col.createDiv({ cls: "gf-kanban-cuerpo" });
      for (const card of tarjetas)
        this.renderTarjeta(cuerpo, card, carril);
    }
    board.scrollLeft = this.scrollLeft;
  }
  renderTarjeta(cuerpo, card, carrilActual) {
    const el = cuerpo.createDiv({ cls: "gf-kanban-card" });
    el.draggable = true;
    el.addEventListener("dragstart", (e) => {
      var _a;
      (_a = e.dataTransfer) == null ? void 0 : _a.setData(
        "text/plain",
        JSON.stringify({ path: card.file.path })
      );
    });
    el.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.addClass("gf-drop-card");
    });
    el.addEventListener("dragleave", () => el.removeClass("gf-drop-card"));
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.removeClass("gf-drop-card");
      const payload = leerPayload(e);
      if (payload && payload.path !== card.file.path) {
        void this.soltar(payload.path, carrilActual.valor, card.file.path);
      }
    });
    el.createDiv({ cls: "gf-kanban-card-nombre", text: card.nombre });
    const chips = el.createDiv({ cls: "gf-kanban-card-chips" });
    renderChipEtiqueta(chips, card.tipo, this.colorTipo(card.tipo));
    for (const c of card.colaboradores)
      renderChipEtiqueta(chips, c, this.colorColab(c));
    if (card.contexto)
      el.createDiv({ cls: "gf-kanban-card-func", text: card.contexto });
    el.addEventListener("click", () => void this.plugin.mostrarNota(card.file));
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const menu = new import_obsidian9.Menu();
      for (const carril of this.carrilesVisibles()) {
        if (carril.nombre === carrilActual.nombre)
          continue;
        menu.addItem(
          (item) => item.setTitle(`Mover a: ${carril.nombre}`).onClick(() => void this.soltar(card.file.path, carril.valor, null))
        );
      }
      menu.showAtMouseEvent(e);
    });
  }
  /** Orden manual persistido (rutas), filtrado a las tarjetas vivas. */
  ordenLista() {
    const vivas = new Set(this.cards.map((c) => c.file.path));
    return this.plugin.settings.kanban.ordenIncidencias.filter((p) => vivas.has(p));
  }
  /** Ordena las tarjetas de un carril según el orden manual; las no listadas
   * se añaden al final por nombre. */
  ordenar(cards) {
    const orden = this.ordenLista();
    const idx = new Map(orden.map((p, i) => [p, i]));
    return [...cards].sort((a, b) => {
      const ia = idx.get(a.file.path);
      const ib = idx.get(b.file.path);
      if (ia !== void 0 && ib !== void 0)
        return ia - ib;
      if (ia !== void 0)
        return -1;
      if (ib !== void 0)
        return 1;
      return a.nombre.localeCompare(b.nombre, "es");
    });
  }
  /** Reposiciona `path` justo antes de `beforeKey` (o al final si es null).
   * Reconstruye el orden de todas las tarjetas para que `beforeKey` siempre
   * esté presente aunque haya filtros de visualización activos. */
  posicionar(path, beforeKey) {
    const k = this.plugin.settings.kanban;
    const orden = this.ordenar(this.cards).map((c) => c.file.path).filter((p) => p !== path);
    const pos = beforeKey ? orden.indexOf(beforeKey) : -1;
    if (pos === -1)
      orden.push(path);
    else
      orden.splice(pos, 0, path);
    k.ordenIncidencias = orden;
  }
  /** Mueve una tarjeta a un carril (si cambia) y/o la reordena dentro de él. */
  async soltar(path, carrilValor, beforeKey) {
    const card = this.cards.find((c) => c.file.path === path);
    if (!card)
      return;
    this.posicionar(path, beforeKey);
    if (normalizarEstado(card.estado) !== carrilValor) {
      card.estado = carrilValor;
      await this.app.fileManager.processFrontMatter(
        card.file,
        (fm) => {
          fm.estado = carrilValor;
        }
      );
    }
    await this.plugin.saveSettings();
    this.render();
  }
};
function leerPayload(e) {
  var _a;
  const raw = (_a = e.dataTransfer) == null ? void 0 : _a.getData("text/plain");
  if (!raw)
    return null;
  try {
    return JSON.parse(raw);
  } catch (e2) {
    return null;
  }
}

// src/gestor-funcionalidades.ts
var import_obsidian10 = require("obsidian");
var VIEW_TYPE_GESTOR_FN = "gestor-funciones-gestor-fn";
var GestorFuncionalidadesView = class extends import_obsidian10.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.renderTimer = null;
    /** Épicas seleccionadas (slugs). Por defecto, las que tienen sprints. */
    this.epicaSlugs = /* @__PURE__ */ new Set();
    /** Si ya se aplicó la selección por defecto de épicas. */
    this.epicaInit = false;
    this.anio = (/* @__PURE__ */ new Date()).getFullYear();
    /** Filtro por etiqueta (nombres seleccionados). */
    this.filtro = /* @__PURE__ */ new Set();
    /** Filtro por colaborador (nombres seleccionados). */
    this.filtroColab = /* @__PURE__ */ new Set();
    this.epicas = [];
    this.historias = [];
    /** Scroll horizontal del tablero, para conservarlo entre repintados. */
    this.scrollLeft = 0;
    /** Etiquetas (visibles) de las épicas seleccionadas, para el filtro. */
    this.etiquetasEpica = [];
    /** Mapa nombre de etiqueta → color (unión de las épicas seleccionadas). */
    this.colorEtiqueta = /* @__PURE__ */ new Map();
    this.plugin = plugin;
    this.desde = Math.min(
      Math.max(plugin.settings.sprintActual.sprint - 2, 1),
      plugin.settings.numSprints
    );
    this.hasta = plugin.settings.numSprints;
  }
  getViewType() {
    return VIEW_TYPE_GESTOR_FN;
  }
  getDisplayText() {
    return "Planeaci\xF3n \u2014 Gesti\xF3n de \xE9picas";
  }
  getIcon() {
    return "calendar-range";
  }
  async onOpen() {
    const refrescar = (file) => {
      const admin = (0, import_obsidian10.normalizePath)(this.plugin.settings.carpetaAdmin.trim() || "/");
      if (file.path === admin || file.path.startsWith(admin + "/"))
        this.renderSoon();
    };
    this.registerEvent(this.app.vault.on("create", refrescar));
    this.registerEvent(this.app.vault.on("delete", refrescar));
    this.registerEvent(this.app.vault.on("rename", refrescar));
    await this.recargar();
  }
  /** Relee desde disco y vuelve a renderizar. */
  async recargar() {
    await this.recolectar();
    this.render();
  }
  renderSoon() {
    if (this.renderTimer !== null)
      window.clearTimeout(this.renderTimer);
    this.renderTimer = window.setTimeout(() => {
      this.renderTimer = null;
      void this.recargar();
    }, 150);
  }
  epicasSeleccionadas() {
    return this.epicas.filter((e) => this.epicaSlugs.has(e.slug));
  }
  async recolectar() {
    var _a;
    const admin = this.plugin.settings.carpetaAdmin.trim();
    this.epicas = admin ? listFuncionalidades(this.app, admin) : [];
    this.historias = [];
    this.etiquetasEpica = [];
    this.colorEtiqueta = /* @__PURE__ */ new Map();
    if (!this.epicaInit) {
      this.epicaInit = true;
      for (const ep of this.epicas) {
        const sprints = await leerSprints(this.app, ep);
        if (sprints.length > 0)
          this.epicaSlugs.add(ep.slug);
      }
    }
    const vivos = new Set(this.epicas.map((e) => e.slug));
    for (const slug of [...this.epicaSlugs])
      if (!vivos.has(slug))
        this.epicaSlugs.delete(slug);
    const seleccionadas = this.epicasSeleccionadas();
    if (seleccionadas.length === 0)
      return;
    const etiquetasVistas = /* @__PURE__ */ new Map();
    for (const ep of seleccionadas) {
      for (const et of leerEtiquetasEpica(this.app, ep).filter((e) => e.visible !== false)) {
        if (!etiquetasVistas.has(et.nombre))
          etiquetasVistas.set(et.nombre, et);
        if (!this.colorEtiqueta.has(et.nombre))
          this.colorEtiqueta.set(et.nombre, et.color);
      }
      for (const h of listFuncionalidadesDe(this.app, ep.folder)) {
        const asign = leerSprintHistoria(this.app, h.file);
        const sprint = asign && asign.anio === this.anio ? asign.sprint : null;
        this.historias.push({
          file: h.file,
          nombre: h.nombre,
          epicaSlug: ep.slug,
          epicaNombre: ep.nombre,
          etiquetas: leerEtiquetasHistoria(this.app, h.file),
          colaboradores: getAsignados(this.app, h.file),
          estado: normalizarEstado((_a = h.estado) != null ? _a : ""),
          sprint
        });
      }
    }
    this.etiquetasEpica = [...etiquetasVistas.values()];
  }
  render() {
    const cont = this.contentEl;
    cont.empty();
    cont.addClass("gf-kanban");
    if (!carpetasGestionListas(this.app)) {
      const aviso = cont.createDiv({ cls: "gf-kanban-aviso" });
      aviso.createEl("p", {
        text: "Crea las carpetas de gesti\xF3n desde el panel de acciones antes de usar el gestor."
      });
      const btn = aviso.createEl("button", { text: "Abrir panel de acciones", cls: "mod-cta" });
      btn.addEventListener("click", () => void this.plugin.abrirAcciones());
      return;
    }
    const barra = cont.createDiv({ cls: "gf-roadmap-controles" });
    barra.createEl("span", { text: "\xC9picas", cls: "gf-roadmap-lbl" });
    crearMultiSelect({
      parent: barra,
      etiqueta: "\xC9picas",
      opciones: this.epicas.map((e) => ({ valor: e.slug, texto: e.nombre })),
      seleccion: this.epicaSlugs,
      onChange: () => {
        this.filtro.clear();
        void this.recargar();
      }
    });
    barra.createEl("span", { text: "A\xF1o", cls: "gf-roadmap-lbl" });
    const anioBtn = barra.createEl("button", { cls: "gf-multiselect-btn", text: `${this.anio} \u25BE` });
    anioBtn.addEventListener("click", () => {
      new AnioPickerModal(this.app, this.anio, (y) => {
        this.anio = y;
        void this.recargar();
      }).open();
    });
    const boardCont = cont.createDiv();
    const pintarBoard = () => {
      boardCont.empty();
      this.renderBoard(boardCont);
    };
    const maxSprints = this.plugin.settings.numSprints;
    if (this.hasta > maxSprints)
      this.hasta = maxSprints;
    if (this.desde > maxSprints)
      this.desde = maxSprints;
    const opcionesSprint = (desde) => {
      const ops = [];
      for (let n = desde; n <= maxSprints; n++)
        ops.push({ valor: String(n), texto: `Sprint ${n}` });
      return ops;
    };
    const rango = barra.createDiv({ cls: "gf-roadmap-rango" });
    rango.createEl("span", { text: "Sprint inicio", cls: "gf-roadmap-lbl" });
    crearSelect({
      parent: rango,
      opciones: opcionesSprint(1),
      valor: String(this.desde),
      onChange: (v) => {
        this.desde = Number(v);
        if (this.hasta < this.desde)
          this.hasta = this.desde;
        finCtl.setOpciones(opcionesSprint(this.desde), String(this.hasta));
        pintarBoard();
      }
    });
    rango.createEl("span", { text: "fin", cls: "gf-roadmap-lbl" });
    const finCtl = crearSelect({
      parent: rango,
      opciones: opcionesSprint(this.desde),
      valor: String(this.hasta),
      onChange: (v) => {
        this.hasta = Number(v);
        pintarBoard();
      }
    });
    if (this.epicasSeleccionadas().length > 0) {
      barra.createEl("span", { text: "Etiquetas", cls: "gf-roadmap-lbl" });
      crearSelectorEtiquetas({
        parent: barra,
        etiquetas: this.etiquetasEpica,
        seleccion: this.filtro,
        textoBtn: "Filtrar por etiqueta",
        onChange: () => pintarBoard()
      });
      barra.createEl("span", { text: "Colaborador", cls: "gf-roadmap-lbl" });
      crearSelectorEtiquetas({
        parent: barra,
        etiquetas: this.plugin.settings.colaboradores.filter((c) => c.visible !== false),
        seleccion: this.filtroColab,
        textoBtn: "Filtrar por colaborador",
        textoVacio: "No hay colaboradores registrados.",
        onChange: () => pintarBoard()
      });
      const borrar = barra.createEl("button", { text: "Borrar filtros", cls: "gf-recargar-btn" });
      borrar.addEventListener("click", () => {
        this.filtro.clear();
        this.filtroColab.clear();
        this.render();
      });
    }
    const recargar = barra.createEl("button", { text: "Recargar", cls: "gf-recargar-btn" });
    recargar.setAttr("title", "Releer las notas desde el disco");
    recargar.addEventListener("click", () => void this.recargar());
    if (this.epicasSeleccionadas().length === 0) {
      cont.createDiv({ cls: "gf-kanban-vacio", text: "Selecciona al menos una \xE9pica." });
      return;
    }
    pintarBoard();
  }
  renderBoard(cont) {
    const board = cont.createDiv({ cls: "gf-kanban-board" });
    habilitarScrollHorizontal(board);
    board.addEventListener("scroll", () => {
      this.scrollLeft = board.scrollLeft;
    });
    const columnas = [
      { titulo: "Sin sprint", sprint: null }
    ];
    for (let n = this.desde; n <= this.hasta; n++) {
      columnas.push({ titulo: `Sprint ${n}`, sprint: n });
    }
    const filtradas = this.historias.filter(
      (h) => (this.filtro.size === 0 || h.etiquetas.some((e) => this.filtro.has(e))) && (this.filtroColab.size === 0 || h.colaboradores.some((c) => this.filtroColab.has(c)))
    );
    for (const col of columnas) {
      const colEl = board.createDiv({ cls: "gf-kanban-carril" });
      colEl.addEventListener("dragover", (e) => {
        e.preventDefault();
        colEl.addClass("gf-drop");
      });
      colEl.addEventListener("dragleave", () => colEl.removeClass("gf-drop"));
      colEl.addEventListener("drop", (e) => {
        e.preventDefault();
        colEl.removeClass("gf-drop");
        const payload = leerPayload2(e);
        if (payload)
          void this.soltar(payload.path, col.sprint, null);
      });
      const header = colEl.createDiv({ cls: "gf-kanban-header" });
      header.createEl("span", { cls: "gf-kanban-titulo", text: col.titulo });
      const tarjetas = this.ordenar(filtradas.filter((h) => h.sprint === col.sprint));
      header.createEl("span", { cls: "gf-kanban-conteo", text: String(tarjetas.length) });
      const cuerpo = colEl.createDiv({ cls: "gf-kanban-cuerpo" });
      for (const card of tarjetas)
        this.renderTarjeta(cuerpo, card, col.sprint);
    }
    board.scrollLeft = this.scrollLeft;
  }
  colorColab(nombre) {
    var _a, _b;
    return (_b = (_a = this.plugin.settings.colaboradores.find((c) => c.nombre === nombre)) == null ? void 0 : _a.color) != null ? _b : "#B9BEC6";
  }
  /** Pide confirmación y marca la historia como completada / por hacer. */
  confirmarEstado(card, completar) {
    const [titulo, mensaje, ok] = completar ? ["Marcar como hecha", "\xBFMarcar esta historia como hecha? Su estado pasar\xE1 a completado.", "Marcar como hecha"] : ["Marcar como pendiente", "\xBFQuitar el estado de completado de esta historia? Volver\xE1 a Por hacer.", "Marcar como pendiente"];
    new ConfirmacionModal(this.plugin, titulo, mensaje, ok, async () => {
      const estado = completar ? "completado" : "por-hacer";
      await this.app.fileManager.processFrontMatter(card.file, (fm) => {
        fm.estado = estado;
      });
      card.estado = estado;
      this.render();
    }).open();
  }
  renderTarjeta(cuerpo, card, sprintCol) {
    var _a;
    const el = cuerpo.createDiv({ cls: "gf-kanban-card" });
    el.draggable = true;
    el.addEventListener("dragstart", (e) => {
      var _a2;
      (_a2 = e.dataTransfer) == null ? void 0 : _a2.setData(
        "text/plain",
        JSON.stringify({ path: card.file.path })
      );
    });
    el.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.addClass("gf-drop-card");
    });
    el.addEventListener("dragleave", () => el.removeClass("gf-drop-card"));
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.removeClass("gf-drop-card");
      const payload = leerPayload2(e);
      if (payload && payload.path !== card.file.path) {
        void this.soltar(payload.path, sprintCol, card.file.path);
      }
    });
    const completado = card.estado === "completado";
    if (completado)
      el.addClass("gf-kanban-card-hecha");
    const head = el.createDiv({ cls: "gf-kanban-card-head" });
    const chk = head.createEl("input", { type: "checkbox", cls: "gf-colab-chk" });
    chk.checked = completado;
    chk.addEventListener("click", (e) => e.stopPropagation());
    chk.addEventListener("change", () => {
      const quiere = chk.checked;
      chk.checked = !quiere;
      this.confirmarEstado(card, quiere);
    });
    head.createDiv({ cls: "gf-kanban-card-nombre", text: card.nombre });
    el.createDiv({ cls: "gf-kanban-card-func", text: card.epicaNombre });
    if (card.etiquetas.length > 0 || card.colaboradores.length > 0) {
      const chips = el.createDiv({ cls: "gf-kanban-card-chips" });
      for (const n of card.etiquetas) {
        renderChipEtiqueta(chips, n, (_a = this.colorEtiqueta.get(n)) != null ? _a : "#B9BEC6");
      }
      for (const c of card.colaboradores) {
        renderChipEtiqueta(chips, c, this.colorColab(c));
      }
    }
    el.addEventListener("click", () => void this.plugin.mostrarNota(card.file));
  }
  /** Orden manual persistido (rutas), filtrado a las historias visibles. */
  ordenLista() {
    const vivas = new Set(this.historias.map((h) => h.file.path));
    return this.plugin.settings.ordenFunc.filter((p) => vivas.has(p));
  }
  /** Ordena las tarjetas de una columna según el orden manual; las no listadas
   * se añaden al final por nombre. */
  ordenar(cards) {
    const orden = this.ordenLista();
    const idx = new Map(orden.map((p, i) => [p, i]));
    return [...cards].sort((a, b) => {
      const ia = idx.get(a.file.path);
      const ib = idx.get(b.file.path);
      if (ia !== void 0 && ib !== void 0)
        return ia - ib;
      if (ia !== void 0)
        return -1;
      if (ib !== void 0)
        return 1;
      return a.nombre.localeCompare(b.nombre, "es");
    });
  }
  /** Reposiciona `path` antes de `beforeKey` (o al final). Reconstruye el orden
   * de las historias visibles y conserva el de otras épicas intacto. */
  posicionar(path, beforeKey) {
    const orden = this.ordenar(this.historias).map((h) => h.file.path).filter((p) => p !== path);
    const pos = beforeKey ? orden.indexOf(beforeKey) : -1;
    if (pos === -1)
      orden.push(path);
    else
      orden.splice(pos, 0, path);
    const vivas = new Set(this.historias.map((h) => h.file.path));
    const otras = this.plugin.settings.ordenFunc.filter((p) => !vivas.has(p));
    this.plugin.settings.ordenFunc = [...otras, ...orden];
  }
  /** Asigna la columna (sprint, si cambia) y/o reordena dentro de ella. */
  async soltar(path, sprint, beforeKey) {
    const h = this.historias.find((c) => c.file.path === path);
    if (!h)
      return;
    this.posicionar(path, beforeKey);
    if (h.sprint !== sprint) {
      h.sprint = sprint;
      await guardarSprintHistoria(this.app, h.file, sprint, this.anio);
    }
    await this.plugin.saveSettings();
    this.render();
  }
};
function leerPayload2(e) {
  var _a;
  const raw = (_a = e.dataTransfer) == null ? void 0 : _a.getData("text/plain");
  if (!raw)
    return null;
  try {
    return JSON.parse(raw);
  } catch (e2) {
    return null;
  }
}

// src/roadmap.ts
var import_obsidian11 = require("obsidian");
var VIEW_TYPE_ROADMAP = "gestor-funciones-roadmap";
var RoadmapView = class extends import_obsidian11.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.anio = (/* @__PURE__ */ new Date()).getFullYear();
    /** Filtro por colaborador (nombres seleccionados); vacío = todos. */
    this.filtroColab = /* @__PURE__ */ new Set();
    /** Mostrar también las épicas sin sprints asignados (del año seleccionado). */
    this.verTodas = false;
    this.plugin = plugin;
    this.desde = Math.min(Math.max(plugin.settings.sprintActual.sprint, 1), plugin.settings.numSprints);
    this.hasta = plugin.settings.numSprints;
  }
  getViewType() {
    return VIEW_TYPE_ROADMAP;
  }
  getDisplayText() {
    return "Roadmap \u2014 Gesti\xF3n de \xE9picas";
  }
  getIcon() {
    return "map";
  }
  async onOpen() {
    await this.render();
  }
  async datos() {
    const filas = [];
    const admin = this.plugin.settings.carpetaAdmin.trim();
    if (!admin)
      return filas;
    const agregar = async (ref, tipo, epicaSlug, etiqueta) => {
      const todos = await leerSprints(this.app, ref);
      const sprints = todos.filter((s) => s.anio === this.anio);
      if (sprints.length === 0) {
        if (!this.verTodas || tipo !== "epica" || todos.length > 0)
          return;
      }
      const porSprint = /* @__PURE__ */ new Map();
      for (const s of sprints) {
        porSprint.set(s.sprint, { etiquetas: s.etiquetas });
      }
      filas.push({ ref, tipo, epicaSlug, etiqueta, porSprint });
    };
    for (const epica of listFuncionalidades(this.app, admin)) {
      await agregar(epica, "epica", epica.slug, epica.nombre);
      for (const fn of listFuncionalidadesDe(this.app, epica.folder)) {
        await agregar(fn, "funcionalidad", epica.slug, `${epica.nombre} \u203A ${fn.nombre}`);
      }
    }
    return filas;
  }
  async render() {
    const cont = this.contentEl;
    cont.empty();
    cont.addClass("gf-roadmap");
    const filas = await this.datos();
    const maxSprints = this.plugin.settings.numSprints;
    if (this.hasta > maxSprints)
      this.hasta = maxSprints;
    if (this.desde > maxSprints)
      this.desde = maxSprints;
    const barra = cont.createDiv({ cls: "gf-roadmap-controles" });
    barra.createEl("span", { text: "A\xF1o", cls: "gf-roadmap-lbl" });
    const anioBtn = barra.createEl("button", { cls: "gf-multiselect-btn", text: `${this.anio} \u25BE` });
    anioBtn.addEventListener("click", () => {
      new AnioPickerModal(this.app, this.anio, (y) => {
        this.anio = y;
        void this.render();
      }).open();
    });
    const opcionesSprint = (desde) => {
      const ops = [];
      for (let n = desde; n <= maxSprints; n++)
        ops.push({ valor: String(n), texto: `Sprint ${n}` });
      return ops;
    };
    const rango = barra.createDiv({ cls: "gf-roadmap-rango" });
    rango.createEl("span", { text: "Sprint inicio", cls: "gf-roadmap-lbl" });
    crearSelect({
      parent: rango,
      opciones: opcionesSprint(1),
      valor: String(this.desde),
      onChange: (v) => {
        this.desde = Number(v);
        if (this.hasta < this.desde)
          this.hasta = this.desde;
        finCtl.setOpciones(opcionesSprint(this.desde), String(this.hasta));
        pintarTabla();
      }
    });
    rango.createEl("span", { text: "fin", cls: "gf-roadmap-lbl" });
    const finCtl = crearSelect({
      parent: rango,
      opciones: opcionesSprint(this.desde),
      valor: String(this.hasta),
      onChange: (v) => {
        this.hasta = Number(v);
        pintarTabla();
      }
    });
    barra.createEl("span", { text: "Colaborador", cls: "gf-roadmap-lbl" });
    crearSelectorEtiquetas({
      parent: barra,
      etiquetas: this.plugin.settings.colaboradores.filter((c) => c.visible !== false),
      seleccion: this.filtroColab,
      textoBtn: "Filtrar por colaborador",
      textoVacio: "No hay colaboradores registrados.",
      onChange: () => pintarTabla()
    });
    const verLabel = barra.createEl("label", { cls: "gf-chk" });
    const verChk = verLabel.createEl("input", { type: "checkbox" });
    verChk.checked = this.verTodas;
    verLabel.appendText(" Ver todas las \xE9picas");
    verChk.addEventListener("change", () => {
      this.verTodas = verChk.checked;
      void this.render();
    });
    const borrar = barra.createEl("button", { text: "Borrar filtros", cls: "gf-roadmap-recargar" });
    borrar.addEventListener("click", () => {
      this.filtroColab.clear();
      void this.render();
    });
    const recargar = barra.createEl("button", { text: "Recargar", cls: "gf-roadmap-recargar" });
    recargar.addEventListener("click", () => void this.render());
    const tablaCont = cont.createDiv();
    const pintarTabla = () => {
      tablaCont.empty();
      const visibles = filas.filter(
        (f) => this.filtroColab.size === 0 || getAsignados(this.app, f.ref.file).some((c) => this.filtroColab.has(c))
      );
      if (visibles.length === 0) {
        tablaCont.createEl("p", {
          cls: "gf-kanban-vacio",
          text: "No hay \xE9picas con sprints asignados para los filtros seleccionados."
        });
        return;
      }
      const wrap = tablaCont.createDiv({ cls: "gf-roadmap-tabla-wrap" });
      habilitarScrollHorizontal(wrap);
      const tabla = wrap.createEl("table", { cls: "gf-roadmap-tabla" });
      const trh = tabla.createEl("thead").createEl("tr");
      trh.createEl("th", { text: "\xC9pica", cls: "gf-roadmap-th-epica" });
      for (let n = this.desde; n <= this.hasta; n++) {
        trh.createEl("th", { text: String(n) });
      }
      const tbody = tabla.createEl("tbody");
      for (const fila of visibles)
        this.renderFila(tbody, fila);
    };
    pintarTabla();
  }
  renderFila(tbody, fila) {
    var _a, _b, _c;
    const tr = tbody.createEl("tr");
    const tdNombre = tr.createEl("td", { cls: "gf-roadmap-epica" });
    const a = tdNombre.createEl("a", { cls: "internal-link", text: fila.etiqueta });
    if (fila.tipo === "funcionalidad")
      a.addClass("gf-roadmap-fn");
    a.addEventListener("click", (e) => {
      e.preventDefault();
      void this.app.workspace.getLeaf(false).openFile(fila.ref.file);
    });
    const colabs = getAsignados(this.app, fila.ref.file).filter(
      (n) => this.plugin.settings.colaboradores.some((c) => c.nombre === n && c.visible !== false)
    );
    if (colabs.length > 0) {
      const chips = tdNombre.createDiv({ cls: "gf-roadmap-colabs" });
      for (const c of colabs) {
        const color = (_b = (_a = this.plugin.settings.colaboradores.find((x) => x.nombre === c)) == null ? void 0 : _a.color) != null ? _b : "#B9BEC6";
        renderChipEtiqueta(chips, c, color);
      }
    }
    for (let n = this.desde; n <= this.hasta; n++) {
      const td = tr.createEl("td", { cls: "gf-roadmap-celda" });
      const celda = fila.porSprint.get(n);
      if (!celda)
        continue;
      const { etiquetas } = celda;
      td.addClass("gf-roadmap-on");
      td.setAttr(
        "title",
        etiquetas.length > 0 ? etiquetas.map((e) => e.nombre).join(", ") : `Sprint ${n}`
      );
      const colorPrimera = etiquetas[0] ? this.colorDe(etiquetas[0].nombre) : void 0;
      if (colorPrimera)
        td.setCssStyles({ backgroundColor: conAlpha(colorPrimera, 0.25) });
      const bloque = td.createDiv({ cls: "gf-roadmap-bloque" });
      for (const et of etiquetas.slice(0, 2)) {
        renderChipEtiqueta(bloque, et.nombre, (_c = this.colorDe(et.nombre)) != null ? _c : "#B9BEC6", et.num);
      }
      if (etiquetas.length > 2) {
        bloque.createEl("span", { cls: "gf-etq-chip gf-etq-chip-mas", text: "\u2026" });
      }
      td.addEventListener("click", () => {
        new AsignarSprintModal(this.plugin, {
          epicaSlug: fila.epicaSlug,
          anio: this.anio,
          sprint: n
        }).open();
      });
    }
  }
  colorDe(nombreEtiqueta) {
    var _a;
    return (_a = this.plugin.settings.etiquetas.find((e) => e.nombre === nombreEtiqueta)) == null ? void 0 : _a.color;
  }
};
function conAlpha(hex, alpha) {
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m)
    return hex;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
}

// src/colaboradores.ts
var import_obsidian12 = require("obsidian");
var VIEW_TYPE_COLABORADORES = "gestor-funciones-colaboradores";
var VIEW_TYPE_DOCUMENTOS = "gestor-funciones-documentos";
var SIN_ASIGNAR = "Sin asignar";
var CONFIG_INCIDENCIAS = {
  viewType: VIEW_TYPE_COLABORADORES,
  titulo: "Incidencias por colaborador",
  icon: "users",
  registro: (p) => p.settings.incidencias,
  incluyeTareasPendientes: true,
  conEpicaFilter: false,
  conMarcarHecha: true,
  agruparPor: "colaborador",
  singular: "incidencia"
};
var CONFIG_DOCUMENTOS = {
  viewType: VIEW_TYPE_DOCUMENTOS,
  titulo: "Documentos por \xE9pica",
  icon: "file-text",
  registro: (p) => p.settings.documentos,
  incluyeTareasPendientes: false,
  conEpicaFilter: true,
  conMarcarHecha: false,
  agruparPor: "contexto",
  singular: "documento"
};
var TareasColaboradorView = class extends import_obsidian12.ItemView {
  constructor(leaf, plugin, cfg) {
    super(leaf);
    this.renderTimer = null;
    this.seleccionFiltro = /* @__PURE__ */ new Set();
    /** Si ya se aplicó la selección por defecto del filtro de colaborador. */
    this.filtroColabInit = false;
    this.tiposFiltro = /* @__PURE__ */ new Set();
    this.desde = 1;
    /** Filtro de épicas (valores seleccionados). Todas marcadas por defecto. */
    this.epicaSeleccion = /* @__PURE__ */ new Set();
    this.epicaConocidas = /* @__PURE__ */ new Set();
    /** Mostrar incidencias completadas (tachadas). Marcado por defecto. */
    this.verCompletadas = true;
    /** Arrastre en curso (reordenar tarjetas de colaborador o incidencias). Para
     * items, `origen` es el grupo (colaborador) desde el que se arrastra. */
    this.arrastre = null;
    /** Grupos a pintar (por colaborador o por épica/historia, según config). */
    this.grupos = [];
    this.plugin = plugin;
    this.cfg = cfg;
    this.hasta = plugin.settings.numSprints;
  }
  getViewType() {
    var _a, _b;
    return (_b = (_a = this.cfg) == null ? void 0 : _a.viewType) != null ? _b : VIEW_TYPE_COLABORADORES;
  }
  getDisplayText() {
    var _a, _b;
    return `${(_b = (_a = this.cfg) == null ? void 0 : _a.titulo) != null ? _b : "Colaboradores"} \u2014 Gesti\xF3n de \xE9picas`;
  }
  getIcon() {
    var _a, _b;
    return (_b = (_a = this.cfg) == null ? void 0 : _a.icon) != null ? _b : "users";
  }
  async onOpen() {
    var _a, _b;
    try {
      const refrescar = (file) => {
        const admin = (0, import_obsidian12.normalizePath)(this.plugin.settings.carpetaAdmin.trim() || "/");
        if (file.path === admin || file.path.startsWith(admin + "/"))
          this.renderSoon();
      };
      this.registerEvent(this.app.vault.on("create", refrescar));
      this.registerEvent(this.app.vault.on("delete", refrescar));
      this.registerEvent(this.app.vault.on("rename", refrescar));
      this.registerEvent(this.app.metadataCache.on("changed", (file) => refrescar(file)));
      const s = this.plugin.settings;
      const sprint = (_b = (_a = s.sprintActual) == null ? void 0 : _a.sprint) != null ? _b : 1;
      this.desde = Math.min(Math.max(sprint, 1), s.numSprints || 1);
      if (this.hasta < this.desde)
        this.hasta = this.desde;
      await this.recargar();
    } catch (e) {
      console.error("gestion-de-epicas: error en onOpen", e);
      this.render();
    }
  }
  renderSoon() {
    if (this.renderTimer !== null)
      window.clearTimeout(this.renderTimer);
    this.renderTimer = window.setTimeout(() => {
      this.renderTimer = null;
      void this.recargar();
    }, 150);
  }
  async recargar() {
    try {
      await this.recolectar();
    } catch (e) {
      console.error("gestion-de-epicas: error al recolectar", e);
    }
    this.aplicarFiltroColabPorDefecto();
    this.render();
  }
  /** La primera vez (modo colaborador) deja marcados en el filtro solo los
   * colaboradores que tienen incidencias asignadas + "Sin asignar". Después
   * respeta lo que elija el usuario. */
  aplicarFiltroColabPorDefecto() {
    if (this.cfg.agruparPor !== "colaborador" || this.filtroColabInit)
      return;
    this.filtroColabInit = true;
    for (const g of this.grupos) {
      if (g.filtroClave && g.filtroClave !== SIN_ASIGNAR && g.items.length > 0) {
        this.seleccionFiltro.add(g.filtroClave);
      }
    }
    this.seleccionFiltro.add(SIN_ASIGNAR);
  }
  /** Renderiza protegido: ante cualquier error muestra el mensaje en vez de
   * dejar la pestaña en blanco. */
  render() {
    try {
      this.renderInterno();
    } catch (e) {
      console.error("gestion-de-epicas: error al renderizar", e);
      this.contentEl.empty();
      this.contentEl.createEl("p", {
        cls: "gf-kanban-vacio",
        text: `Error al cargar la vista: ${e instanceof Error ? e.message : String(e)}`
      });
    }
  }
  listar(ref) {
    return this.cfg.incluyeTareasPendientes ? listIncidencias(this.app, ref, this.cfg.registro(this.plugin)) : listDocumentos(this.app, ref, this.cfg.registro(this.plugin));
  }
  async recolectar() {
    var _a, _b;
    this.grupos = [];
    const admin = this.plugin.settings.carpetaAdmin.trim();
    if (!admin)
      return;
    const visibles = this.plugin.settings.colaboradores.filter((c) => c.visible !== false);
    const nombresVisibles = new Set(visibles.map((c) => c.nombre));
    const porColaborador = /* @__PURE__ */ new Map();
    for (const colab of visibles)
      porColaborador.set(colab.nombre, []);
    const sinAsignar = [];
    const porContexto = /* @__PURE__ */ new Map();
    const refPorContexto = /* @__PURE__ */ new Map();
    const maxSprints = this.plugin.settings.numSprints;
    const filtrar = !(this.desde === 1 && this.hasta === maxSprints);
    const anio = (/* @__PURE__ */ new Date()).getFullYear();
    const pasaSprints = async (ref) => {
      const sprints = await leerSprints(this.app, ref);
      return sprints.some((s) => s.anio === anio && s.sprint >= this.desde && s.sprint <= this.hasta);
    };
    const recoger = (ref, contexto, epicaNombre) => {
      var _a2, _b2;
      refPorContexto.set(contexto, ref);
      if (!this.epicaConocidas.has(epicaNombre)) {
        this.epicaConocidas.add(epicaNombre);
        this.epicaSeleccion.add(epicaNombre);
      }
      for (const inc of this.listar(ref)) {
        const item = { ...inc, contexto, epicaNombre };
        if (this.cfg.agruparPor === "contexto") {
          const lista = (_a2 = porContexto.get(contexto)) != null ? _a2 : [];
          lista.push(item);
          porContexto.set(contexto, lista);
          continue;
        }
        const asignados = getAsignados(this.app, inc.file).filter((n) => nombresVisibles.has(n));
        if (asignados.length === 0) {
          sinAsignar.push(item);
          continue;
        }
        for (const nombre of asignados) {
          const lista = (_b2 = porColaborador.get(nombre)) != null ? _b2 : [];
          lista.push(item);
          porColaborador.set(nombre, lista);
        }
      }
    };
    for (const epica of listFuncionalidades(this.app, admin)) {
      const epicaPasa = !filtrar || await pasaSprints(epica);
      if (epicaPasa)
        recoger(epica, epica.nombre, epica.nombre);
      for (const fn of listFuncionalidadesDe(this.app, epica.folder)) {
        const fnPasa = epicaPasa || await pasaSprints(fn);
        if (fnPasa)
          recoger(fn, `${epica.nombre} \u203A ${fn.nombre}`, epica.nombre);
      }
    }
    if (this.cfg.agruparPor === "contexto") {
      const orden = this.plugin.settings.ordenGruposDocumentos;
      const idx = new Map(orden.map((c, i) => [c, i]));
      const claves = [...porContexto.keys()].sort((a, b) => {
        const ia = idx.get(a);
        const ib = idx.get(b);
        if (ia !== void 0 && ib !== void 0)
          return ia - ib;
        if (ia !== void 0)
          return -1;
        if (ib !== void 0)
          return 1;
        return a.localeCompare(b, "es");
      });
      for (const clave of claves) {
        this.grupos.push({
          clave,
          conProgreso: false,
          filtroClave: clave,
          ref: refPorContexto.get(clave),
          items: (_a = porContexto.get(clave)) != null ? _a : []
        });
      }
    } else {
      for (const colab of visibles) {
        this.grupos.push({
          clave: colab.nombre,
          color: colab.color,
          conProgreso: true,
          filtroClave: colab.nombre,
          items: (_b = porColaborador.get(colab.nombre)) != null ? _b : []
        });
      }
      this.grupos.push({
        clave: "Incidencias sin asignar",
        conProgreso: false,
        filtroClave: SIN_ASIGNAR,
        items: sinAsignar
      });
    }
  }
  renderInterno() {
    const cont = this.contentEl;
    cont.empty();
    cont.addClass("gf-colab");
    if (!this.cfg) {
      cont.createEl("p", { cls: "gf-kanban-vacio", text: "Vista sin configurar." });
      return;
    }
    if (!carpetasGestionListas(this.app)) {
      const aviso = cont.createDiv({ cls: "gf-kanban-aviso" });
      aviso.createEl("p", {
        text: "Crea las carpetas de gesti\xF3n desde el panel de acciones antes de continuar."
      });
      const btn = aviso.createEl("button", { text: "Abrir panel de acciones", cls: "mod-cta" });
      btn.addEventListener("click", () => void this.plugin.abrirAcciones());
      return;
    }
    const plural = this.cfg.singular === "documento" ? "documentos" : "incidencias";
    const barra = cont.createDiv({ cls: "gf-roadmap-controles" });
    const cuerpo = cont.createDiv();
    const pasaTipo = (inc) => this.tiposFiltro.size === 0 || this.tiposFiltro.has(inc.tipoNombre);
    const pasaEpica = (inc) => !this.cfg.conEpicaFilter || this.epicaSeleccion.has(inc.epicaNombre);
    const visiblesDe = (lista) => lista.filter((i) => pasaTipo(i) && pasaEpica(i));
    const renderCuerpo = () => {
      cuerpo.empty();
      const filtroColab = this.seleccionFiltro;
      let algo = false;
      for (const grupo of this.grupos) {
        if (this.cfg.agruparPor === "colaborador" && filtroColab.size > 0 && !(grupo.filtroClave && filtroColab.has(grupo.filtroClave))) {
          continue;
        }
        const items = this.ordenarItems(visiblesDe(grupo.items));
        if (items.length === 0 && this.cfg.agruparPor === "contexto")
          continue;
        if (items.length === 0 && grupo.filtroClave === SIN_ASIGNAR)
          continue;
        const dragClave = grupo.filtroClave && grupo.filtroClave !== SIN_ASIGNAR ? grupo.filtroClave : void 0;
        this.renderTarjetaGrupo(cuerpo, grupo.clave, items, grupo.color, grupo.conProgreso, dragClave, grupo.filtroClave, grupo.ref);
        algo = true;
      }
      if (!algo) {
        cuerpo.createEl("em", {
          cls: "gf-kanban-vacio",
          text: `No hay ${plural} para mostrar.`
        });
      }
    };
    const maxSprints = this.plugin.settings.numSprints;
    if (this.hasta > maxSprints)
      this.hasta = maxSprints;
    if (this.desde > maxSprints)
      this.desde = maxSprints;
    const opcionesSprint = (desde) => {
      const ops = [];
      for (let n = desde; n <= maxSprints; n++)
        ops.push({ valor: String(n), texto: `Sprint ${n}` });
      return ops;
    };
    const rango = barra.createDiv({ cls: "gf-roadmap-rango" });
    rango.createEl("span", { text: "Sprint inicio", cls: "gf-roadmap-lbl" });
    crearSelect({
      parent: rango,
      opciones: opcionesSprint(1),
      valor: String(this.desde),
      onChange: (v) => {
        this.desde = Number(v);
        if (this.hasta < this.desde)
          this.hasta = this.desde;
        finCtl.setOpciones(opcionesSprint(this.desde), String(this.hasta));
        void this.recargar();
      }
    });
    rango.createEl("span", { text: "fin", cls: "gf-roadmap-lbl" });
    const finCtl = crearSelect({
      parent: rango,
      opciones: opcionesSprint(this.desde),
      valor: String(this.hasta),
      onChange: (v) => {
        this.hasta = Number(v);
        void this.recargar();
      }
    });
    if (this.cfg.conEpicaFilter) {
      barra.createEl("span", { text: "\xC9pica", cls: "gf-roadmap-lbl" });
      const opcionesEpica = [...this.epicaConocidas].sort((a, b) => a.localeCompare(b, "es")).map((n) => ({ valor: n, texto: n }));
      crearMultiSelect({
        parent: barra,
        etiqueta: "\xC9picas",
        opciones: opcionesEpica,
        seleccion: this.epicaSeleccion,
        onChange: () => renderCuerpo()
      });
    }
    const etqTipo = this.cfg.singular === "documento" ? "Documento" : "Incidencia";
    barra.createEl("span", { text: etqTipo, cls: "gf-roadmap-lbl" });
    crearSelectorEtiquetas({
      parent: barra,
      etiquetas: this.cfg.registro(this.plugin).filter((i) => i.visible !== false),
      seleccion: this.tiposFiltro,
      textoBtn: `Filtrar por ${this.cfg.singular}`,
      textoVacio: `No hay tipos de ${this.cfg.singular}.`,
      onChange: () => renderCuerpo()
    });
    if (this.cfg.agruparPor === "colaborador") {
      const colabsFiltro = [
        ...this.plugin.settings.colaboradores.filter((c) => c.visible !== false),
        { nombre: SIN_ASIGNAR, color: "#B9BEC6" }
      ];
      barra.createEl("span", { text: "Colaborador", cls: "gf-roadmap-lbl" });
      crearSelectorEtiquetas({
        parent: barra,
        etiquetas: colabsFiltro,
        seleccion: this.seleccionFiltro,
        textoBtn: "Filtrar por colaborador",
        textoVacio: "No hay colaboradores registrados.",
        onChange: () => renderCuerpo()
      });
    }
    if (this.cfg.conMarcarHecha) {
      const verLabel = barra.createEl("label", { cls: "gf-chk" });
      const verChk = verLabel.createEl("input", { type: "checkbox" });
      verChk.checked = this.verCompletadas;
      verLabel.appendText(" Ver completadas");
      verChk.addEventListener("change", () => {
        this.verCompletadas = verChk.checked;
        renderCuerpo();
      });
    }
    const borrar = barra.createEl("button", { text: "Borrar filtros", cls: "gf-roadmap-recargar" });
    borrar.addEventListener("click", () => {
      this.tiposFiltro.clear();
      this.seleccionFiltro.clear();
      this.render();
    });
    const recargar = barra.createEl("button", { text: "Recargar", cls: "gf-roadmap-recargar" });
    recargar.addEventListener("click", () => void this.recargar());
    renderCuerpo();
  }
  colorTipo(nombre) {
    var _a, _b;
    return (_b = (_a = this.cfg.registro(this.plugin).find((i) => i.nombre === nombre)) == null ? void 0 : _a.color) != null ? _b : "#B9BEC6";
  }
  renderTarjetaGrupo(cuerpo, titulo, incidencias, color, conProgreso, dragClave, grupoFiltro, ref) {
    var _a, _b;
    const reasignable = this.cfg.agruparPor === "colaborador";
    const tarjeta = cuerpo.createDiv({ cls: "gf-colab-card" });
    if (reasignable) {
      tarjeta.addEventListener("dragover", (e) => {
        var _a2;
        if (((_a2 = this.arrastre) == null ? void 0 : _a2.tipo) !== "item" || this.arrastre.origen === grupoFiltro)
          return;
        e.preventDefault();
        tarjeta.addClass("gf-drop-card");
      });
      tarjeta.addEventListener("dragleave", () => tarjeta.removeClass("gf-drop-card"));
      tarjeta.addEventListener("drop", (e) => {
        var _a2;
        if (((_a2 = this.arrastre) == null ? void 0 : _a2.tipo) !== "item" || this.arrastre.origen === grupoFiltro)
          return;
        e.preventDefault();
        tarjeta.removeClass("gf-drop-card");
        this.confirmarReasignar(this.arrastre.valor, grupoFiltro);
      });
    }
    const head = tarjeta.createDiv({ cls: "gf-colab-head" });
    if (color) {
      const punto = head.createDiv({ cls: "gf-colab-punto" });
      punto.setCssStyles({ backgroundColor: color });
    }
    if (ref) {
      const tituloEl = head.createEl("a", { text: titulo, cls: "gf-colab-nombre internal-link" });
      tituloEl.addEventListener("click", (e) => {
        e.preventDefault();
        void this.plugin.mostrarNota(ref.file);
      });
      for (const c of getAsignados(this.app, ref.file).filter(
        (n) => this.plugin.settings.colaboradores.some((x) => x.nombre === n && x.visible !== false)
      )) {
        const colColor = (_b = (_a = this.plugin.settings.colaboradores.find((x) => x.nombre === c)) == null ? void 0 : _a.color) != null ? _b : "#B9BEC6";
        renderChipEtiqueta(head, c, colColor);
      }
    } else {
      head.createEl("span", { text: titulo, cls: "gf-colab-nombre" });
    }
    if (dragClave) {
      head.addClass("gf-arrastrable");
      head.draggable = true;
      head.addEventListener("dragstart", () => {
        this.arrastre = { tipo: "grupo", valor: dragClave };
      });
      head.addEventListener("dragend", () => {
        this.arrastre = null;
      });
      tarjeta.addEventListener("dragover", (e) => {
        var _a2;
        if (((_a2 = this.arrastre) == null ? void 0 : _a2.tipo) !== "grupo")
          return;
        e.preventDefault();
        tarjeta.addClass("gf-drop-card");
      });
      tarjeta.addEventListener("dragleave", () => tarjeta.removeClass("gf-drop-card"));
      tarjeta.addEventListener("drop", (e) => {
        var _a2;
        if (((_a2 = this.arrastre) == null ? void 0 : _a2.tipo) !== "grupo")
          return;
        e.preventDefault();
        tarjeta.removeClass("gf-drop-card");
        const origen = this.arrastre.valor;
        if (origen !== dragClave)
          void this.moverGrupo(origen, dragClave);
      });
    }
    if (conProgreso) {
      const hechas = incidencias.filter((i) => this.estadoDe(i.file) === "completado").length;
      const total = incidencias.length;
      const pct = total > 0 ? Math.round(hechas / total * 100) : 0;
      head.createEl("span", {
        cls: "gf-colab-conteo",
        text: total > 0 ? `${hechas} de ${total} hechas (${pct}%)` : "Sin elementos"
      });
      if (total > 0) {
        const barraProg = tarjeta.createDiv({ cls: "gf-kanban-progreso-barra" });
        const relleno = barraProg.createDiv({ cls: "gf-kanban-progreso-relleno" });
        relleno.setCssStyles({ width: `${pct}%` });
      }
    } else {
      head.createEl("span", { cls: "gf-colab-conteo", text: `${incidencias.length}` });
    }
    const aMostrar = this.cfg.conMarcarHecha && !this.verCompletadas ? incidencias.filter((i) => this.estadoDe(i.file) !== "completado") : incidencias;
    if (aMostrar.length > 0) {
      const ul = tarjeta.createEl("ul", { cls: "gf-colab-lista" });
      for (const inc of aMostrar) {
        const completado = this.estadoDe(inc.file) === "completado";
        const li = ul.createEl("li", { cls: completado ? "gf-colab-hecha" : "" });
        {
          li.draggable = true;
          li.addClass("gf-arrastrable");
          li.addEventListener("dragstart", (e) => {
            this.arrastre = { tipo: "item", valor: inc.file.path, origen: grupoFiltro };
            e.stopPropagation();
          });
          li.addEventListener("dragend", () => {
            this.arrastre = null;
          });
          li.addEventListener("dragover", (e) => {
            var _a2;
            if (((_a2 = this.arrastre) == null ? void 0 : _a2.tipo) !== "item")
              return;
            e.preventDefault();
            e.stopPropagation();
            li.addClass("gf-drop-card");
          });
          li.addEventListener("dragleave", () => li.removeClass("gf-drop-card"));
          li.addEventListener("drop", (e) => {
            var _a2;
            if (((_a2 = this.arrastre) == null ? void 0 : _a2.tipo) !== "item")
              return;
            e.preventDefault();
            e.stopPropagation();
            li.removeClass("gf-drop-card");
            const origen = this.arrastre.valor;
            if (reasignable && this.arrastre.origen !== grupoFiltro) {
              this.confirmarReasignar(origen, grupoFiltro);
            } else if (origen !== inc.file.path) {
              void this.moverItem(origen, inc.file.path);
            }
          });
        }
        if (this.cfg.conMarcarHecha) {
          const chk = li.createEl("input", { type: "checkbox", cls: "gf-colab-chk" });
          chk.checked = completado;
          chk.addEventListener("change", () => {
            if (chk.checked) {
              new ConfirmacionModal2(
                this.app,
                "Marcar como hecha",
                "\xBFMarcar esta incidencia como hecha? Su estado pasar\xE1 a completado.",
                "Marcar como hecha",
                () => void this.marcarEstado(inc.file, "completado"),
                () => {
                  chk.checked = false;
                }
              ).open();
            } else {
              new ConfirmacionModal2(
                this.app,
                "Marcar como pendiente",
                "\xBFQuitar el estado de completado de esta incidencia? Volver\xE1 a Por hacer.",
                "Marcar como pendiente",
                () => void this.marcarEstado(inc.file, "por-hacer"),
                () => {
                  chk.checked = true;
                }
              ).open();
            }
          });
        }
        renderChipEtiqueta(li, inc.tipoNombre, this.colorTipo(inc.tipoNombre));
        const a = li.createEl("a", { cls: "internal-link", text: inc.nombre });
        a.addEventListener("click", (e) => {
          e.preventDefault();
          void this.plugin.mostrarNota(inc.file);
        });
        if (this.cfg.agruparPor === "colaborador") {
          li.appendText(` \u2014 ${inc.contexto}`);
        }
      }
    }
  }
  async marcarEstado(file, estado) {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm.estado = estado;
    });
  }
  estadoDe(file) {
    var _a, _b;
    const estado = (_b = (_a = this.app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter) == null ? void 0 : _b.estado;
    return estado ? normalizarEstado(String(estado)) : "por-hacer";
  }
  // ===== Reordenamiento manual =====
  /** Ordena las incidencias según el orden manual guardado; las no listadas
   * conservan su orden de recolección. */
  ordenarItems(items) {
    const orden = this.plugin.settings.ordenIncidenciasColab;
    const idx = new Map(orden.map((p, i) => [p, i]));
    return [...items].sort((a, b) => {
      const ia = idx.get(a.file.path);
      const ib = idx.get(b.file.path);
      if (ia !== void 0 && ib !== void 0)
        return ia - ib;
      if (ia !== void 0)
        return -1;
      if (ib !== void 0)
        return 1;
      return 0;
    });
  }
  /** Reubica `path` antes de `beforeKey` en el orden manual de incidencias.
   * Reconstruye con todas las incidencias visibles para que el orden sea estable. */
  async moverItem(path, beforeKey) {
    const orden = this.plugin.settings.ordenIncidenciasColab;
    const idx = new Map(orden.map((p, i) => [p, i]));
    const todas = [...new Set(this.grupos.flatMap((g) => g.items.map((i) => i.file.path)))].sort(
      (a, b) => {
        const ia = idx.get(a);
        const ib = idx.get(b);
        if (ia !== void 0 && ib !== void 0)
          return ia - ib;
        if (ia !== void 0)
          return -1;
        if (ib !== void 0)
          return 1;
        return 0;
      }
    );
    const lista = todas.filter((p) => p !== path);
    const pos = lista.indexOf(beforeKey);
    if (pos === -1)
      lista.push(path);
    else
      lista.splice(pos, 0, path);
    this.plugin.settings.ordenIncidenciasColab = lista;
    await this.plugin.saveSettings();
    await this.recargar();
  }
  /** Reordena las tarjetas moviendo `clave` antes de `beforeClave`. En modo
   * colaborador reordena settings.colaboradores; en documentos, el orden de
   * grupos (épica/historia) guardado. */
  async moverGrupo(clave, beforeClave) {
    if (this.cfg.agruparPor === "contexto") {
      const actuales = this.grupos.map((g) => g.clave);
      const orden = actuales.filter((c) => c !== clave);
      const pos2 = orden.indexOf(beforeClave);
      if (pos2 === -1)
        orden.push(clave);
      else
        orden.splice(pos2, 0, clave);
      this.plugin.settings.ordenGruposDocumentos = orden;
      await this.plugin.saveSettings();
      await this.recargar();
      return;
    }
    const cols = this.plugin.settings.colaboradores;
    const i = cols.findIndex((c) => c.nombre === clave);
    if (i < 0)
      return;
    const [item] = cols.splice(i, 1);
    const pos = cols.findIndex((c) => c.nombre === beforeClave);
    if (pos === -1)
      cols.push(item);
    else
      cols.splice(pos, 0, item);
    await this.plugin.saveSettings();
    await this.recargar();
  }
  /** Pide confirmación y reasigna (reemplaza) la incidencia al colaborador del
   * carril destino; si el destino es "Sin asignar", la deja sin colaboradores. */
  confirmarReasignar(path, destino) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof import_obsidian12.TFile))
      return;
    const colaborador = !destino || destino === SIN_ASIGNAR ? null : destino;
    const mensaje = colaborador ? `\xBFReasignar esta incidencia a "${colaborador}"? Se reemplazar\xE1n los colaboradores que tenga asignados.` : "\xBFQuitar el colaborador asignado a esta incidencia?";
    new ConfirmacionModal2(
      this.app,
      "Reasignar incidencia",
      mensaje,
      colaborador ? "Reasignar" : "Quitar colaborador",
      () => void this.reasignar(file, colaborador),
      () => {
      }
    ).open();
  }
  async reasignar(file, colaborador) {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      if (colaborador)
        fm.asignados = [colaborador];
      else
        delete fm.asignados;
    });
  }
};
var ConfirmacionModal2 = class extends import_obsidian12.Modal {
  constructor(app, titulo, mensaje, textoOk, onOk, onCancel) {
    super(app);
    this.titulo = titulo;
    this.mensaje = mensaje;
    this.textoOk = textoOk;
    this.onOk = onOk;
    this.onCancel = onCancel;
    this.resuelto = false;
  }
  onOpen() {
    this.titleEl.setText(this.titulo);
    this.contentEl.createEl("p", { text: this.mensaje });
    const row = this.contentEl.createDiv({ cls: "gf-botones" });
    const cancelar = row.createEl("button", { text: "Cancelar" });
    cancelar.addEventListener("click", () => {
      this.resuelto = true;
      this.onCancel();
      this.close();
    });
    const ok = row.createEl("button", { text: this.textoOk, cls: "mod-cta" });
    ok.addEventListener("click", () => {
      this.resuelto = true;
      this.onOk();
      this.close();
    });
  }
  onClose() {
    this.contentEl.empty();
    if (!this.resuelto)
      this.onCancel();
  }
};

// src/organizar-documentos.ts
var import_obsidian13 = require("obsidian");
var VIEW_TYPE_ORGANIZAR_DOCS = "gestor-funciones-organizar-docs";
var OrganizarDocumentosView = class extends import_obsidian13.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.renderTimer = null;
    this.epicaSlug = "";
    this.epicas = [];
    this.docs = [];
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_ORGANIZAR_DOCS;
  }
  getDisplayText() {
    return "Tablero de documentos \u2014 Gesti\xF3n de \xE9picas";
  }
  getIcon() {
    return "layout-grid";
  }
  async onOpen() {
    try {
      const refrescar = (file) => {
        const admin = (0, import_obsidian13.normalizePath)(this.plugin.settings.carpetaAdmin.trim() || "/");
        if (file.path === admin || file.path.startsWith(admin + "/"))
          this.renderSoon();
      };
      this.registerEvent(this.app.vault.on("create", refrescar));
      this.registerEvent(this.app.vault.on("delete", refrescar));
      this.registerEvent(this.app.vault.on("rename", refrescar));
      this.recargar();
    } catch (e) {
      console.error("gestion-de-epicas: error en onOpen (organizar documentos)", e);
      this.render();
    }
  }
  /** Relee desde disco y vuelve a renderizar. */
  recargar() {
    this.recolectar();
    this.render();
  }
  renderSoon() {
    if (this.renderTimer !== null)
      window.clearTimeout(this.renderTimer);
    this.renderTimer = window.setTimeout(() => {
      this.renderTimer = null;
      this.recargar();
    }, 150);
  }
  epicaActual() {
    var _a;
    return (_a = this.epicas.find((e) => e.slug === this.epicaSlug)) != null ? _a : null;
  }
  recolectar() {
    const admin = this.plugin.settings.carpetaAdmin.trim();
    this.epicas = admin ? listFuncionalidades(this.app, admin) : [];
    this.docs = [];
    const ep = this.epicaActual();
    if (!ep)
      return;
    const tipos = this.plugin.settings.documentos;
    const agregar = (ref) => {
      for (const doc of listDocumentos(this.app, ref, tipos)) {
        this.docs.push({ file: doc.file, nombre: doc.nombre, tipoNombre: doc.tipoNombre });
      }
    };
    agregar(ep);
    for (const fn of listFuncionalidadesDe(this.app, ep.folder))
      agregar(fn);
  }
  // ----- Persistencia (por épica) -----
  /** Organización de la épica actual en modo lectura (no crea la entrada). */
  datos() {
    var _a;
    return (_a = this.plugin.settings.organizacionDocs[this.epicaSlug]) != null ? _a : {
      carriles: [],
      asignacion: {},
      orden: []
    };
  }
  /** Organización de la épica actual, creando la entrada si no existe (para mutar). */
  datosEditable() {
    const mapa = this.plugin.settings.organizacionDocs;
    let d = mapa[this.epicaSlug];
    if (!d) {
      d = { carriles: [], asignacion: {}, orden: [] };
      mapa[this.epicaSlug] = d;
    }
    return d;
  }
  /** Carril donde vive un documento; si su carril ya no existe, va al de "Todos". */
  carrilDe(path) {
    const d = this.datos();
    const lane = d.asignacion[path];
    if (lane && lane !== CARRIL_DOCS_TODOS && d.carriles.some((c) => c.id === lane))
      return lane;
    return CARRIL_DOCS_TODOS;
  }
  colorTipo(nombre) {
    var _a, _b;
    return (_b = (_a = this.plugin.settings.documentos.find((t) => t.nombre === nombre)) == null ? void 0 : _a.color) != null ? _b : "#B9BEC6";
  }
  // ----- Render -----
  render() {
    try {
      this.renderInterno();
    } catch (e) {
      console.error("gestion-de-epicas: error al renderizar (organizar documentos)", e);
      this.contentEl.empty();
      this.contentEl.createEl("p", {
        cls: "gf-kanban-vacio",
        text: `Error al cargar la vista: ${e instanceof Error ? e.message : String(e)}`
      });
    }
  }
  renderInterno() {
    const cont = this.contentEl;
    cont.empty();
    cont.addClass("gf-kanban");
    cont.addClass("gf-orgdocs");
    if (!carpetasGestionListas(this.app)) {
      const aviso = cont.createDiv({ cls: "gf-kanban-aviso" });
      aviso.createEl("p", {
        text: "Crea las carpetas de gesti\xF3n desde el panel de acciones antes de usar el Tablero de documentos."
      });
      const btn = aviso.createEl("button", { text: "Abrir panel de acciones", cls: "mod-cta" });
      btn.addEventListener("click", () => void this.plugin.abrirAcciones());
      return;
    }
    const barra = cont.createDiv({ cls: "gf-roadmap-controles" });
    barra.createEl("span", { text: "\xC9pica", cls: "gf-roadmap-lbl" });
    const epicaSel = barra.createEl("select", { cls: "dropdown" });
    epicaSel.createEl("option", { text: "Seleccionar \xE9pica", value: "" });
    for (const ep of this.epicas)
      epicaSel.createEl("option", { text: ep.nombre, value: ep.slug });
    epicaSel.value = this.epicaSlug;
    epicaSel.addEventListener("change", () => {
      this.epicaSlug = epicaSel.value;
      this.recargar();
    });
    if (this.epicaActual()) {
      const agregar = barra.createEl("button", { text: "Agregar carril", cls: "gf-roadmap-recargar" });
      agregar.addEventListener("click", () => this.agregarCarril());
    }
    const recargar = barra.createEl("button", { text: "Recargar", cls: "gf-roadmap-recargar" });
    recargar.setAttr("title", "Releer las notas desde el disco");
    recargar.addEventListener("click", () => this.recargar());
    if (!this.epicaActual()) {
      cont.createDiv({ cls: "gf-kanban-vacio", text: "Selecciona una \xE9pica." });
      return;
    }
    this.renderBoard(cont);
  }
  renderBoard(cont) {
    const board = cont.createDiv({ cls: "gf-orgdocs-board" });
    const carriles = [
      { id: CARRIL_DOCS_TODOS, nombre: "Todos los documentos", fijo: true },
      ...this.datos().carriles.map((c) => ({ ...c, fijo: false }))
    ];
    for (const carril of carriles)
      this.renderCarril(board, carril);
  }
  renderCarril(board, carril) {
    const colEl = board.createDiv({ cls: "gf-orgdocs-carril" });
    colEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      colEl.addClass("gf-drop");
    });
    colEl.addEventListener("dragleave", () => colEl.removeClass("gf-drop"));
    colEl.addEventListener("drop", (e) => {
      e.preventDefault();
      colEl.removeClass("gf-drop");
      const payload = leerPayload3(e);
      if (payload)
        this.soltar(payload.path, carril.id, null);
    });
    const header = colEl.createDiv({ cls: "gf-orgdocs-header" });
    header.createEl("span", { cls: "gf-kanban-titulo", text: carril.nombre });
    const cards = this.ordenar(this.docs.filter((c) => this.carrilDe(c.file.path) === carril.id));
    header.createEl("span", { cls: "gf-kanban-conteo", text: String(cards.length) });
    if (!carril.fijo) {
      const acciones = header.createDiv({ cls: "gf-orgdocs-carril-acciones" });
      const renombrar = acciones.createEl("button", { cls: "gf-orgdocs-icono-btn" });
      (0, import_obsidian13.setIcon)(renombrar, "pencil");
      renombrar.setAttr("aria-label", "Renombrar carril");
      renombrar.addEventListener("click", () => this.renombrarCarril(carril));
      const eliminar = acciones.createEl("button", { cls: "gf-orgdocs-icono-btn" });
      (0, import_obsidian13.setIcon)(eliminar, "trash-2");
      eliminar.setAttr("aria-label", "Eliminar carril");
      eliminar.addEventListener("click", () => this.eliminarCarril(carril));
    }
    const cuerpo = colEl.createDiv({ cls: "gf-orgdocs-cuerpo" });
    if (cards.length === 0) {
      cuerpo.createDiv({ cls: "gf-kanban-vacio", text: "Sin documentos." });
    }
    for (const card of cards)
      this.renderTarjeta(cuerpo, card, carril.id);
  }
  renderTarjeta(cuerpo, card, carrilId) {
    const el = cuerpo.createDiv({ cls: "gf-kanban-card gf-orgdocs-card" });
    el.draggable = true;
    el.addEventListener("dragstart", (e) => {
      var _a;
      (_a = e.dataTransfer) == null ? void 0 : _a.setData(
        "text/plain",
        JSON.stringify({ path: card.file.path })
      );
    });
    el.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.addClass("gf-drop-card");
    });
    el.addEventListener("dragleave", () => el.removeClass("gf-drop-card"));
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.removeClass("gf-drop-card");
      const payload = leerPayload3(e);
      if (payload && payload.path !== card.file.path) {
        this.soltar(payload.path, carrilId, card.file.path);
      }
    });
    renderChipEtiqueta(el, card.tipoNombre, this.colorTipo(card.tipoNombre));
    el.createSpan({ cls: "gf-orgdocs-card-nombre", text: card.nombre });
    el.addEventListener("click", () => void this.plugin.mostrarNota(card.file));
  }
  // ----- Orden manual (por épica) -----
  ordenar(cards) {
    const orden = this.datos().orden;
    const idx = new Map(orden.map((p, i) => [p, i]));
    return [...cards].sort((a, b) => {
      const ia = idx.get(a.file.path);
      const ib = idx.get(b.file.path);
      if (ia !== void 0 && ib !== void 0)
        return ia - ib;
      if (ia !== void 0)
        return -1;
      if (ib !== void 0)
        return 1;
      return a.nombre.localeCompare(b.nombre, "es");
    });
  }
  /** Reposiciona `path` antes de `beforeKey` (o al final) en el orden de la épica. */
  posicionar(path, beforeKey) {
    const d = this.datosEditable();
    const orden = this.ordenar(this.docs).map((c) => c.file.path).filter((p) => p !== path);
    const pos = beforeKey ? orden.indexOf(beforeKey) : -1;
    if (pos === -1)
      orden.push(path);
    else
      orden.splice(pos, 0, path);
    d.orden = orden;
  }
  /** Asigna el carril del documento y/o lo reordena dentro de él. */
  soltar(path, carrilId, beforeKey) {
    if (!this.docs.some((c) => c.file.path === path))
      return;
    const d = this.datosEditable();
    this.posicionar(path, beforeKey);
    if (carrilId === CARRIL_DOCS_TODOS)
      delete d.asignacion[path];
    else
      d.asignacion[path] = carrilId;
    void this.plugin.saveSettings();
    this.render();
  }
  // ----- Carriles -----
  agregarCarril() {
    new NombreCarrilModal(this.plugin, "Nuevo carril", "", (nombre) => {
      const d = this.datosEditable();
      d.carriles.push({ id: nuevoId(), nombre });
      void this.plugin.saveSettings();
      this.render();
    }).open();
  }
  renombrarCarril(carril) {
    new NombreCarrilModal(this.plugin, "Renombrar carril", carril.nombre, (nombre) => {
      const d = this.datosEditable();
      const c = d.carriles.find((x) => x.id === carril.id);
      if (c)
        c.nombre = nombre;
      void this.plugin.saveSettings();
      this.render();
    }).open();
  }
  eliminarCarril(carril) {
    const d = this.datosEditable();
    d.carriles = d.carriles.filter((c) => c.id !== carril.id);
    for (const [path, lane] of Object.entries(d.asignacion)) {
      if (lane === carril.id)
        delete d.asignacion[path];
    }
    void this.plugin.saveSettings();
    this.render();
  }
};
function leerPayload3(e) {
  var _a;
  const raw = (_a = e.dataTransfer) == null ? void 0 : _a.getData("text/plain");
  if (!raw)
    return null;
  try {
    return JSON.parse(raw);
  } catch (e2) {
    return null;
  }
}
function nuevoId() {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
var NombreCarrilModal = class extends import_obsidian13.Modal {
  constructor(plugin, titulo, valor, onGuardar) {
    super(plugin.app);
    this.titulo = titulo;
    this.valor = valor;
    this.onGuardar = onGuardar;
  }
  onOpen() {
    this.titleEl.setText(this.titulo);
    const input = this.contentEl.createEl("input", {
      type: "text",
      cls: "gf-orgdocs-nombre-input",
      value: this.valor
    });
    input.placeholder = "Nombre del carril";
    const guardar = () => {
      const nombre = input.value.trim();
      if (!nombre)
        return;
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
    const cancelar = row.createEl("button", { text: "Cancelar" });
    cancelar.addEventListener("click", () => this.close());
    const ok = row.createEl("button", { text: "Guardar", cls: "mod-cta" });
    ok.addEventListener("click", guardar);
    window.setTimeout(() => input.focus(), 0);
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/historias.ts
var import_obsidian14 = require("obsidian");
var VIEW_TYPE_HISTORIAS = "gestor-funciones-historias";
var HistoriasView = class extends import_obsidian14.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.renderTimer = null;
    this.grupos = [];
    /** Historia en arrastre: ruta de su nota y slug de su épica de origen. */
    this.arrastre = null;
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_HISTORIAS;
  }
  getDisplayText() {
    return "Historias \u2014 Gesti\xF3n de \xE9picas";
  }
  getIcon() {
    return "folder-tree";
  }
  async onOpen() {
    const refrescar = (file) => {
      const admin = (0, import_obsidian14.normalizePath)(this.plugin.settings.carpetaAdmin.trim() || "/");
      if (file.path === admin || file.path.startsWith(admin + "/"))
        this.renderSoon();
    };
    this.registerEvent(this.app.vault.on("create", refrescar));
    this.registerEvent(this.app.vault.on("delete", refrescar));
    this.registerEvent(this.app.vault.on("rename", refrescar));
    this.recargar();
  }
  recargar() {
    this.recolectar();
    this.render();
  }
  renderSoon() {
    if (this.renderTimer !== null)
      window.clearTimeout(this.renderTimer);
    this.renderTimer = window.setTimeout(() => {
      this.renderTimer = null;
      this.recargar();
    }, 150);
  }
  recolectar() {
    const admin = this.plugin.settings.carpetaAdmin.trim();
    const epicas = admin ? listFuncionalidades(this.app, admin) : [];
    this.grupos = epicas.map((epica) => ({
      epica,
      historias: listFuncionalidadesDe(this.app, epica.folder)
    }));
  }
  render() {
    const cont = this.contentEl;
    cont.empty();
    cont.addClass("gf-colab");
    if (!carpetasGestionListas(this.app)) {
      const aviso = cont.createDiv({ cls: "gf-kanban-aviso" });
      aviso.createEl("p", {
        text: "Crea las carpetas de gesti\xF3n desde el panel de acciones antes de continuar."
      });
      const btn = aviso.createEl("button", { text: "Abrir panel de acciones", cls: "mod-cta" });
      btn.addEventListener("click", () => void this.plugin.abrirAcciones());
      return;
    }
    const barra = cont.createDiv({ cls: "gf-roadmap-controles" });
    const recargar = barra.createEl("button", { text: "Recargar", cls: "gf-roadmap-recargar" });
    recargar.addEventListener("click", () => this.recargar());
    if (this.grupos.length === 0) {
      cont.createDiv({ cls: "gf-kanban-vacio", text: "No hay \xE9picas." });
      return;
    }
    const cuerpo = cont.createDiv();
    for (const grupo of this.grupos)
      this.renderGrupo(cuerpo, grupo);
  }
  renderGrupo(cuerpo, grupo) {
    var _a, _b;
    const tarjeta = cuerpo.createDiv({ cls: "gf-colab-card" });
    tarjeta.addEventListener("dragover", (e) => {
      if (!this.arrastre || this.arrastre.origenSlug === grupo.epica.slug)
        return;
      e.preventDefault();
      tarjeta.addClass("gf-drop-card");
    });
    tarjeta.addEventListener("dragleave", () => tarjeta.removeClass("gf-drop-card"));
    tarjeta.addEventListener("drop", (e) => {
      if (!this.arrastre || this.arrastre.origenSlug === grupo.epica.slug)
        return;
      e.preventDefault();
      tarjeta.removeClass("gf-drop-card");
      this.confirmarMover(this.arrastre.ref, grupo.epica);
    });
    const head = tarjeta.createDiv({ cls: "gf-colab-head" });
    const titulo = head.createEl("a", { text: grupo.epica.nombre, cls: "gf-colab-nombre internal-link" });
    titulo.addEventListener("click", (e) => {
      e.preventDefault();
      void this.plugin.mostrarNota(grupo.epica.file);
    });
    const colabs = getAsignados(this.app, grupo.epica.file).filter(
      (n) => this.plugin.settings.colaboradores.some((c) => c.nombre === n && c.visible !== false)
    );
    for (const c of colabs) {
      renderChipEtiqueta(head, c, this.colorColab(c));
    }
    head.createEl("span", { cls: "gf-colab-conteo", text: String(grupo.historias.length) });
    if (grupo.historias.length === 0) {
      tarjeta.createEl("em", { cls: "gf-kanban-vacio", text: "Sin historias." });
      return;
    }
    const colorEtq = new Map(leerEtiquetasEpica(this.app, grupo.epica).map((e) => [e.nombre, e.color]));
    const ul = tarjeta.createEl("ul", { cls: "gf-colab-lista" });
    for (const hist of grupo.historias) {
      const completado = normalizarEstado((_a = hist.estado) != null ? _a : "") === "completado";
      const li = ul.createEl("li", { cls: "gf-arrastrable" + (completado ? " gf-colab-hecha" : "") });
      li.draggable = true;
      li.addEventListener("dragstart", () => {
        this.arrastre = { ref: hist, origenSlug: grupo.epica.slug };
      });
      li.addEventListener("dragend", () => {
        this.arrastre = null;
      });
      const chk = li.createEl("input", { type: "checkbox", cls: "gf-colab-chk" });
      chk.checked = completado;
      chk.addEventListener("change", () => {
        const quiere = chk.checked;
        chk.checked = !quiere;
        this.confirmarEstado(hist, quiere);
      });
      for (const etq of leerEtiquetasHistoria(this.app, hist.file)) {
        renderChipEtiqueta(li, etq, (_b = colorEtq.get(etq)) != null ? _b : "#B9BEC6");
      }
      const a = li.createEl("a", { cls: "internal-link", text: hist.nombre });
      a.addEventListener("click", (e) => {
        e.preventDefault();
        void this.plugin.mostrarNota(hist.file);
      });
    }
  }
  /** Pide confirmación y marca la historia como completada / por hacer. */
  confirmarEstado(hist, completar) {
    const [titulo, mensaje, ok] = completar ? ["Marcar como hecha", "\xBFMarcar esta historia como hecha? Su estado pasar\xE1 a completado.", "Marcar como hecha"] : ["Marcar como pendiente", "\xBFQuitar el estado de completado de esta historia? Volver\xE1 a Por hacer.", "Marcar como pendiente"];
    new ConfirmacionModal(this.plugin, titulo, mensaje, ok, async () => {
      const estado = completar ? "completado" : "por-hacer";
      await this.app.fileManager.processFrontMatter(hist.file, (fm) => {
        fm.estado = estado;
      });
      hist.estado = estado;
      this.render();
    }).open();
  }
  colorColab(nombre) {
    var _a, _b;
    return (_b = (_a = this.plugin.settings.colaboradores.find((c) => c.nombre === nombre)) == null ? void 0 : _a.color) != null ? _b : "#B9BEC6";
  }
  confirmarMover(historia, destino) {
    new ConfirmacionModal(
      this.plugin,
      "Mover historia",
      `\xBFMover la historia "${historia.nombre}" a la \xE9pica "${destino.nombre}"? Se mover\xE1 con todo su contenido (incidencias, documentos y notas).`,
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
};

// src/etiquetar-historias.ts
var import_obsidian15 = require("obsidian");
var VIEW_TYPE_ETIQUETAR_HISTORIAS = "gestor-funciones-etiquetar-historias";
var SIN_ETIQUETA = "";
var EtiquetarHistoriasView = class extends import_obsidian15.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.renderTimer = null;
    this.epicaSlug = "";
    this.epicas = [];
    this.historias = [];
    /** Etiquetas de la épica (carriles personalizados). */
    this.etiquetas = [];
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_ETIQUETAR_HISTORIAS;
  }
  getDisplayText() {
    return "Etiquetas de historias \u2014 Gesti\xF3n de \xE9picas";
  }
  getIcon() {
    return "tags";
  }
  async onOpen() {
    const refrescar = (file) => {
      const admin = (0, import_obsidian15.normalizePath)(this.plugin.settings.carpetaAdmin.trim() || "/");
      if (file.path === admin || file.path.startsWith(admin + "/"))
        this.renderSoon();
    };
    this.registerEvent(this.app.vault.on("create", refrescar));
    this.registerEvent(this.app.vault.on("delete", refrescar));
    this.registerEvent(this.app.vault.on("rename", refrescar));
    this.registerEvent(this.app.metadataCache.on("changed", (file) => refrescar(file)));
    this.recargar();
  }
  recargar() {
    this.recolectar();
    this.render();
  }
  renderSoon() {
    if (this.renderTimer !== null)
      window.clearTimeout(this.renderTimer);
    this.renderTimer = window.setTimeout(() => {
      this.renderTimer = null;
      this.recargar();
    }, 150);
  }
  epicaActual() {
    var _a;
    return (_a = this.epicas.find((e) => e.slug === this.epicaSlug)) != null ? _a : null;
  }
  recolectar() {
    var _a;
    const admin = this.plugin.settings.carpetaAdmin.trim();
    this.epicas = admin ? listFuncionalidades(this.app, admin) : [];
    this.historias = [];
    this.etiquetas = [];
    const ep = this.epicaActual();
    if (!ep)
      return;
    this.etiquetas = leerEtiquetasEpica(this.app, ep);
    const nombresValidos = new Set(this.etiquetas.map((e) => e.nombre));
    for (const h of listFuncionalidadesDe(this.app, ep.folder)) {
      const etiqueta = (_a = leerEtiquetasHistoria(this.app, h.file).find((n) => nombresValidos.has(n))) != null ? _a : SIN_ETIQUETA;
      this.historias.push({ file: h.file, nombre: h.nombre, etiqueta });
    }
  }
  colorEtiqueta(nombre) {
    var _a, _b;
    return (_b = (_a = this.etiquetas.find((e) => e.nombre === nombre)) == null ? void 0 : _a.color) != null ? _b : "#B9BEC6";
  }
  render() {
    const cont = this.contentEl;
    cont.empty();
    cont.addClass("gf-kanban");
    cont.addClass("gf-orgdocs");
    if (!carpetasGestionListas(this.app)) {
      const aviso = cont.createDiv({ cls: "gf-kanban-aviso" });
      aviso.createEl("p", {
        text: "Crea las carpetas de gesti\xF3n desde el panel de acciones antes de usar Etiquetas de historias."
      });
      const btn = aviso.createEl("button", { text: "Abrir panel de acciones", cls: "mod-cta" });
      btn.addEventListener("click", () => void this.plugin.abrirAcciones());
      return;
    }
    const barra = cont.createDiv({ cls: "gf-roadmap-controles" });
    barra.createEl("span", { text: "\xC9pica", cls: "gf-roadmap-lbl" });
    const epicaSel = barra.createEl("select", { cls: "dropdown" });
    epicaSel.createEl("option", { text: "Seleccionar \xE9pica", value: "" });
    for (const ep of this.epicas)
      epicaSel.createEl("option", { text: ep.nombre, value: ep.slug });
    epicaSel.value = this.epicaSlug;
    epicaSel.addEventListener("change", () => {
      this.epicaSlug = epicaSel.value;
      this.recargar();
    });
    if (this.epicaActual()) {
      const agregar = barra.createEl("button", { text: "Agregar etiqueta", cls: "gf-roadmap-recargar" });
      agregar.addEventListener("click", () => this.agregarEtiqueta());
    }
    const recargar = barra.createEl("button", { text: "Recargar", cls: "gf-roadmap-recargar" });
    recargar.addEventListener("click", () => this.recargar());
    if (!this.epicaActual()) {
      cont.createDiv({ cls: "gf-kanban-vacio", text: "Selecciona una \xE9pica." });
      return;
    }
    const board = cont.createDiv({ cls: "gf-orgdocs-board" });
    this.renderCarril(board, { nombre: SIN_ETIQUETA, titulo: "Sin etiqueta", fija: true });
    for (const et of this.etiquetas) {
      this.renderCarril(board, { nombre: et.nombre, titulo: et.nombre, fija: false });
    }
  }
  renderCarril(board, carril) {
    const colEl = board.createDiv({ cls: "gf-orgdocs-carril" });
    colEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      colEl.addClass("gf-drop");
    });
    colEl.addEventListener("dragleave", () => colEl.removeClass("gf-drop"));
    colEl.addEventListener("drop", (e) => {
      var _a;
      e.preventDefault();
      colEl.removeClass("gf-drop");
      const path = (_a = e.dataTransfer) == null ? void 0 : _a.getData("text/plain");
      if (path)
        void this.asignar(path, carril.nombre);
    });
    const header = colEl.createDiv({ cls: "gf-orgdocs-header" });
    if (!carril.fija) {
      const punto = header.createDiv({ cls: "gf-kanban-dot" });
      punto.setCssStyles({ backgroundColor: this.colorEtiqueta(carril.nombre) });
    }
    header.createEl("span", { cls: "gf-kanban-titulo", text: carril.titulo });
    const cards = this.historias.filter((h) => h.etiqueta === carril.nombre).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    header.createEl("span", { cls: "gf-kanban-conteo", text: String(cards.length) });
    if (!carril.fija) {
      const acciones = header.createDiv({ cls: "gf-orgdocs-carril-acciones" });
      const renombrar = acciones.createEl("button", { cls: "gf-orgdocs-icono-btn" });
      (0, import_obsidian15.setIcon)(renombrar, "pencil");
      renombrar.setAttr("aria-label", "Renombrar etiqueta");
      renombrar.addEventListener("click", () => this.renombrarEtiqueta(carril.nombre));
      const eliminar = acciones.createEl("button", { cls: "gf-orgdocs-icono-btn" });
      (0, import_obsidian15.setIcon)(eliminar, "trash-2");
      eliminar.setAttr("aria-label", "Eliminar etiqueta");
      eliminar.addEventListener("click", () => this.eliminarEtiqueta(carril.nombre));
    }
    const cuerpo = colEl.createDiv({ cls: "gf-orgdocs-cuerpo" });
    if (cards.length === 0) {
      cuerpo.createDiv({ cls: "gf-kanban-vacio", text: "Sin historias." });
    }
    for (const card of cards)
      this.renderTarjeta(cuerpo, card);
  }
  renderTarjeta(cuerpo, card) {
    const el = cuerpo.createDiv({ cls: "gf-kanban-card gf-orgdocs-card" });
    el.draggable = true;
    el.addEventListener("dragstart", (e) => {
      var _a;
      (_a = e.dataTransfer) == null ? void 0 : _a.setData("text/plain", card.file.path);
    });
    if (card.etiqueta) {
      renderChipEtiqueta(el, card.etiqueta, this.colorEtiqueta(card.etiqueta));
    }
    el.createSpan({ cls: "gf-orgdocs-card-nombre", text: card.nombre });
    el.addEventListener("click", () => void this.plugin.mostrarNota(card.file));
  }
  /** Asigna (reemplaza) la etiqueta de la historia: una etiqueta por historia. */
  async asignar(path, etiqueta) {
    const card = this.historias.find((h) => h.file.path === path);
    if (!card || card.etiqueta === etiqueta)
      return;
    await guardarEtiquetasHistoria(this.app, card.file, etiqueta ? [etiqueta] : []);
    this.recargar();
  }
  agregarEtiqueta() {
    const ep = this.epicaActual();
    if (!ep)
      return;
    new NombrePromptModal(this.plugin, "Nueva etiqueta", "", colorAleatorio(), (nombre, color) => {
      if (this.etiquetas.some((e) => e.nombre === nombre))
        return;
      const nuevas = [...this.etiquetas, { nombre, color, visible: true }];
      void (async () => {
        await guardarEtiquetasEpica(this.app, ep, nuevas);
        this.recargar();
      })();
    }).open();
  }
  renombrarEtiqueta(nombre) {
    var _a;
    const ep = this.epicaActual();
    if (!ep)
      return;
    const actual = this.etiquetas.find((e) => e.nombre === nombre);
    new NombrePromptModal(
      this.plugin,
      "Editar etiqueta",
      nombre,
      (_a = actual == null ? void 0 : actual.color) != null ? _a : colorAleatorio(),
      (nuevo, color) => {
        if (nuevo !== nombre && this.etiquetas.some((e) => e.nombre === nuevo))
          return;
        void (async () => {
          const nuevas = this.etiquetas.map(
            (e) => e.nombre === nombre ? { ...e, nombre: nuevo, color } : e
          );
          await guardarEtiquetasEpica(this.app, ep, nuevas);
          if (nuevo !== nombre)
            await renombrarEtiquetaHistoria(this.app, ep, nombre, nuevo);
          this.recargar();
        })();
      }
    ).open();
  }
  eliminarEtiqueta(nombre) {
    const ep = this.epicaActual();
    if (!ep)
      return;
    new ConfirmacionModal(
      this.plugin,
      "Eliminar etiqueta",
      `\xBFEliminar la etiqueta "${nombre}"? Se quitar\xE1 de la \xE9pica y de todas las historias que la tengan.`,
      "Eliminar",
      async () => {
        const nuevas = this.etiquetas.filter((e) => e.nombre !== nombre);
        await guardarEtiquetasEpica(this.app, ep, nuevas);
        await eliminarEtiquetaHistoria(this.app, ep, nombre);
        this.recargar();
      }
    ).open();
  }
};
var NombrePromptModal = class extends import_obsidian15.Modal {
  constructor(plugin, titulo, valor, colorInicial, onGuardar) {
    super(plugin.app);
    this.titulo = titulo;
    this.valor = valor;
    this.colorInicial = colorInicial;
    this.onGuardar = onGuardar;
  }
  onOpen() {
    this.titleEl.setText(this.titulo);
    const input = this.contentEl.createEl("input", {
      type: "text",
      cls: "gf-orgdocs-nombre-input",
      value: this.valor
    });
    input.placeholder = "Nombre de la etiqueta";
    const colorRow = this.contentEl.createDiv({ cls: "gf-campo" });
    colorRow.createEl("label", { text: "Color", cls: "gf-campo-label" });
    const selectorColor = renderSelectorColor(colorRow, this.colorInicial);
    const guardar = () => {
      const nombre = input.value.trim();
      if (!nombre)
        return;
      this.onGuardar(nombre, selectorColor.getColor());
      this.close();
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        guardar();
      }
    });
    const row = this.contentEl.createDiv({ cls: "gf-botones" });
    const cancelar = row.createEl("button", { text: "Cancelar" });
    cancelar.addEventListener("click", () => this.close());
    const ok = row.createEl("button", { text: "Guardar", cls: "mod-cta" });
    ok.addEventListener("click", guardar);
    window.setTimeout(() => input.focus(), 0);
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/main.ts
function sanearOrganizacionDocs(valor) {
  const out = {};
  if (!valor || typeof valor !== "object")
    return out;
  for (const [slug, crudo] of Object.entries(valor)) {
    if (!crudo || typeof crudo !== "object")
      continue;
    const o = crudo;
    const carriles = Array.isArray(o.carriles) ? o.carriles.map((c) => {
      var _a, _b;
      if (!c || typeof c !== "object")
        return null;
      const r = c;
      const id = String((_a = r.id) != null ? _a : "").trim();
      const nombre = String((_b = r.nombre) != null ? _b : "").trim();
      return id && nombre ? { id, nombre } : null;
    }).filter((c) => c !== null) : [];
    const asignacion = {};
    if (o.asignacion && typeof o.asignacion === "object") {
      for (const [path, lane] of Object.entries(o.asignacion)) {
        asignacion[path] = String(lane);
      }
    }
    const orden = Array.isArray(o.orden) ? o.orden.map(String) : [];
    out[slug] = { carriles, asignacion, orden };
  }
  return out;
}
var GestorFuncionesPlugin = class extends import_obsidian16.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    /** Última config escrita a la bóveda (para no reescribir si no cambió). */
    this.configBovedaUltima = "";
  }
  async onload() {
    await this.loadSettings();
    this.app.workspace.onLayoutReady(() => void migrarCarpetasHistorias(this.app));
    (0, import_obsidian16.addIcon)(ICONO_PLUGIN, ICONO_PLUGIN_SVG);
    this.addSettingTab(new GestorSettingTab(this.app, this));
    registerDashboard(this);
    this.registerView(VIEW_TYPE_ACCIONES, (leaf) => new AccionesView(leaf, this));
    this.addRibbonIcon(
      ICONO_PLUGIN,
      "Gesti\xF3n de \xE9picas: Panel de acciones",
      () => void this.toggleAcciones()
    );
    this.registerView(VIEW_TYPE_KANBAN, (leaf) => new KanbanView(leaf, this));
    this.registerView(VIEW_TYPE_GESTOR_FN, (leaf) => new GestorFuncionalidadesView(leaf, this));
    this.registerView(VIEW_TYPE_ROADMAP, (leaf) => new RoadmapView(leaf, this));
    this.registerView(
      VIEW_TYPE_COLABORADORES,
      (leaf) => new TareasColaboradorView(leaf, this, CONFIG_INCIDENCIAS)
    );
    this.registerView(
      VIEW_TYPE_DOCUMENTOS,
      (leaf) => new TareasColaboradorView(leaf, this, CONFIG_DOCUMENTOS)
    );
    this.registerView(
      VIEW_TYPE_ORGANIZAR_DOCS,
      (leaf) => new OrganizarDocumentosView(leaf, this)
    );
    this.registerView(VIEW_TYPE_HISTORIAS, (leaf) => new HistoriasView(leaf, this));
    this.registerView(
      VIEW_TYPE_ETIQUETAR_HISTORIAS,
      (leaf) => new EtiquetarHistoriasView(leaf, this)
    );
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor) => {
        menu.addItem(
          (item) => item.setTitle("Agregar link").setIcon("link").onClick(() => new AgregarLinkModal(this, editor).open())
        );
      })
    );
    this.addCommand({
      id: "crear-funcionalidad",
      name: "Crear \xE9pica",
      callback: () => this.abrirModal("funcionalidad")
    });
    this.addCommand({
      id: "crear-funcionalidad-modulo",
      name: "Crear historia",
      callback: () => this.abrirModal("crearfn")
    });
    this.addCommand({
      id: "asignar-etiquetas",
      name: "Etiquetas de historias",
      callback: () => void this.abrirEtiquetarHistorias()
    });
    this.addCommand({
      id: "configurar-incidencias",
      name: "Configurar incidencias",
      callback: () => this.abrirModal("configIncidencias")
    });
    this.addCommand({
      id: "crear-incidencia",
      name: "Crear incidencia",
      callback: () => this.abrirModal("incidencia")
    });
    this.addCommand({
      id: "crear-tarea",
      name: "Crear tarea",
      callback: () => this.abrirModal("tarea")
    });
    this.addCommand({
      id: "crear-pendiente",
      name: "Crear pendiente",
      callback: () => this.abrirModal("pendiente")
    });
    this.addCommand({
      id: "asignar-sprints",
      name: "Asignar sprint",
      callback: () => this.abrirModal("sprint")
    });
    this.addCommand({
      id: "editar-nombre",
      name: "Editar nombre de \xE9pica o historia",
      callback: () => this.abrirModal("editarNombre")
    });
    this.addCommand({
      id: "mover-historia",
      name: "Historias",
      callback: () => void this.abrirHistorias()
    });
    this.addCommand({
      id: "editar-incidencia",
      name: "Editar incidencia (tipo / mover)",
      callback: () => this.abrirModal("editarIncidencia")
    });
    this.addCommand({
      id: "configurar-documentos",
      name: "Configurar documentos",
      callback: () => this.abrirModal("configDocumentos")
    });
    this.addCommand({
      id: "crear-documento",
      name: "Crear documento",
      callback: () => this.abrirModal("documento")
    });
    this.addCommand({
      id: "editar-documento",
      name: "Editar documento (tipo / mover)",
      callback: () => this.abrirModal("editarDocumento")
    });
    this.addCommand({
      id: "abrir-documentos",
      name: "Documentos por \xE9pica",
      callback: () => void this.abrirDocumentos()
    });
    this.addCommand({
      id: "organizar-documentos",
      name: "Tablero de documentos",
      callback: () => void this.abrirOrganizarDocumentos()
    });
    this.addCommand({
      id: "mover-epica",
      name: "Archivar \xE9picas",
      callback: () => this.abrirModal("mover")
    });
    this.addCommand({
      id: "eliminar-epica-historia",
      name: "Eliminar \xE9pica o historia",
      callback: () => this.abrirModal("eliminarEpicaHistoria")
    });
    this.addCommand({
      id: "eliminar-incidencia",
      name: "Eliminar incidencia",
      callback: () => this.abrirModal("eliminarIncidencia")
    });
    this.addCommand({
      id: "eliminar-documento",
      name: "Eliminar documento",
      callback: () => this.abrirModal("eliminarDocumento")
    });
    this.addCommand({
      id: "asignar-colaborador",
      name: "Asignar colaborador",
      callback: () => this.abrirModal("asignar")
    });
    this.addCommand({
      id: "gestion-colaboradores",
      name: "Configurar colaboradores",
      callback: () => this.abrirModal("colaboradores")
    });
    this.addCommand({
      id: "tareas-por-colaborador",
      name: "Incidencias por colaborador",
      callback: () => void this.abrirTareasColaborador()
    });
    this.addCommand({
      id: "abrir-tablero-kanban",
      name: "Abrir gesti\xF3n de incidencias",
      callback: () => void this.abrirKanban()
    });
    this.addCommand({
      id: "abrir-gestor-funcionalidades",
      name: "Abrir planeaci\xF3n",
      callback: () => void this.abrirGestorFuncionalidades()
    });
    this.addCommand({
      id: "recargar-tablero",
      name: "Recargar tablero",
      callback: () => {
        const hoja = this.app.workspace.getLeavesOfType(VIEW_TYPE_KANBAN)[0];
        if (hoja && hoja.view instanceof KanbanView)
          void hoja.view.recargar();
      }
    });
    this.addCommand({
      id: "abrir-roadmap",
      name: "Abrir roadmap",
      callback: () => void this.abrirRoadmap()
    });
  }
  abrirModal(tipo) {
    if (!carpetasGestionListas(this.app)) {
      new AvisoConfiguracionModal(this).open();
      return;
    }
    switch (tipo) {
      case "funcionalidad":
        new CrearFuncionalidadModal(this).open();
        break;
      case "crearfn":
        new CrearFuncionalidadNuevaModal(this).open();
        break;
      case "tarea":
        new CrearTareaModal(this).open();
        break;
      case "pendiente":
        new CrearPendienteModal(this).open();
        break;
      case "sprint":
        new AsignarSprintModal(this).open();
        break;
      case "mover":
        new MoverEpicaModal(this).open();
        break;
      case "asignar":
        new AsignarColaboradorModal(this).open();
        break;
      case "colaboradores":
        new GestorEtiquetasModal(this, {
          titulo: "Configurar colaboradores",
          nuevoNombre: "Colaborador",
          conVisible: true,
          avisoEliminar: "Se quitar\xE1 de las incidencias donde est\xE9 asignado. No se elimina ninguna carpeta.",
          alRenombrar: (ant, nue) => renombrarColaborador(this.app, this.settings.carpetaAdmin, this.settings.incidencias, ant, nue),
          alEliminar: (nombre) => eliminarColaborador(this.app, this.settings.carpetaAdmin, this.settings.incidencias, nombre),
          secciones: [
            {
              id: "colab",
              titulo: "Colaboradores",
              getLista: () => this.settings.colaboradores
            }
          ]
        }).open();
        break;
      case "configIncidencias":
        new GestorEtiquetasModal(this, {
          titulo: "Configurar incidencias",
          nuevoNombre: "Incidencia",
          conVisible: true,
          avisoEliminar: "Se quitar\xE1 el tipo de la configuraci\xF3n. Las incidencias y sus carpetas se conservan.",
          alRenombrar: (ant, nue) => renombrarTipoIncidencia(this.app, this.settings.carpetaAdmin, ant, nue),
          secciones: [
            {
              id: "incidencias",
              titulo: "Incidencias",
              getLista: () => this.settings.incidencias
            }
          ]
        }).open();
        break;
      case "incidencia":
        new CrearIncidenciaModal(this).open();
        break;
      case "editarNombre":
        new EditarNombreModal(this).open();
        break;
      case "editarIncidencia":
        new MoverIncidenciaModal(this).open();
        break;
      case "configDocumentos":
        new GestorEtiquetasModal(this, {
          titulo: "Configurar documentos",
          nuevoNombre: "Documento",
          conVisible: true,
          avisoEliminar: "Se quitar\xE1 el tipo de la configuraci\xF3n. Los documentos y sus carpetas se conservan.",
          alRenombrar: (ant, nue) => renombrarTipoIncidencia(this.app, this.settings.carpetaAdmin, ant, nue),
          secciones: [
            {
              id: "documentos",
              titulo: "Documentos",
              getLista: () => this.settings.documentos
            }
          ]
        }).open();
        break;
      case "documento":
        new CrearIncidenciaModal(this, {
          titulo: "Crear documento",
          singular: "documento",
          tipos: () => this.settings.documentos,
          accionConfig: "Configurar documentos",
          conColaboradores: false
        }).open();
        break;
      case "editarDocumento":
        new MoverIncidenciaModal(this, {
          titulo: "Editar documento",
          singular: "documento",
          tipos: () => this.settings.documentos,
          accionConfig: "Configurar documentos"
        }).open();
        break;
      case "eliminarEpicaHistoria":
        new EliminarEpicaHistoriaModal(this).open();
        break;
      case "eliminarIncidencia":
        new EliminarIncidenciaModal(this).open();
        break;
      case "eliminarDocumento":
        new EliminarIncidenciaModal(this, {
          titulo: "Eliminar documento",
          singular: "documento",
          tipos: () => this.settings.documentos,
          accionConfig: "Configurar documentos"
        }).open();
        break;
    }
  }
  /** Abre la nota en una pestaña; si ya está abierta, va a esa pestaña en vez
   * de duplicarla. Lo usan los tableros al pulsar una tarjeta. */
  async mostrarNota(file) {
    const abierta = this.app.workspace.getLeavesOfType("markdown").find((leaf) => {
      var _a;
      return ((_a = leaf.view.file) == null ? void 0 : _a.path) === file.path;
    });
    if (abierta) {
      await this.app.workspace.revealLeaf(abierta);
      return;
    }
    await this.app.workspace.getLeaf("tab").openFile(file);
  }
  /** El ícono del panel de acciones alterna abrir/cerrar. */
  async toggleAcciones() {
    const hojas = this.app.workspace.getLeavesOfType(VIEW_TYPE_ACCIONES);
    if (hojas.length > 0) {
      this.app.workspace.detachLeavesOfType(VIEW_TYPE_ACCIONES);
      return;
    }
    await this.abrirAcciones();
  }
  /** Abre el panel de acciones (sin alternar). */
  async abrirAcciones() {
    const existente = this.app.workspace.getLeavesOfType(VIEW_TYPE_ACCIONES)[0];
    if (existente) {
      await this.app.workspace.revealLeaf(existente);
      return;
    }
    const hoja = this.app.workspace.getLeftLeaf(false);
    if (!hoja)
      return;
    await hoja.setViewState({ type: VIEW_TYPE_ACCIONES, active: true });
    await this.app.workspace.revealLeaf(hoja);
  }
  async abrirKanban() {
    await this.abrirVistaEnPestana(VIEW_TYPE_KANBAN);
  }
  async abrirGestorFuncionalidades() {
    await this.abrirVistaEnPestana(VIEW_TYPE_GESTOR_FN);
  }
  async abrirRoadmap() {
    await this.abrirVistaEnPestana(VIEW_TYPE_ROADMAP);
  }
  async abrirTareasColaborador() {
    await this.abrirVistaEnPestana(VIEW_TYPE_COLABORADORES);
  }
  async abrirDocumentos() {
    await this.abrirVistaEnPestana(VIEW_TYPE_DOCUMENTOS);
  }
  async abrirOrganizarDocumentos() {
    await this.abrirVistaEnPestana(VIEW_TYPE_ORGANIZAR_DOCS);
  }
  async abrirHistorias() {
    await this.abrirVistaEnPestana(VIEW_TYPE_HISTORIAS);
  }
  async abrirEtiquetarHistorias() {
    await this.abrirVistaEnPestana(VIEW_TYPE_ETIQUETAR_HISTORIAS);
  }
  /**
   * Abre la vista como pestaña del área principal. Si quedó anclada en un
   * panel lateral (layouts guardados de versiones anteriores), la desancla
   * y la vuelve a abrir como pestaña.
   */
  async abrirVistaEnPestana(tipo) {
    const existente = this.app.workspace.getLeavesOfType(tipo)[0];
    if (existente && existente.getRoot() === this.app.workspace.rootSplit) {
      await this.app.workspace.revealLeaf(existente);
      return;
    }
    existente == null ? void 0 : existente.detach();
    const hoja = this.app.workspace.getLeaf("tab");
    await hoja.setViewState({ type: tipo, active: true });
    await this.app.workspace.revealLeaf(hoja);
  }
  async loadSettings() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p;
    const guardado = await this.loadData();
    const primeraVez = guardado === null || guardado === void 0;
    const data = guardado != null ? guardado : {};
    const etiquetas = ((_a = data.etiquetas) != null ? _a : []).map(
      (e) => typeof e === "string" ? { nombre: e, color: COLOR_ETIQUETA_DEFECTO, visible: true } : {
        nombre: String(e.nombre),
        color: e.color || COLOR_ETIQUETA_DEFECTO,
        visible: e.visible === void 0 ? true : Boolean(e.visible)
      }
    );
    const guardadosCarriles = (_b = Array.isArray(data.carriles) ? data.carriles : data.estados) != null ? _b : [];
    const carriles = CARRILES_DEFECTO.map((def) => {
      const g = guardadosCarriles.find(
        (c) => (c == null ? void 0 : c.valor) && normalizarEstado(String(c.valor)) === def.valor
      );
      return {
        nombre: (g == null ? void 0 : g.nombre) ? String(g.nombre) : def.nombre,
        valor: def.valor,
        color: (g == null ? void 0 : g.color) ? String(g.color) : def.color,
        visible: (g == null ? void 0 : g.visible) === void 0 ? def.visible : Boolean(g.visible)
      };
    });
    for (const c of guardadosCarriles) {
      const valor = (c == null ? void 0 : c.valor) ? normalizarEstado(String(c.valor)) : "";
      if ((c == null ? void 0 : c.nombre) && valor && !carriles.some((x) => x.valor === valor)) {
        carriles.push({
          nombre: String(c.nombre),
          valor,
          color: c.color ? String(c.color) : COLOR_ETIQUETA_DEFECTO,
          visible: c.visible === void 0 ? true : Boolean(c.visible)
        });
      }
    }
    const conVisible = (c) => ({
      nombre: String(c.nombre),
      color: c.color || COLOR_ETIQUETA_DEFECTO,
      visible: c.visible === void 0 ? true : Boolean(c.visible)
    });
    const colaboradores = primeraVez ? [{ ...COLABORADOR_DEFECTO }] : ((_c = data.colaboradores) != null ? _c : []).map(conVisible).map(
      (c) => (
        // Migración: el color por defecto antiguo ("#5082ff") quedaba fuera
        // de la paleta cerrada; se reasigna al Azul de la paleta.
        c.color.toLowerCase() === "#5082ff" ? { ...c, color: "#2D9CFF" } : c
      )
    );
    const incidencias = data.incidencias === void 0 ? INCIDENCIAS_DEFECTO.map((i) => ({ ...i })) : data.incidencias.map(conVisible);
    const documentos = data.documentos === void 0 ? DOCUMENTOS_DEFECTO.map((d) => ({ ...d })) : data.documentos.map(conVisible);
    const favoritos = ((_d = data.favoritos) != null ? _d : []).map(String);
    const numCrudo = Math.trunc(Number(data.numSprints));
    const numSprints = Number.isFinite(numCrudo) && numCrudo >= 1 ? numCrudo : NUM_SPRINTS_DEFECTO;
    const filtro = (_e = data.kanban) == null ? void 0 : _e.filtroSprints;
    const enRango = (v, defecto) => v && v >= 1 && v <= numSprints ? v : defecto;
    const anioValido = (v) => {
      const n = Math.trunc(Number(v));
      return Number.isFinite(n) && n >= 1970 && n <= 9999 ? n : (/* @__PURE__ */ new Date()).getFullYear();
    };
    this.settings = {
      // La carpeta de épicas activas es fija desde la v6.
      carpetaAdmin: DEFAULT_SETTINGS.carpetaAdmin,
      etiquetas,
      carriles,
      colaboradores,
      incidencias,
      documentos,
      numSprints,
      favoritos,
      ordenFunc: ((_f = data.ordenFunc) != null ? _f : []).map(String),
      ordenIncidenciasColab: ((_g = data.ordenIncidenciasColab) != null ? _g : []).map(String),
      ordenGruposDocumentos: ((_h = data.ordenGruposDocumentos) != null ? _h : []).map(String),
      organizacionDocs: sanearOrganizacionDocs(data.organizacionDocs),
      sprintActual: {
        anio: anioValido((_i = data.sprintActual) == null ? void 0 : _i.anio),
        sprint: enRango((_j = data.sprintActual) == null ? void 0 : _j.sprint, 1)
      },
      kanban: {
        tareas: { ...(_l = (_k = data.kanban) == null ? void 0 : _k.tareas) != null ? _l : {} },
        pendientes: { ...(_n = (_m = data.kanban) == null ? void 0 : _m.pendientes) != null ? _n : {} },
        ordenIncidencias: ((_p = (_o = data.kanban) == null ? void 0 : _o.ordenIncidencias) != null ? _p : []).map(String),
        filtroSprints: {
          desde: enRango(filtro == null ? void 0 : filtro.desde, 1),
          hasta: enRango(filtro == null ? void 0 : filtro.hasta, numSprints)
        }
      }
    };
    const aplicada = await aplicarConfigBoveda(this);
    if (!aplicada)
      await guardarConfigBoveda(this);
  }
  async saveSettings() {
    await this.saveData(this.settings);
    await guardarConfigBoveda(this);
  }
};
