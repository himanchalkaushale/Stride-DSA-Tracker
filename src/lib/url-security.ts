const LOCAL_APP_ORIGIN = "http://localhost:3000";

function hasControlCharacters(value: string) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value || hasControlCharacters(value)) return null;
  return parseHttpUrl(value)?.href ?? null;
}

export function appOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_APP_URL must be configured in production.");
  }
  const url = parseHttpUrl(configured ?? LOCAL_APP_ORIGIN);
  if (!url) throw new Error("NEXT_PUBLIC_APP_URL must be a valid HTTP(S) URL.");
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_APP_URL must use HTTPS in production.");
  }
  return url.origin;
}

export function safeRedirectPath(value: string | null, fallback = "/today"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\\") || hasControlCharacters(value) || /%(?:2f|5c)/i.test(value)) return fallback;

  const base = "https://local.invalid";
  try {
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}

export function safeSupabaseOAuthUrl(value: string | null, projectUrl: string): string | null {
  if (!value) return null;
  const candidate = parseHttpUrl(value);
  const project = parseHttpUrl(projectUrl);
  if (!candidate || !project || candidate.origin !== project.origin) return null;
  return candidate.pathname === "/auth/v1/authorize" ? candidate.href : null;
}
