const DEFAULT_API_BASE = "http://localhost:8000";

function normalizeBaseUrl(raw: string): string {
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function buildUrl(base: string, rawPath: string): string {
  const path = normalizePath(rawPath);

  if (base.endsWith("/api") && path.startsWith("/api/")) {
    return `${base}${path.slice(4)}`;
  }

  return `${base}${path}`;
}

function buildAlternatePath(rawPath: string): string {
  const path = normalizePath(rawPath);
  if (path.startsWith("/api/")) {
    return path.slice(4) || "/";
  }
  return `/api${path}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function getApiBaseCandidates(): string[] {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const candidates: string[] = [];

  if (configured) {
    if (isAbsoluteUrl(configured)) {
      candidates.push(normalizeBaseUrl(configured));
    } else if (typeof window !== "undefined" && configured.startsWith("/")) {
      candidates.push(normalizeBaseUrl(`${window.location.origin}${configured}`));
    }
  }

  candidates.push(normalizeBaseUrl(DEFAULT_API_BASE));
  return unique(candidates);
}

async function extractErrorMessage(response: Response): Promise<string> {
  let message = `${response.status} ${response.statusText}`;
  try {
    const payload = (await response.json()) as { detail?: string; message?: string };
    if (payload?.detail) {
      message = payload.detail;
    } else if (payload?.message) {
      message = payload.message;
    }
  } catch {
    // Keep default message.
  }
  return message;
}

export function getApiBaseUrl(): string {
  return getApiBaseCandidates()[0];
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const primaryPath = normalizePath(path);
  const alternatePath = buildAlternatePath(primaryPath);
  const pathCandidates = unique([primaryPath, alternatePath]);
  const baseCandidates = getApiBaseCandidates();

  const requestInit: RequestInit = {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  };

  let lastError = "Request failed";

  for (const base of baseCandidates) {
    for (const candidatePath of pathCandidates) {
      const url = buildUrl(base, candidatePath);
      try {
        const response = await fetch(url, requestInit);
        if (response.ok) {
          return (await response.json()) as T;
        }
        lastError = await extractErrorMessage(response);
      } catch (error) {
        if (error instanceof Error) {
          lastError = error.message;
        }
      }
    }
  }

  throw new Error(lastError);
}
