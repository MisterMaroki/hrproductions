import { buildThumbnailUrl, buildPlayUrl } from "../bunny";

describe("bunny URL builders", () => {
  const pullZone = "vz-abc123.b-cdn.net";
  const videoId = "test-video-guid-123";

  it("builds thumbnail URL", () => {
    expect(buildThumbnailUrl(pullZone, videoId)).toBe(
      "https://vz-abc123.b-cdn.net/test-video-guid-123/thumbnail.jpg"
    );
  });

  it("builds play URL", () => {
    expect(buildPlayUrl(pullZone, videoId)).toBe(
      "https://vz-abc123.b-cdn.net/test-video-guid-123/play_720p.mp4"
    );
  });
});
