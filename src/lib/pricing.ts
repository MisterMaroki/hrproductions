const PHOTO_PRICE = 6.5;
const PHOTO_MIN = 20;
const PHOTO_BULK_THRESHOLD = 100;
const PHOTO_BULK_DISCOUNT = 0.1;

const VIDEO_BASE = 125;
const VIDEO_PER_BEDROOM = 30;
const VIDEO_BASE_BEDROOMS = 2;

const AGENT_PRESENTED_MULTIPLIER = 1.5;
const DRONE_PRICE = 65;

export function calcPhotography(count: number): number {
  const actual = Math.max(count, PHOTO_MIN);
  const subtotal = actual * PHOTO_PRICE;
  if (actual >= PHOTO_BULK_THRESHOLD) {
    return Math.round(subtotal * (1 - PHOTO_BULK_DISCOUNT) * 100) / 100;
  }
  return subtotal;
}

export function calcStandardVideo(bedrooms: number): number {
  return VIDEO_BASE + Math.max(0, bedrooms - VIDEO_BASE_BEDROOMS) * VIDEO_PER_BEDROOM;
}

export function calcAgentPresentedVideo(bedrooms: number): number {
  return calcStandardVideo(bedrooms) * AGENT_PRESENTED_MULTIPLIER;
}

export function calcDrone(): number {
  return DRONE_PRICE;
}

export interface PropertyServices {
  bedrooms: number;
  photography: boolean;
  photoCount: number;
  standardVideo: boolean;
  agentPresentedVideo: boolean;
  drone: boolean;
}

export function calcPropertyTotal(services: PropertyServices): number {
  let total = 0;

  if (services.photography) {
    total += calcPhotography(services.photoCount);
  }

  const hasVideo = services.standardVideo || services.agentPresentedVideo;

  if (services.agentPresentedVideo) {
    total += calcAgentPresentedVideo(services.bedrooms);
  } else if (services.standardVideo) {
    total += calcStandardVideo(services.bedrooms);
  }

  if (services.drone && hasVideo) {
    total += calcDrone();
  }

  return total;
}
