import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", async () => {
  const actual = await vi.importActual<typeof import("../backend/db")>("../backend/db");
  return {
    ...actual,
    getCourseById: vi.fn(),
    hasActivePackageCourseEntitlement: vi.fn(),
    getEnrollmentByCourseAndUser: vi.fn(),
    createEnrollment: vi.fn(),
  };
});

import { appRouter } from "../backend/routers";
import * as db from "../backend/db";

function createCaller() {
  return appRouter.createCaller({
    req: { headers: {}, method: "POST", path: "/api/trpc/enrollments.enroll" },
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

const paidCourse = {
  id: 7,
  price: 20000,
  currency: "USD",
  isPublished: true,
} as any;

describe("course enrollment authorization", () => {
  const getCourseById = vi.mocked(db.getCourseById);
  const hasEntitlement = vi.mocked(db.hasActivePackageCourseEntitlement);
  const getExisting = vi.mocked(db.getEnrollmentByCourseAndUser);
  const createEnrollment = vi.mocked(db.createEnrollment);

  beforeEach(() => {
    vi.clearAllMocks();
    getCourseById.mockResolvedValue(paidCourse);
    hasEntitlement.mockResolvedValue(false);
    getExisting.mockResolvedValue(undefined);
    createEnrollment.mockResolvedValue(99);
  });

  it("blocks self-enrollment in a paid course without package entitlement", async () => {
    await expect(createCaller().enrollments.enroll({
      courseId: 7,
      paymentAmount: 0,
      paymentCurrency: "USD",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(createEnrollment).not.toHaveBeenCalled();
  });

  it("allows a published free course without a paid entitlement", async () => {
    getCourseById.mockResolvedValueOnce({ ...paidCourse, price: 0 });

    await expect(createCaller().enrollments.enroll({ courseId: 7 })).resolves.toEqual({ id: 99 });
    expect(hasEntitlement).not.toHaveBeenCalled();
    expect(createEnrollment).toHaveBeenCalledWith(expect.objectContaining({
      userId: 42,
      courseId: 7,
      paymentAmount: 0,
      paymentStatus: "completed",
    }));
  });

  it("allows repair enrollment when an active standard package grants the paid course", async () => {
    hasEntitlement.mockResolvedValueOnce(true);

    await expect(createCaller().enrollments.enroll({ courseId: 7 })).resolves.toEqual({ id: 99 });
    expect(createEnrollment).toHaveBeenCalledWith(expect.objectContaining({
      userId: 42,
      courseId: 7,
      paymentStatus: "completed",
    }));
  });

  it("does not expose an unpublished zero-price course as public/free enrollment", async () => {
    getCourseById.mockResolvedValueOnce({ ...paidCourse, price: 0, isPublished: false });

    await expect(createCaller().enrollments.enroll({ courseId: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(createEnrollment).not.toHaveBeenCalled();
  });
});
