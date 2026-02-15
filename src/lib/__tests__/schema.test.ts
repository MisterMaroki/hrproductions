import { bookings, discountCodes, blockedDays } from "../schema";

describe("schema exports", () => {
  it("exports bookings table", () => {
    expect(bookings).toBeDefined();
  });

  it("exports discountCodes table", () => {
    expect(discountCodes).toBeDefined();
  });

  it("exports blockedDays table", () => {
    expect(blockedDays).toBeDefined();
  });
});
