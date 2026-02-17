export function buildThumbnailUrl(pullZone: string, videoId: string): string {
  return `https://${pullZone}/${videoId}/thumbnail.jpg`;
}

export function buildPlayUrl(pullZone: string, videoId: string): string {
  return `https://${pullZone}/${videoId}/play_720p.mp4`;
}

export interface BunnyApiVideo {
  guid: string;
  title: string;
  status: number; // 4 = finished encoding
}

export async function fetchBunnyVideos(
  apiKey: string,
  libraryId: string
): Promise<BunnyApiVideo[]> {
  const items: BunnyApiVideo[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const res = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos?page=${page}&itemsPerPage=${perPage}`,
      { headers: { AccessKey: apiKey } }
    );

    if (!res.ok) {
      throw new Error(`Bunny API error: ${res.status}`);
    }

    const data = await res.json();
    const videos: BunnyApiVideo[] = data.items ?? [];
    items.push(...videos);

    if (videos.length < perPage) break;
    page++;
  }

  return items;
}

export function buildCdnUrl(hostname: string, path: string): string {
  return `https://${hostname}/${path}`;
}

export interface BunnyStorageFile {
  ObjectName: string;
  Length: number;
  IsDirectory: boolean;
}

export async function fetchBunnyStorageFiles(
  apiKey: string,
  zoneName: string,
  path: string
): Promise<BunnyStorageFile[]> {
  const res = await fetch(
    `https://storage.bunnycdn.com/${zoneName}/${path}`,
    { headers: { AccessKey: apiKey } }
  );

  if (!res.ok) {
    throw new Error(`Bunny Storage API error: ${res.status}`);
  }

  const files: BunnyStorageFile[] = await res.json();
  return files.filter((f) => !f.IsDirectory);
}
