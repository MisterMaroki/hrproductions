export const MAX_DAILY_HOURS = 6;

export interface BookingServices {
  photography: boolean;
  dronePhotography: boolean;
  standardVideo: boolean;
  agentPresentedVideo: boolean;
}

export function calcWorkHours(services: BookingServices): number {
  let hours = 0;

  if (services.photography) hours += 1;
  if (services.dronePhotography) hours += 0.5;
  if (services.agentPresentedVideo) hours += 2;
  else if (services.standardVideo) hours += 1;

  return hours;
}
