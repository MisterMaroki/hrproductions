const PHOTO_PRICE = 6.5;
const PHOTO_MIN = 20;
const PHOTO_BULK_THRESHOLD = 100;
const PHOTO_BULK_DISCOUNT = 0.1;

const UNPRESENTED_VIDEO_BASE = 100;
const PRESENTED_VIDEO_BASE = 150;
const VIDEO_PER_BEDROOM = 25;
const VIDEO_BASE_BEDROOMS = 2;

const SOCIAL_MEDIA_UNPRESENTED_BASE = 100;
const SOCIAL_MEDIA_PRESENTED_BASE = 150;
const SOCIAL_MEDIA_PER_BEDROOM = 25;
const SOCIAL_MEDIA_BASE_BEDROOMS = 2;

const FLOOR_PLAN_BASE = 60;
const FLOOR_PLAN_PER_BEDROOM = 15;
const FLOOR_PLAN_TOUR_BASE = 140;
const FLOOR_PLAN_TOUR_PER_BEDROOM = 20;
const FLOOR_PLAN_BASE_BEDROOMS = 2;

const DRONE_PHOTO_8_PRICE = 75;
const DRONE_PHOTO_20_PRICE = 140;
const DRONE_VIDEO_PRICE = 65;

const MULTI_PROPERTY_DISCOUNT = 15;

export function calcPhotography(count: number): number {
  const actual = Math.max(count, PHOTO_MIN);
  const subtotal = actual * PHOTO_PRICE;
  if (actual >= PHOTO_BULK_THRESHOLD) {
    return Math.round(subtotal * (1 - PHOTO_BULK_DISCOUNT) * 100) / 100;
  }
  return subtotal;
}

export function calcStandardVideo(bedrooms: number): number {
  return UNPRESENTED_VIDEO_BASE + Math.max(0, bedrooms - VIDEO_BASE_BEDROOMS) * VIDEO_PER_BEDROOM;
}

export function calcAgentPresentedVideo(bedrooms: number): number {
  return PRESENTED_VIDEO_BASE + Math.max(0, bedrooms - VIDEO_BASE_BEDROOMS) * VIDEO_PER_BEDROOM;
}

export function calcDronePhotography(count: 8 | 20): number {
  return count === 8 ? DRONE_PHOTO_8_PRICE : DRONE_PHOTO_20_PRICE;
}

export function calcVideoDrone(): number {
  return DRONE_VIDEO_PRICE;
}

export function calcSocialMediaVideo(bedrooms: number): number {
  return SOCIAL_MEDIA_UNPRESENTED_BASE + Math.max(0, bedrooms - SOCIAL_MEDIA_BASE_BEDROOMS) * SOCIAL_MEDIA_PER_BEDROOM;
}

export function calcSocialMediaPresentedVideo(bedrooms: number): number {
  return SOCIAL_MEDIA_PRESENTED_BASE + Math.max(0, bedrooms - SOCIAL_MEDIA_BASE_BEDROOMS) * SOCIAL_MEDIA_PER_BEDROOM;
}

export function calcFloorPlan(bedrooms: number): number {
  return FLOOR_PLAN_BASE + Math.max(0, bedrooms - FLOOR_PLAN_BASE_BEDROOMS) * FLOOR_PLAN_PER_BEDROOM;
}

export function calcFloorPlanVirtualTour(bedrooms: number): number {
  return FLOOR_PLAN_TOUR_BASE + Math.max(0, bedrooms - FLOOR_PLAN_BASE_BEDROOMS) * FLOOR_PLAN_TOUR_PER_BEDROOM;
}

export function calcMultiPropertyDiscount(propertyCount: number): number {
  if (propertyCount <= 1) return 0;
  return (propertyCount - 1) * MULTI_PROPERTY_DISCOUNT;
}

export interface PropertyServices {
  bedrooms: number;
  photography: boolean;
  photoCount: number;
  dronePhotography: boolean;
  dronePhotoCount: 8 | 20;
  standardVideo: boolean;
  standardVideoDrone: boolean;
  agentPresentedVideo: boolean;
  agentPresentedVideoDrone: boolean;
  socialMediaVideo: boolean;
  socialMediaPresentedVideo: boolean;
  floorPlan: boolean;
  floorPlanVirtualTour: boolean;
}

export function calcPropertyTotal(services: PropertyServices): number {
  let total = 0;

  if (services.photography) {
    total += calcPhotography(services.photoCount);
  }

  if (services.dronePhotography) {
    total += calcDronePhotography(services.dronePhotoCount);
  }

  if (services.agentPresentedVideo) {
    total += calcAgentPresentedVideo(services.bedrooms);
    if (services.agentPresentedVideoDrone) {
      total += calcVideoDrone();
    }
  } else if (services.standardVideo) {
    total += calcStandardVideo(services.bedrooms);
    if (services.standardVideoDrone) {
      total += calcVideoDrone();
    }
  }

  if (services.socialMediaPresentedVideo) {
    total += calcSocialMediaPresentedVideo(services.bedrooms);
  } else if (services.socialMediaVideo) {
    total += calcSocialMediaVideo(services.bedrooms);
  }

  if (services.floorPlanVirtualTour) {
    total += calcFloorPlanVirtualTour(services.bedrooms);
  } else if (services.floorPlan) {
    total += calcFloorPlan(services.bedrooms);
  }

  return total;
}
