// Pricing Engine — pure calculation module, safe for browser and server

// ---------------------------------------------------------------------------
// Rule types
// ---------------------------------------------------------------------------

export type PricingRulePerUnit = {
  type: "perUnit";
  input: string;
  rate: number;
  freeUnits: number;
};

export type PricingRuleBulkDiscount = {
  type: "bulkDiscount";
  input: string;
  threshold: number;
  percent: number;
};

export type PricingRuleFixedTier = {
  type: "fixedTier";
  tiers: { label: string; value: number | string; price: number }[];
};

export type PricingRuleMinimum = {
  type: "minimum";
  input: string;
  minValue: number;
};

export type PricingRuleFlatRate = {
  type: "flatRate";
};

export type PricingRule =
  | PricingRulePerUnit
  | PricingRuleBulkDiscount
  | PricingRuleFixedTier
  | PricingRuleMinimum
  | PricingRuleFlatRate;

export type PricingRules = {
  basePrice: number;
  rules: PricingRule[];
};

// ---------------------------------------------------------------------------
// Input field types
// ---------------------------------------------------------------------------

export type InputFieldNumber = {
  key: string;
  label: string;
  type: "number";
  min?: number;
  max?: number;
  default?: number;
};

export type InputFieldSelect = {
  key: string;
  label: string;
  type: "select";
  options: { value: string | number; label: string }[];
  default?: string | number;
};

export type InputFieldBoolean = {
  key: string;
  label: string;
  type: "boolean";
  default?: boolean;
};

export type InputField = InputFieldNumber | InputFieldSelect | InputFieldBoolean;

// ---------------------------------------------------------------------------
// Duration types
// ---------------------------------------------------------------------------

export type DurationRules = {
  baseMinutes: number;
  scaling?: {
    input: string;
    rate: number;
    freeUnits: number;
  };
};

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type LineItem = {
  label: string;
  amount: number; // pounds, not pence
};

export type PriceResult = {
  total: number;
  breakdown: LineItem[];
};

// ---------------------------------------------------------------------------
// evaluatePrice
// ---------------------------------------------------------------------------

export function evaluatePrice(
  pricingRules: PricingRules,
  userInputs: Record<string, number | string | boolean>
): PriceResult {
  const breakdown: LineItem[] = [];

  // Check for fixedTier rule first
  const fixedTierRule = pricingRules.rules.find(
    (r): r is PricingRuleFixedTier => r.type === "fixedTier"
  );

  let runningTotal: number;

  if (fixedTierRule) {
    const tierKey = userInputs["tier"] ?? userInputs["package"];
    const matchedTier = fixedTierRule.tiers.find((t) => t.value === tierKey);
    if (matchedTier) {
      runningTotal = matchedTier.price;
      breakdown.push({ label: matchedTier.label, amount: matchedTier.price });
    } else {
      // No matching tier — fall back to basePrice
      runningTotal = pricingRules.basePrice;
      breakdown.push({ label: "Base price", amount: pricingRules.basePrice });
    }
  } else {
    runningTotal = pricingRules.basePrice;
    breakdown.push({ label: "Base price", amount: pricingRules.basePrice });
  }

  // Apply perUnit rules
  for (const rule of pricingRules.rules) {
    if (rule.type !== "perUnit") continue;
    const inputValue = Number(userInputs[rule.input] ?? 0);
    const billableUnits = Math.max(0, inputValue - rule.freeUnits);
    const amount = rule.rate * billableUnits;
    if (amount !== 0) {
      runningTotal += amount;
      breakdown.push({
        label: `${rule.input} (${billableUnits} × £${rule.rate})`,
        amount,
      });
    }
  }

  // Apply bulkDiscount rules
  for (const rule of pricingRules.rules) {
    if (rule.type !== "bulkDiscount") continue;
    const inputValue = Number(userInputs[rule.input] ?? 0);
    if (inputValue >= rule.threshold) {
      const discount = round2((runningTotal * rule.percent) / 100);
      runningTotal -= discount;
      breakdown.push({
        label: `Bulk discount (${rule.percent}%)`,
        amount: -discount,
      });
    }
  }

  runningTotal = round2(runningTotal);

  return { total: runningTotal, breakdown };
}

// ---------------------------------------------------------------------------
// evaluateDuration
// ---------------------------------------------------------------------------

export function evaluateDuration(
  durationRules: DurationRules,
  userInputs: Record<string, number | string | boolean>
): number {
  let totalMinutes = durationRules.baseMinutes;

  if (durationRules.scaling) {
    const { input, rate, freeUnits } = durationRules.scaling;
    const inputValue = Number(userInputs[input] ?? 0);
    const billableUnits = Math.max(0, inputValue - freeUnits);
    totalMinutes += billableUnits * rate;
  }

  return totalMinutes;
}

// ---------------------------------------------------------------------------
// validateInputs
// ---------------------------------------------------------------------------

export function validateInputs(
  inputFields: InputField[],
  userInputs: Record<string, number | string | boolean>,
  pricingRules: PricingRules
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  for (const field of inputFields) {
    const value = userInputs[field.key];

    if (field.type === "number") {
      const num = value !== undefined ? Number(value) : undefined;
      if (num !== undefined && !isNaN(num)) {
        if (field.min !== undefined && num < field.min) {
          errors[field.key] = `${field.label} must be at least ${field.min}.`;
        } else if (field.max !== undefined && num > field.max) {
          errors[field.key] = `${field.label} must be at most ${field.max}.`;
        }
      }
    }

    if (field.type === "select" && value !== undefined) {
      const validValues = field.options.map((o) => o.value);
      if (!validValues.includes(value as string | number)) {
        errors[field.key] = `${field.label} has an invalid selection.`;
      }
    }
  }

  // Check minimum rules from pricingRules
  for (const rule of pricingRules.rules) {
    if (rule.type !== "minimum") continue;
    const inputValue = Number(userInputs[rule.input] ?? 0);
    if (inputValue < rule.minValue) {
      errors[rule.input] =
        errors[rule.input] ??
        `${rule.input} must be at least ${rule.minValue}.`;
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// ---------------------------------------------------------------------------
// calcMultiPropertyDiscount
// ---------------------------------------------------------------------------

export function calcMultiPropertyDiscount(propertyCount: number): number {
  if (propertyCount <= 1) return 0;
  return (propertyCount - 1) * 15;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
