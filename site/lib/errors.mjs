// Build problems: collected per run, then reported together so one build names every broken file
// (spec CAT-01 R1/AC-5). Warnings never fail the build (R10/AC-3).

export class CatalogError extends Error {
  /** @param {{ file: string, reason: string }[]} errors */
  constructor(errors) {
    super(`catalog build failed:\n${errors.map((e) => `  ${e.file}: ${e.reason}`).join("\n")}`);
    this.name = "CatalogError";
    this.errors = errors;
  }
}

export class Problems {
  constructor() {
    /** @type {{ file: string, reason: string }[]} */
    this.errors = [];
    /** @type {{ file: string, reason: string }[]} */
    this.warnings = [];
  }

  error(file, reason) {
    this.errors.push({ file, reason });
  }

  warn(file, reason) {
    this.warnings.push({ file, reason });
  }

  throwIfAny() {
    if (this.errors.length) throw new CatalogError(this.errors);
  }
}
