import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ClientLayout from "./ClientLayout";

const mockTrack = vi.fn();
const mockLogout = vi.fn();
const mockSetLanguage = vi.fn();
const mockSavePreferences = vi.fn();
const mockCacheUpdate = vi.fn();
const access = vi.hoisted(() => ({ isStaff: false, isAdmin: false, staffRoles: [] as string[] }));
const session = vi.hoisted(() => ({ account: { id: 17, name: "Layout Test User", email: "layout@test.example", notificationPrefs: "{}" } }));
const navigation = vi.hoisted(() => ({ onLanguage: undefined as (() => void) | undefined }));
const preferenceSave = vi.hoisted(() => ({ options: null as any, context: null as any }));
vi.mock("./navigation/InterfaceAnnouncement", () => ({ default: () => null }));
vi.mock("./navigation/ClientNavigation", () => ({
  default: ({ items, subHeader, onLanguage }: { items: Array<{ href: string; label: string }>; subHeader?: React.ReactNode; onLanguage: () => void }) => {
    navigation.onLanguage = onLanguage;
    return React.createElement("nav", null, ...items.map(item => React.createElement("a", { key: item.href, href: item.href }, item.label)), subHeader);
  },
}));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    user: session.account,
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
    useUtils: () => ({ auth: { me: { invalidate: async () => {}, setData: (_input: undefined, updater: (account: typeof session.account) => typeof session.account) => {
      mockCacheUpdate(updater);
      session.account = updater(session.account);
    } } } }),
    notifications: {
      unreadCount: {
        useQuery: () => ({ data: { count: 0 } }),
      },
    },
    auth: {
      isAdmin: {
        useQuery: () => ({ data: access }),
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
        useMutation: (options: any) => {
          preferenceSave.options = options;
          return { mutate: (input: any) => { mockSavePreferences(input); preferenceSave.context = options.onMutate(); } };
        },
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
    mockSavePreferences.mockClear();
    mockCacheUpdate.mockClear();
    session.account = { id: 17, name: "Layout Test User", email: "layout@test.example", notificationPrefs: "{}" };
    Object.assign(access, { isStaff: false, isAdmin: false, staffRoles: [] });
  });

  it("updates cached account language before navigation can rehydrate it and preserves other preferences", () => {
    session.account.notificationPrefs = JSON.stringify({ language: "en", support_replies: false, futurePreference: { enabled: true } });
    renderToStaticMarkup(React.createElement(ClientLayout, null, "Page"));
    navigation.onLanguage!();
    expect(JSON.parse(session.account.notificationPrefs)).toEqual({ language: "ar", support_replies: false, futurePreference: { enabled: true } });
    expect(mockSavePreferences).toHaveBeenCalledWith({ language: "ar" });
    expect(mockSetLanguage).toHaveBeenCalledWith("ar");
    expect(mockCacheUpdate.mock.invocationCallOrder[0]).toBeLessThan(mockSavePreferences.mock.invocationCallOrder[0]);
    const updater = mockCacheUpdate.mock.calls[0][0];
    const otherAccount = { ...session.account, id: 99 };
    expect(updater(otherAccount)).toBe(otherAccount);
    expect(updater(null)).toBeNull();
  });

  it.each(["invalid-json", "null", "[]"])("handles legacy language preferences %s without blocking the switch", notificationPrefs => {
    session.account.notificationPrefs = notificationPrefs;
    renderToStaticMarkup(React.createElement(ClientLayout, null, "Page"));
    expect(() => navigation.onLanguage!()).not.toThrow();
    expect(JSON.parse(session.account.notificationPrefs)).toEqual({ language: "ar" });
  });

  it("restores the saved language after an older account response arrives during navigation", async () => {
    renderToStaticMarkup(React.createElement(ClientLayout, null, "Page"));
    navigation.onLanguage!();
    session.account.notificationPrefs = JSON.stringify({ language: "en", support_replies: false });
    await preferenceSave.options.onSuccess({ success: true }, { language: "ar" }, preferenceSave.context);
    expect(JSON.parse(session.account.notificationPrefs)).toEqual({ language: "ar", support_replies: false });
  });

  it("does not overwrite another account when a previous language save finishes", async () => {
    renderToStaticMarkup(React.createElement(ClientLayout, null, "Page"));
    navigation.onLanguage!();
    session.account = { ...session.account, id: 99, notificationPrefs: '{"language":"en"}' };
    await preferenceSave.options.onSuccess({ success: true }, { language: "ar" }, preferenceSave.context);
    expect(session.account.id).toBe(99);
    expect(session.account.notificationPrefs).toBe('{"language":"en"}');
  });

  it("keeps the authenticated dashboard shell on a bounded responsive width", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        ClientLayout,
        null,
        React.createElement("div", null, "Dashboard body"),
      ),
    );

    expect(html).toContain("flex-1 min-w-0");
    expect(html).toContain("nv2-client-main");
    expect(html).toContain("Dashboard body");
    for (const path of ["/courses", "/documents", "/lexai", "/recommendations", "/guides", "/support", "/quiz", "/my-packages", "/activate-key", "/broker-onboarding", "/notifications", "/my-points", "/calculators"]) {
      expect(html).toContain(`href="${path}"`);
    }
    for (const path of ["/community", "/surveys", "/job-opportunities", "/live-package"]) expect(html).not.toContain(`href="${path}"`);
  });

  it.each([
    { name: "Live Expert", isStaff: true, isAdmin: false, staffRoles: ["live_recording_uploader", "live_expert"], visible: true },
    { name: "admin", isStaff: false, isAdmin: true, staffRoles: [], visible: true },
    { name: "client", isStaff: false, isAdmin: false, staffRoles: [], visible: false },
    { name: "recording uploader", isStaff: true, isAdmin: false, staffRoles: ["live_recording_uploader"], visible: false },
  ])("exposes the instructor inbox only to authorized $name accounts", ({ visible, ...account }) => {
    Object.assign(access, account);
    const html = renderToStaticMarkup(React.createElement(ClientLayout, null, "Page body"));
    const inboxLinks = html.match(/href="\/admin\/live-expert"/g) ?? [];
    expect(inboxLinks).toHaveLength(visible ? 1 : 0);
  });
});
