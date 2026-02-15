import {
  calcPhotography,
  calcStandardVideo,
  calcAgentPresentedVideo,
  calcDronePhotography,
  calcVideoDrone,
  calcMultiPropertyDiscount,
  calcPropertyTotal,
} from "../pricing";

describe("calcPhotography", () => {
  it("calculates price for 20 photos", () => {
    expect(calcPhotography(20)).toBe(130);
  });

  it("calculates price for 50 photos", () => {
    expect(calcPhotography(50)).toBe(325);
  });

  it("applies 10% discount at 100 photos", () => {
    expect(calcPhotography(100)).toBe(585);
  });

  it("applies 10% discount above 100 photos", () => {
    expect(calcPhotography(120)).toBe(702);
  });

  it("enforces minimum of 20 photos", () => {
    expect(calcPhotography(10)).toBe(130);
  });
});

describe("calcStandardVideo", () => {
  it("calculates 2-bed price", () => {
    expect(calcStandardVideo(2)).toBe(125);
  });

  it("calculates 3-bed price", () => {
    expect(calcStandardVideo(3)).toBe(155);
  });

  it("calculates 5-bed price", () => {
    expect(calcStandardVideo(5)).toBe(215);
  });
});

describe("calcAgentPresentedVideo", () => {
  it("calculates 2-bed price (1.5x standard)", () => {
    expect(calcAgentPresentedVideo(2)).toBe(187.5);
  });

  it("calculates 3-bed price", () => {
    expect(calcAgentPresentedVideo(3)).toBe(232.5);
  });

  it("calculates 5-bed price", () => {
    expect(calcAgentPresentedVideo(5)).toBe(322.5);
  });
});

describe("calcDronePhotography", () => {
  it("returns 75 for 8 photos", () => {
    expect(calcDronePhotography(8)).toBe(75);
  });

  it("returns 140 for 20 photos", () => {
    expect(calcDronePhotography(20)).toBe(140);
  });
});

describe("calcVideoDrone", () => {
  it("returns 65", () => {
    expect(calcVideoDrone()).toBe(65);
  });
});

describe("calcMultiPropertyDiscount", () => {
  it("returns 0 for 1 property", () => {
    expect(calcMultiPropertyDiscount(1)).toBe(0);
  });

  it("returns 15 for 2 properties", () => {
    expect(calcMultiPropertyDiscount(2)).toBe(15);
  });

  it("returns 30 for 3 properties", () => {
    expect(calcMultiPropertyDiscount(3)).toBe(30);
  });

  it("returns 60 for 5 properties", () => {
    expect(calcMultiPropertyDiscount(5)).toBe(60);
  });
});

describe("calcPropertyTotal", () => {
  const base = {
    bedrooms: 2,
    photography: false,
    photoCount: 20,
    dronePhotography: false,
    dronePhotoCount: 8 as const,
    standardVideo: false,
    standardVideoDrone: false,
    agentPresentedVideo: false,
    agentPresentedVideoDrone: false,
  };

  it("calculates photography only", () => {
    const total = calcPropertyTotal({
      ...base,
      bedrooms: 3,
      photography: true,
    });
    expect(total).toBe(130);
  });

  it("calculates drone photography (8 photos)", () => {
    const total = calcPropertyTotal({
      ...base,
      dronePhotography: true,
      dronePhotoCount: 8,
    });
    expect(total).toBe(75);
  });

  it("calculates drone photography (20 photos)", () => {
    const total = calcPropertyTotal({
      ...base,
      dronePhotography: true,
      dronePhotoCount: 20,
    });
    expect(total).toBe(140);
  });

  it("calculates video + video drone", () => {
    const total = calcPropertyTotal({
      ...base,
      bedrooms: 3,
      standardVideo: true,
      standardVideoDrone: true,
    });
    expect(total).toBe(220); // 155 + 65
  });

  it("calculates agent presented video + video drone + photography", () => {
    const total = calcPropertyTotal({
      ...base,
      bedrooms: 4,
      photography: true,
      photoCount: 30,
      agentPresentedVideo: true,
      agentPresentedVideoDrone: true,
    });
    // 4 bed agent presented = (125 + 2*30) * 1.5 = 185 * 1.5 = 277.5
    // video drone = 65
    // photography = 30 * 6.5 = 195
    // total = 277.5 + 65 + 195 = 537.5
    expect(total).toBe(537.5);
  });

  it("video drone ignored when no video selected", () => {
    const total = calcPropertyTotal({
      ...base,
      photography: true,
      standardVideoDrone: true,
    });
    expect(total).toBe(130); // only photography
  });

  it("calculates all services combined", () => {
    const total = calcPropertyTotal({
      ...base,
      bedrooms: 3,
      photography: true,
      photoCount: 20,
      dronePhotography: true,
      dronePhotoCount: 8,
      standardVideo: true,
      standardVideoDrone: true,
    });
    // photography: 130, drone photo: 75, video (3-bed): 155, video drone: 65
    expect(total).toBe(425);
  });
});
