export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token =
    typeof window !== "undefined"
      ? sessionStorage.getItem("utsab-token")
      : null;
  const response = await fetch(`/api/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    let message = "The request could not be completed";
    try {
      const data = await response.json();
      message = Array.isArray(data.message)
        ? data.message.join(", ")
        : data.message || message;
    } catch {}
    if (response.status === 401 && typeof window !== "undefined") {
      sessionStorage.removeItem("utsab-token");
      window.dispatchEvent(new Event("utsab-expired"));
    }
    throw new Error(message);
  }
  return response.json();
}
export const json = (value: unknown) => JSON.stringify(value);
