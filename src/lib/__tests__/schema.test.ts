import { bookings, discountCodes, blockedDays, bookingsWhitelabel, whitelabelInvoices } from "../schema";

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

  it("exports bookingsWhitelabel table", () => {
    expect(bookingsWhitelabel).toBeDefined();
  });

  it("exports whitelabelInvoices table", () => {
    expect(whitelabelInvoices).toBeDefined();
  });
});
