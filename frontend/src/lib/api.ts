/**
 * Browser API client. The session lives in httpOnly cookies set by the API,
 * so no token is ever readable from JavaScript. Every request carries the
 * client header the API requires for cookie-authenticated writes (CSRF guard).
 * An expired access cookie is refreshed once, transparently.
 */
let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  refreshing ??= fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "x-ayojon-client": "web" },
    body: "{}",
  })
    .then(async (response) => {
      // 409: another tab refreshed a moment ago; its new cookies are already set.
      if (response.status === 409) return true;
      return response.ok;
    })
    .catch(() => false)
    .finally(() => {
      setTimeout(() => (refreshing = null), 0);
    });
  return refreshing;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "x-ayojon-client": "web",
      ...options.headers,
    },
  });
  if (response.status === 401 && retry && !path.startsWith("auth/")) {
    if (await refreshSession()) return api<T>(path, options, false);
  }
  if (!response.ok) {
    let message = "The request could not be completed";
    try {
      const data = await response.json();
      message = Array.isArray(data.message)
        ? data.message.join(", ")
        : data.message || message;
    } catch {}
    if (
      response.status === 401 &&
      typeof window !== "undefined" &&
      !path.startsWith("auth/login")
    )
      window.dispatchEvent(new Event("utsab-expired"));
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const json = (value: unknown) => JSON.stringify(value);

/** Uploads a file through the API's upload slots and returns the ready media record. */
export async function uploadFile(file: File, purpose: string) {
  const slot = await api<{
    id: string;
    upload: {
      method: "POST" | "PUT";
      url: string;
      fields?: Record<string, string>;
      headers?: Record<string, string>;
    };
  }>("uploads", {
    method: "POST",
    body: json({
      purpose,
      contentType: file.type,
      sizeBytes: file.size,
      fileName: file.name,
    }),
  });
  let response: Response;
  if (slot.upload.method === "POST") {
    const form = new FormData();
    for (const [key, value] of Object.entries(slot.upload.fields || {}))
      form.append(key, value);
    form.append("file", file);
    response = await fetch(slot.upload.url, { method: "POST", body: form });
  } else {
    response = await fetch(slot.upload.url, {
      method: "PUT",
      body: file,
      headers: slot.upload.headers,
      credentials: "same-origin",
    });
  }
  if (!response.ok) throw new Error("The file could not be uploaded");
  return api<{
    id: string;
    url: string | null;
    contentType: string;
    fileName: string | null;
  }>(`uploads/${slot.id}/complete`, { method: "POST", body: "{}" });
}
