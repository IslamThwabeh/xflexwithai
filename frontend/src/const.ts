export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const APP_TITLE = import.meta.env.VITE_APP_TITLE || "XFlex Trading Academy";

export const APP_LOGO = "https://placehold.co/128x128/E1E7EF/1F2937?text=XFlex";

// Login and registration now handled at /auth route
export const LOGIN_URL = "/auth";
export const ADMIN_LOGIN_URL = "/admin/login";

// Helper function for backward compatibility with main.tsx
export function getLoginUrl(): string {
  return LOGIN_URL;
}
