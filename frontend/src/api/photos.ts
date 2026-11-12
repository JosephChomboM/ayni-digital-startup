import { apiFetch, ApiError } from "./client";

export interface MemoryPhoto {
  id: string;
  memory_id: string;
  created_by: string;
  content_type: string;
  size_bytes: number;
  width: number;
  height: number;
  created_at: string;
  url: string;
  url_expires_at: string;
}

function route(memoryId: string): string {
  return `/memories/${encodeURIComponent(memoryId)}/photos`;
}

export function uploadPhoto(memoryId: string, file: File): Promise<MemoryPhoto> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      !file.size || file.size > 8 * 1024 * 1024) {
    throw new ApiError("Usa fotos JPG, PNG o WebP de hasta 8 MB cada una.", "photo_format_invalid", 422);
  }
  const body = new FormData();
  body.append("file", file);
  return apiFetch<MemoryPhoto>(route(memoryId), { method: "POST", body });
}

export async function listPhotos(memoryId: string): Promise<MemoryPhoto[]> {
  const items: MemoryPhoto[] = [];
  let offset = 0;
  while (true) {
    const page = await apiFetch<{ items: MemoryPhoto[]; total: number; limit: number }>(
      `${route(memoryId)}?limit=100&offset=${offset}`);
    items.push(...page.items);
    offset += page.items.length;
    if (offset >= page.total || !page.items.length) return items;
  }
}

export function deletePhoto(photo: MemoryPhoto): Promise<void> {
  return apiFetch<void>(`${route(photo.memory_id)}/${encodeURIComponent(photo.id)}`, { method: "DELETE" });
}
