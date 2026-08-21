import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", async () => {
  const actual = await vi.importActual<typeof import("../backend/db")>("../backend/db");
  return {
    ...actual,
    getUserCourseDocumentAccess: vi.fn(),
    listPublishedStudentDocuments: vi.fn(),
    trackEngagement: vi.fn(),
  };
});

import { appRouter } from "../backend/routers";
import * as db from "../backend/db";

const workerSource = readFileSync(new URL("../backend/_core/worker.ts", import.meta.url), "utf8");

function createCaller() {
  return appRouter.createCaller({
    req: { headers: {}, method: "GET", path: "/api/trpc/documents.myLibrary" },
    user: {
      id: 42,
      email: "student@example.com",
      passwordHash: "",
      name: "Student",
      phone: null,
      emailVerified: true,
      createdAt: "",
      updatedAt: "",
      lastSignedIn: "",
    },
    setCookie: () => {},
    clearCookie: () => {},
  } as any);
}

describe("lifetime student-document access", () => {
  const getAccess = vi.mocked(db.getUserCourseDocumentAccess);
  const listDocuments = vi.mocked(db.listPublishedStudentDocuments);
  const trackEngagement = vi.mocked(db.trackEngagement);

  beforeEach(() => {
    vi.clearAllMocks();
    trackEngagement.mockResolvedValue(undefined);
  });

  it("denies the library when permanent paid-course ownership is absent", async () => {
    getAccess.mockResolvedValue(null);

    await expect(createCaller().documents.myAccess()).resolves.toEqual({ hasAccess: false });
    await expect(createCaller().documents.myLibrary()).resolves.toMatchObject({
      hasAccess: false,
      documents: [],
      bulkDownloadPath: null,
    });
    expect(listDocuments).not.toHaveBeenCalled();
  });

  it("keeps documents available from the lifetime course enrollment", async () => {
    getAccess.mockResolvedValue({
      enrollment: { id: 8, userId: 42, courseId: 3 },
      course: { id: 3, titleEn: "Trading Course", titleAr: "دورة التداول" },
    } as any);
    listDocuments.mockResolvedValue([
      { id: 2, mimeType: "application/pdf", isBulkArchive: false, titleEn: "Guide", titleAr: "الدليل" },
      { id: 11, mimeType: "application/zip", isBulkArchive: true, titleEn: "All", titleAr: "الكل" },
    ] as any);

    await expect(createCaller().documents.myAccess()).resolves.toEqual({ hasAccess: true });
    await expect(createCaller().documents.myLibrary()).resolves.toMatchObject({
      hasAccess: true,
      packageNameEn: "Trading Course",
      packageNameAr: "دورة التداول",
      documents: [{ id: 2, viewPath: "/api/student-documents/2/view" }],
      bulkDownloadPath: "/api/student-documents/11/download",
    });
    expect(trackEngagement).toHaveBeenCalledWith(expect.objectContaining({
      userId: 42,
      eventType: "student_document_library_opened",
      entityType: "student_document_library",
    }));
  });

  it("uses the same lifetime-course check for direct view and download requests", () => {
    expect(workerSource).toContain("db.getUserCourseDocumentAccess(authContext.user.id)");
    expect(workerSource).toContain("Paid course access is required to access student documents");
    expect(workerSource).toContain('eventType: action === "view" ? "student_document_viewed" : "student_document_downloaded"');
    expect(workerSource).toContain("ctx.waitUntil(db.trackEngagement");
  });
});
