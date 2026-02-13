import {
  calcPhotography,
  calcStandardVideo,
  calcAgentPresentedVideo,
  calcDrone,
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

describe("calcDrone", () => {
  it("returns 65", () => {
    expect(calcDrone()).toBe(65);
  });
});

describe("calcPropertyTotal", () => {
  it("calculates photography only", () => {
    const total = calcPropertyTotal({
      bedrooms: 3,
      photography: true,
      photoCount: 20,
      standardVideo: false,
      agentPresentedVideo: false,
      drone: false,
    });
    expect(total).toBe(130);
  });

  it("calculates video + drone", () => {
    const total = calcPropertyTotal({
      bedrooms: 3,
      photography: false,
      photoCount: 0,
      standardVideo: true,
      agentPresentedVideo: false,
      drone: true,
    });
    expect(total).toBe(220); // 155 + 65
  });

  it("calculates agent presented video + drone + photography", () => {
    const total = calcPropertyTotal({
      bedrooms: 4,
      photography: true,
      photoCount: 30,
      standardVideo: false,
      agentPresentedVideo: true,
      drone: true,
    });
    // 4 bed agent presented = (125 + 2*30) * 1.5 = 185 * 1.5 = 277.5
    // drone = 65
    // photography = 30 * 6.5 = 195
    // total = 277.5 + 65 + 195 = 537.5
    expect(total).toBe(537.5);
  });

  it("ignores drone when no video selected", () => {
    const total = calcPropertyTotal({
      bedrooms: 2,
      photography: true,
      photoCount: 20,
      standardVideo: false,
      agentPresentedVideo: false,
      drone: true,
    });
    expect(total).toBe(130); // drone ignored
  });
});
