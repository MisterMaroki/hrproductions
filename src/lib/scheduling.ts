/** Working day: 9:00–18:00, Monday–Saturday */
export const DAY_START = 9 * 60; // 540 mins from midnight
export const DAY_END = 18 * 60; // 1080 mins from midnight
export const MAX_DAILY_MINUTES = DAY_END - DAY_START; // 540 mins = 9 hours

/** Travel buffer between consecutive shoots (minutes) */
export const TRAVEL_BUFFER = 30;

/** Drone add-on time for any video service (minutes) */
export const DRONE_EXTRA_MINS = 25;

export interface BookingServices {
  photography: boolean;
  photoCount: number;
  dronePhotography: boolean;
  standardVideo: boolean;
  standardVideoDrone: boolean;
  agentPresentedVideo: boolean;
  agentPresentedVideoDrone: boolean;
  socialMediaVideo: boolean;
  socialMediaPresentedVideo: boolean;
  floorPlan: boolean;
  floorPlanVirtualTour: boolean;
  bedrooms: number;
}

/**
 * Calculate on-site duration in minutes for a property shoot.
 *
 * - Photography: 40 mins for 20 photos, +5 mins per extra photo
 * - Drone photography: 25 mins
 * - Unpresented video: 40 mins for 2-bed, +5 per extra bedroom
 * - Presented video: 105 mins (1h45m) for 2-bed, +10 per extra bedroom
 * - Drone footage add-on (video): +25 mins
 */
export function calcShootMinutes(services: BookingServices): number {
  let mins = 0;

  if (services.photography) {
    const photos = Math.max(services.photoCount, 20);
    mins += 40 + Math.max(0, photos - 20) * 5;
  }

  if (services.dronePhotography) {
    mins += DRONE_EXTRA_MINS;
  }

  if (services.agentPresentedVideo) {
    const extraBeds = Math.max(0, services.bedrooms - 2);
    mins += 105 + extraBeds * 10;
    if (services.agentPresentedVideoDrone) {
      mins += DRONE_EXTRA_MINS;
    }
  } else if (services.standardVideo) {
    const extraBeds = Math.max(0, services.bedrooms - 2);
    mins += 40 + extraBeds * 5;
    if (services.standardVideoDrone) {
      mins += DRONE_EXTRA_MINS;
    }
  }

  if (services.socialMediaPresentedVideo) {
    const extraBeds = Math.max(0, services.bedrooms - 2);
    mins += 60 + extraBeds * 10;
  } else if (services.socialMediaVideo) {
    const extraBeds = Math.max(0, services.bedrooms - 2);
    mins += 25 + extraBeds * 5;
  }

  if (services.floorPlanVirtualTour) {
    const extraBeds = Math.max(0, services.bedrooms - 2);
    mins += 45 + extraBeds * 10;
  } else if (services.floorPlan) {
    const extraBeds = Math.max(0, services.bedrooms - 2);
    mins += 25 + extraBeds * 5;
  }

  return mins;
}

/** Convert shoot minutes to hours (for backwards compat with DB workHours field) */
export function calcWorkHours(services: BookingServices): number {
  return Math.round((calcShootMinutes(services) / 60) * 100) / 100;
}

export interface TimeSlot {
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
}

export interface ExistingBooking {
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
}

/** Convert "HH:MM" to minutes from midnight */
function toMins(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Convert minutes from midnight to "HH:MM" */
function toTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Generate available time slots for a given date.
 *
 * Takes the shoot duration, adds travel buffers around existing bookings,
 * and returns slots that fit within the working day (9:00–18:00).
 * Slots are offered at 30-min intervals for clean scheduling.
 */
export function getAvailableSlots(
  shootMinutes: number,
  existingBookings: ExistingBooking[],
): TimeSlot[] {
  if (shootMinutes <= 0) return [];

  // Build list of blocked ranges (existing booking time + travel buffer on each side)
  const blocked: { start: number; end: number }[] = existingBookings
    .map((b) => ({
      start: toMins(b.startTime) - TRAVEL_BUFFER,
      end: toMins(b.endTime) + TRAVEL_BUFFER,
    }))
    .sort((a, b) => a.start - b.start);

  const slots: TimeSlot[] = [];
  const step = 30; // offer slots at 30-min intervals

  for (let start = DAY_START; start + shootMinutes <= DAY_END; start += step) {
    const end = start + shootMinutes;

    // Check if this slot overlaps with any blocked range
    const overlaps = blocked.some(
      (b) => start < b.end && end > b.start
    );

    if (!overlaps) {
      slots.push({ start: toTime(start), end: toTime(end) });
    }
  }

  return slots;
}

/** Check if a date string is a weekday (Mon–Sat, no Sundays) */
export function isWorkingDay(dateStr: string): boolean {
  const date = new Date(dateStr + "T12:00:00");
  const day = date.getDay();
  return day >= 1 && day <= 6; // 0 = Sunday
}
