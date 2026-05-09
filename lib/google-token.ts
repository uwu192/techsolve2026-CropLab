/**
 * Shared Google OAuth token refresh with exponential backoff for transient errors.
 * Does not retry on 400/401 (invalid_grant, revoked token).
 */
export async function refreshGoogleAccessToken(
  refreshToken: string,
  options?: { maxAttempts?: number }
): Promise<string> {
  const maxAttempts = options?.maxAttempts ?? 4;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (res.ok) {
      const json = await res.json();
      return json.access_token as string;
    }

    const body = await res.text();
    lastError = new Error(`Failed to refresh Google token: ${res.status} ${body}`);

    if (res.status === 400 || res.status === 401) {
      throw lastError;
    }

    const backoffMs = Math.min(8000, 400 * 2 ** attempt);
    await new Promise((r) => setTimeout(r, backoffMs));
  }

  throw lastError ?? new Error("Google token refresh exhausted retries");
}
