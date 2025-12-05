import { QueryClient, QueryFunction } from "@tanstack/react-query";

// ---------------- Helper ----------------
async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// ---------------- API Request ----------------
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", // << critical for session cookies
  });

  await throwIfResNotOk(res);
  return res;
}

// ---------------- Query Function ----------------
type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401 }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (res.status === 401 && on401 === "returnNull") {
      return null as T;
    }

    await throwIfResNotOk(res);
    return res.json() as Promise<T>;
  };

// ---------------- Query Client ----------------
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
