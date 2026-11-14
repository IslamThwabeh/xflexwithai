export function opensRegistration(pathname: string, search: string): boolean {
  const params = new URLSearchParams(search);
  const mode = params.get("mode");
  if (mode === "login") return false;
  const path = pathname.replace(/^\/(ar|en)(?=\/|$)/, "").replace(/\/$/, "");
  return (
    path === "/register" ||
    path === "/signup" ||
    mode === "register" ||
    !!params.get("ref")
  );
}
