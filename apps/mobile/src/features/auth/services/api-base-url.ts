type ApiBaseUrlOptions = {
  configuredUrl?: string;
  metroHostUri?: string;
  platform: string;
  isDevelopment: boolean;
};

function hostFromMetroUri(hostUri?: string): string | null {
  if (!hostUri) return null;
  try {
    const uri = hostUri.includes("://") ? hostUri : `http://${hostUri}`;
    return new URL(uri).hostname || null;
  } catch {
    return null;
  }
}

export function resolveApiBaseUrl({
  configuredUrl,
  metroHostUri,
  platform,
  isDevelopment,
}: ApiBaseUrlOptions): string {
  const explicit = configuredUrl?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const metroHost = isDevelopment ? hostFromMetroUri(metroHostUri) : null;
  const fallbackHost = platform === "android" ? "10.0.2.2" : "localhost";
  return `http://${metroHost ?? fallbackHost}:3000/api/v1`;
}
