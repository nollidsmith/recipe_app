export const OAUTH_RETURN_TO_KEY = "pantrypilot.oauth.returnTo";

export function safeInternalPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export function rememberOAuthReturnTo(value: string) {
  window.sessionStorage.setItem(OAUTH_RETURN_TO_KEY, safeInternalPath(value));
}

export function consumeOAuthReturnTo() {
  const value = safeInternalPath(window.sessionStorage.getItem(OAUTH_RETURN_TO_KEY));
  window.sessionStorage.removeItem(OAUTH_RETURN_TO_KEY);
  return value;
}

export function getOAuthCallbackParams() {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const get = (key: string) => search.get(key) ?? hash.get(key);

  return {
    code: get("code"),
    type: get("type"),
    error: get("error"),
    errorDescription: get("error_description"),
    errorCode: get("error_code"),
    isCallback: ["code", "error", "error_description", "error_code", "access_token", "refresh_token"]
      .some((key) => Boolean(get(key))),
  };
}

export function isOAuthCallbackUrl(pathname = window.location.pathname) {
  const callback = getOAuthCallbackParams();
  if (pathname === "/reset-password" || pathname.startsWith("/reset-password/")) return false;
  return callback.isCallback && callback.type !== "recovery";
}

export function clearOAuthCallbackParams() {
  const url = new URL(window.location.href);
  ["code", "error", "error_description", "error_code", "access_token", "refresh_token"].forEach((key) => {
    url.searchParams.delete(key);
  });
  url.hash = "";
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}
