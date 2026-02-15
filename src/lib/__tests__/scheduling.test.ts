import { calcWorkHours, type BookingServices } from "../scheduling";

describe("calcWorkHours", () => {
  it("returns 1 for photography only", () => {
    expect(
      calcWorkHours({
        photography: true,
        dronePhotography: false,
        standardVideo: false,
        agentPresentedVideo: false,
      })
    ).toBe(1);
  });

  it("returns 1 for unpresented video", () => {
    expect(
      calcWorkHours({
        photography: false,
        dronePhotography: false,
        standardVideo: true,
        agentPresentedVideo: false,
      })
    ).toBe(1);
  });

  it("returns 2 for agent-presented video", () => {
    expect(
      calcWorkHours({
        photography: false,
        dronePhotography: false,
        standardVideo: false,
        agentPresentedVideo: true,
      })
    ).toBe(2);
  });

  it("returns 0.5 for drone photography only", () => {
    expect(
      calcWorkHours({
        photography: false,
        dronePhotography: true,
        standardVideo: false,
        agentPresentedVideo: false,
      })
    ).toBe(0.5);
  });

  it("returns 1.5 for photography + drone photography", () => {
    expect(
      calcWorkHours({
        photography: true,
        dronePhotography: true,
        standardVideo: false,
        agentPresentedVideo: false,
      })
    ).toBe(1.5);
  });

  it("returns 3.5 for agent-presented video + photography + drone", () => {
    expect(
      calcWorkHours({
        photography: true,
        dronePhotography: true,
        standardVideo: false,
        agentPresentedVideo: true,
      })
    ).toBe(3.5);
  });

  it("returns 0 for no services", () => {
    expect(
      calcWorkHours({
        photography: false,
        dronePhotography: false,
        standardVideo: false,
        agentPresentedVideo: false,
      })
    ).toBe(0);
  });
});
