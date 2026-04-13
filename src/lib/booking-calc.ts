import { evaluatePrice, evaluateDuration, type PricingRules } from "./pricing-engine";

export interface ServiceSnapshot {
  id: string;
  name: string;
  pricingRules: PricingRules;
  durationRules: unknown;
}

export interface PropertyInput {
  id: string;
  address: string;
  postcode: string | null;
  bedrooms: number;
  preferredDate: string;
  timeSlot: string | null;
  notes: string;
  selectedServices: { serviceId: string; inputs: Record<string, number | string | boolean> }[];
}

export interface BookingRow {
  services: string; // JSON: SelectedService[]
  workHours: number;
  subtotal: number; // pence
  discountAmount: number; // pence
  total: number; // pence
  startTime: string | null;
  endTime: string | null;
}

export function computeBookingRow(
  p: PropertyInput,
  allServices: ServiceSnapshot[],
  discountPct: number,
): BookingRow {
  const servicesData = p.selectedServices.map((sel) => {
    const svc = allServices.find((s) => s.id === sel.serviceId);
    return {
      serviceId: sel.serviceId,
      serviceName: svc?.name ?? "Unknown",
      inputs: sel.inputs,
      computedPrice: svc
        ? evaluatePrice(svc.pricingRules, { ...sel.inputs, bedrooms: p.bedrooms }).total
        : 0,
    };
  });

  const workMinutes = p.selectedServices.reduce((total, sel) => {
    const svc = allServices.find((s) => s.id === sel.serviceId);
    if (!svc) return total;
    return total + evaluateDuration(svc.durationRules as Parameters<typeof evaluateDuration>[0], { ...sel.inputs, bedrooms: p.bedrooms });
  }, 0);
  const workHours = Math.round((workMinutes / 60) * 100) / 100;

  const subtotal = Math.round(
    servicesData.reduce((sum, s) => sum + s.computedPrice, 0) * 100,
  );
  const discountAmount = discountPct ? Math.round(subtotal * (discountPct / 100)) : 0;
  const total = subtotal - discountAmount;

  let startTime: string | null = p.timeSlot || null;
  let endTime: string | null = null;
  if (startTime) {
    const [h, m] = startTime.split(":").map(Number);
    const endMins = h * 60 + m + Math.round(workHours * 60);
    const endH = Math.floor(endMins / 60);
    const endM = endMins % 60;
    endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
  }

  return {
    services: JSON.stringify(servicesData),
    workHours,
    subtotal,
    discountAmount,
    total,
    startTime,
    endTime,
  };
}
