import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ClientLayout from "./ClientLayout";

const mockTrack = vi.fn();
const mockLogout = vi.fn();
const mockSetLanguage = vi.fn();

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: 17, name: "Layout Test User", email: "layout@test.example" },
    logout: mockLogout,
  }),
}));

vi.mock("@/_core/hooks/useEngagementTracker", () => ({
  useEngagementTracker: () => ({
    track: mockTrack,
  }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: "en",
    setLanguage: mockSetLanguage,
    isRTL: false,
  }),
}));

vi.mock("@/lib/languageToggle", () => ({
  getLanguageSwitchLabel: () => "EN",
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    notifications: {
      unreadCount: {
        useQuery: () => ({ data: { count: 0 } }),
      },
    },
    auth: {
      isAdmin: {
        useQuery: () => ({ data: { isStaff: false, isAdmin: false } }),
      },
    },
    studentSurveys: {
      availability: {
        useQuery: () => ({ data: { enabled: false, access: "student", outstandingCount: 0 } }),
      },
    },
    community: {
      availability: {
        useQuery: () => ({ data: { enabled: false, access: "allowed" } }),
      },
    },
    studentJobEligibility: {
      availability: {
        useQuery: () => ({ data: { enabled: false } }),
      },
    },
    livePackage: {
      myWorkspace: {
        useQuery: () => ({ data: { hasAccess: false } }),
      },
    },
    users: {
      touchInteraction: {
        useMutation: () => ({ mutate: vi.fn() }),
      },
      updateNotificationPrefs: {
        useMutation: () => ({ mutate: vi.fn() }),
      },
    },
  },
}));

vi.mock("@shared/const", () => ({
  getStaffLandingPage: () => null,
}));

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    Link: ({ href, children }: { href: string; children: React.ReactNode }) =>
      React.createElement("a", { href }, children),
    useLocation: () => ["/courses", vi.fn()],
  };
});

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) =>
    React.createElement("button", props, children),
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => children,
  SheetContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) =>
    React.createElement("div", props, children),
  SheetHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) =>
    React.createElement("div", props, children),
  SheetTitle: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) =>
    React.createElement("div", props, children),
}));

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => children,
  AlertDialogAction: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) =>
    React.createElement("button", props, children),
  AlertDialogCancel: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) =>
    React.createElement("button", props, children),
  AlertDialogContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) =>
    React.createElement("div", props, children),
  AlertDialogDescription: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement> & { children: React.ReactNode }) =>
    React.createElement("p", props, children),
  AlertDialogFooter: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) =>
    React.createElement("div", props, children),
  AlertDialogHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) =>
    React.createElement("div", props, children),
  AlertDialogTitle: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement> & { children: React.ReactNode }) =>
    React.createElement("h2", props, children),
}));

describe("ClientLayout shell", () => {
  beforeEach(() => {
    mockTrack.mockClear();
    mockLogout.mockClear();
    mockSetLanguage.mockClear();
  });

  it("keeps the authenticated dashboard shell on a bounded responsive width", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        ClientLayout,
        null,
        React.createElement("div", null, "Dashboard body"),
      ),
    );

    expect(html).toContain("max-w-[1440px]");
    expect(html).toContain("min-w-0 flex-1 items-center justify-between gap-3");
    expect(html).toContain("hidden min-w-0 flex-1 flex-wrap items-center justify-center gap-x-1 gap-y-1 lg:flex");
    expect(html).toContain("flex-1 min-w-0");
  });
});
