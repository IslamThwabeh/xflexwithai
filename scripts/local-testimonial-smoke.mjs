import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const root = process.cwd();
const dbPath = path.join(root, "xflexwithai.db");

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const db = new DatabaseSync(dbPath);

const execFile = (filePath) => {
  let sql = fs.readFileSync(filePath, "utf8");
  sql = sql.replace(/--> statement-breakpoint/g, "\n");
  sql = sql.replace(/^COMMENT ON .*;$/gm, "");

  try {
    db.exec(sql);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed applying ${path.basename(filePath)}: ${message}`);
  }
};

execFile(path.join(root, "database", "0000_salty_turbo.sql"));

const migrationFiles = [
  path.join(root, "database", "migrations", "005b_add_testimonials.sql"),
  path.join(root, "database", "migrations", "011_add_testimonial_context_fields.sql"),
];

for (const migrationFile of migrationFiles) {
  execFile(migrationFile);
}

const testimonialColumns = db
  .prepare("PRAGMA table_info(testimonials)")
  .all()
  .map((column) => column.name);

const insert = db.prepare(
  `INSERT INTO testimonials (
    name_en,
    name_ar,
    title_en,
    title_ar,
    text_en,
    text_ar,
    avatar_url,
    rating,
    package_slug,
    course_id,
    service_key,
    display_order,
    is_published
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

const insertResult = insert.run(
  "Context Test EN",
  "اختبار سياقي",
  "Package Student",
  "طالب باقة",
  "Context testimonial smoke test",
  "اختبار شهادة سياقية",
  null,
  5,
  "vip-package",
  42,
  "lexai",
  99,
  1
);

const insertedRow = db
  .prepare(
    "SELECT id, name_en, package_slug, course_id, service_key, is_published FROM testimonials WHERE id = ?"
  )
  .get(insertResult.lastInsertRowid);

console.log(
  JSON.stringify(
    {
      dbPath,
      appliedMigrations: migrationFiles.map((filePath) => path.basename(filePath)),
      testimonialColumns,
      insertedRow,
    },
    null,
    2
  )
);

db.close();