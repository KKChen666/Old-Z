const isCapacitorNative = () => (
  typeof window !== 'undefined'
  && typeof (window as any).Capacitor?.isNativePlatform === 'function'
  && (window as any).Capacitor.isNativePlatform()
);

export function isNativeFilePreview(): boolean {
  return isCapacitorNative();
}

async function fetchFile(url: string): Promise<Response> {
  const response = await fetch(url, {
    mode: 'cors',
    credentials: 'omit',
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.status}`);
  }
  return response;
}

export async function fetchFileAsArrayBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetchFile(url);
  return response.arrayBuffer();
}

export async function fetchFileAsText(url: string): Promise<string> {
  const response = await fetchFile(url);
  return response.text();
}
