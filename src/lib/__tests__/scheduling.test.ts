import {
  calcShootMinutes,
  calcWorkHours,
  getAvailableSlots,
  isWorkingDay,
  type BookingServices,
} from "../scheduling";

const base: BookingServices = {
  photography: false,
  photoCount: 20,
  dronePhotography: false,
  standardVideo: false,
  standardVideoDrone: false,
  agentPresentedVideo: false,
  agentPresentedVideoDrone: false,
  bedrooms: 2,
};

describe("calcShootMinutes", () => {
  it("returns 40 for 20 photos", () => {
    expect(calcShootMinutes({ ...base, photography: true })).toBe(40);
  });

  it("returns 55 for 23 photos", () => {
    expect(calcShootMinutes({ ...base, photography: true, photoCount: 23 })).toBe(55);
  });

  it("returns 90 for 30 photos", () => {
    expect(calcShootMinutes({ ...base, photography: true, photoCount: 30 })).toBe(90);
  });

  it("returns 25 for drone photography", () => {
    expect(calcShootMinutes({ ...base, dronePhotography: true })).toBe(25);
  });

  it("returns 40 for unpresented video (2-bed)", () => {
    expect(calcShootMinutes({ ...base, standardVideo: true })).toBe(40);
  });

  it("returns 45 for unpresented video (3-bed)", () => {
    expect(calcShootMinutes({ ...base, standardVideo: true, bedrooms: 3 })).toBe(45);
  });

  it("returns 55 for unpresented video (5-bed)", () => {
    expect(calcShootMinutes({ ...base, standardVideo: true, bedrooms: 5 })).toBe(55);
  });

  it("returns 65 for unpresented video + drone (2-bed)", () => {
    expect(calcShootMinutes({ ...base, standardVideo: true, standardVideoDrone: true })).toBe(65);
  });

  it("returns 105 for presented video (2-bed)", () => {
    expect(calcShootMinutes({ ...base, agentPresentedVideo: true })).toBe(105);
  });

  it("returns 115 for presented video (3-bed)", () => {
    expect(calcShootMinutes({ ...base, agentPresentedVideo: true, bedrooms: 3 })).toBe(115);
  });

  it("returns 135 for presented video (5-bed)", () => {
    expect(calcShootMinutes({ ...base, agentPresentedVideo: true, bedrooms: 5 })).toBe(135);
  });

  it("returns 130 for presented video + drone (2-bed)", () => {
    expect(
      calcShootMinutes({ ...base, agentPresentedVideo: true, agentPresentedVideoDrone: true })
    ).toBe(130);
  });

  it("stacks photography + presented video + drone", () => {
    const mins = calcShootMinutes({
      ...base,
      photography: true,
      photoCount: 20,
      agentPresentedVideo: true,
      agentPresentedVideoDrone: true,
      bedrooms: 3,
    });
    // photos: 40, presented 3-bed: 115, video drone: 25 = 180
    expect(mins).toBe(180);
  });

  it("returns 0 for no services", () => {
    expect(calcShootMinutes(base)).toBe(0);
  });
});

describe("calcWorkHours", () => {
  it("converts minutes to hours", () => {
    expect(calcWorkHours({ ...base, photography: true })).toBe(0.67);
  });

  it("returns 1.75 for presented video (2-bed)", () => {
    expect(calcWorkHours({ ...base, agentPresentedVideo: true })).toBe(1.75);
  });
});

describe("getAvailableSlots", () => {
  it("returns slots across full day for short shoot", () => {
    const slots = getAvailableSlots(60, []);
    // 9:00 to 17:00 start times at 30-min intervals for 60-min shoot
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]).toEqual({ start: "09:00", end: "10:00" });
    expect(slots[slots.length - 1]).toEqual({ start: "17:00", end: "18:00" });
  });

  it("blocks slots that overlap with existing bookings + travel buffer", () => {
    const slots = getAvailableSlots(60, [
      { startTime: "12:00", endTime: "13:00" },
    ]);
    // Should not have any slots starting from 11:00 to 13:00
    // (11:30 start would end at 12:30, overlapping with blocked 11:30-13:30)
    const blockedStarts = slots.filter(
      (s) => s.start >= "11:00" && s.start <= "13:00"
    );
    expect(blockedStarts).toEqual([]);
  });

  it("returns empty for shoot longer than day", () => {
    const slots = getAvailableSlots(600, []);
    expect(slots).toEqual([]);
  });

  it("returns empty for 0 duration", () => {
    const slots = getAvailableSlots(0, []);
    expect(slots).toEqual([]);
  });
});

describe("isWorkingDay", () => {
  it("returns true for Monday", () => {
    expect(isWorkingDay("2026-02-23")).toBe(true); // Monday
  });

  it("returns true for Saturday", () => {
    expect(isWorkingDay("2026-02-28")).toBe(true); // Saturday
  });

  it("returns false for Sunday", () => {
    expect(isWorkingDay("2026-02-22")).toBe(false); // Sunday
  });
});
