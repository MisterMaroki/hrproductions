import { computeBookingRow, type ServiceSnapshot } from "../booking-calc";

const svc: ServiceSnapshot = {
  id: "svc1",
  name: "Photography",
  pricingRules: { basePrice: 100, rules: [] },
  durationRules: { baseMinutes: 60 },
};

describe("computeBookingRow", () => {
  it("computes subtotal, total, workHours for a single-service property", () => {
    const row = computeBookingRow(
      {
        id: "p1",
        address: "1 High St",
        postcode: "BN1 1AA",
        bedrooms: 3,
        preferredDate: "2026-05-01",
        timeSlot: "09:00",
        notes: "",
        selectedServices: [{ serviceId: "svc1", inputs: {} }],
      },
      [svc],
      0,
    );

    expect(row.subtotal).toBe(10000); // pence
    expect(row.total).toBe(10000);
    expect(row.workHours).toBe(1);
    expect(row.startTime).toBe("09:00");
    expect(row.endTime).toBe("10:00");
    const parsed = JSON.parse(row.services);
    expect(parsed[0].serviceName).toBe("Photography");
  });

  it("applies per-property discount percentage", () => {
    const row = computeBookingRow(
      {
        id: "p1",
        address: "1 High St",
        postcode: null,
        bedrooms: 2,
        preferredDate: "2026-05-01",
        timeSlot: null,
        notes: "",
        selectedServices: [{ serviceId: "svc1", inputs: {} }],
      },
      [svc],
      10,
    );

    expect(row.subtotal).toBe(10000);
    expect(row.discountAmount).toBe(1000);
    expect(row.total).toBe(9000);
  });
});
