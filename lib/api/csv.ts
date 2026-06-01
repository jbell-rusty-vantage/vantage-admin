"use client";

function getFilenameFromContentDisposition(contentDisposition: string | null): string | undefined {
  if (!contentDisposition) {
    return undefined;
  }

  const filenameStarMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (filenameStarMatch?.[1]) {
    return decodeURIComponent(filenameStarMatch[1].trim());
  }

  const filenameMatch = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
  return filenameMatch?.[1]?.trim();
}

export async function downloadCsvFromProxy(url: string, fallbackFilename: string) {
  const response = await fetch(url, {
    credentials: "include",
  });

  if (!response.ok) {
    let message = "CSV export failed.";
    try {
      const payload = (await response.json()) as { error?: string };
      message = payload.error ?? message;
    } catch {
      // Keep the generic message when the backend did not return JSON.
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const filename =
    getFilenameFromContentDisposition(response.headers.get("content-disposition")) ??
    fallbackFilename;
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
