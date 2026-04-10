CREATE TABLE IF NOT EXISTS studentDocuments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titleEn TEXT NOT NULL,
  titleAr TEXT NOT NULL,
  descriptionEn TEXT,
  descriptionAr TEXT,
  objectKey TEXT NOT NULL UNIQUE,
  originalFileName TEXT NOT NULL,
  mimeType TEXT NOT NULL DEFAULT 'application/pdf',
  fileSizeBytes INTEGER,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  isPublished INTEGER NOT NULL DEFAULT 1,
  isBulkArchive INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_student_documents_published_sort
  ON studentDocuments(isPublished, isBulkArchive, sortOrder, id);