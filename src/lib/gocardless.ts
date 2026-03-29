import gocardless, { GoCardlessClient, Environments } from "gocardless-nodejs";
import { verifySignature } from "gocardless-nodejs/webhooks";
import { PaymentCurrency } from "gocardless-nodejs/types/Types";

let _client: GoCardlessClient | null = null;

export function getGoCardlessClient(): GoCardlessClient {
  if (!_client) {
    const accessToken = process.env.GOCARDLESS_ACCESS_TOKEN;
    if (!accessToken) throw new Error("GOCARDLESS_ACCESS_TOKEN not set");

    const environment =
      process.env.GOCARDLESS_ENVIRONMENT === "live"
        ? Environments.Live
        : Environments.Sandbox;

    _client = gocardless(accessToken, environment);
  }
  return _client;
}

/**
 * Create a billing request flow for mandate setup.
 * Returns the authorisation URL to embed in the drop-in component.
 */
export async function createBillingRequestFlow(
  clientEmail: string,
  clientName: string,
  companyName: string
): Promise<{ billingRequestFlowId: string; authorisationUrl: string }> {
  const gc = getGoCardlessClient();

  const billingRequest = await gc.billingRequests.create({
    mandate_request: {
      scheme: "bacs",
    },
  });

  const flow = await gc.billingRequestFlows.create({
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/portal/account/setup-mandate?success=true`,
    exit_uri: `${process.env.NEXT_PUBLIC_APP_URL}/portal/account`,
    links: {
      billing_request: billingRequest.id!,
    },
    prefilled_customer: {
      email: clientEmail,
      given_name: clientName.split(" ")[0],
      family_name: clientName.split(" ").slice(1).join(" ") || clientName,
      company_name: companyName,
    },
  });

  return {
    billingRequestFlowId: flow.id!,
    authorisationUrl: flow.authorisation_url!,
  };
}

/**
 * Create a payment against a mandate.
 * Amount is in pence (GBP).
 */
export async function createPayment(
  mandateId: string,
  amountPence: number,
  description: string,
  invoiceId: string
): Promise<string> {
  const gc = getGoCardlessClient();

  const payment = await gc.payments.create({
    // SDK expects amount as string
    amount: String(amountPence) as unknown as string,
    currency: PaymentCurrency.GBP,
    links: {
      mandate: mandateId,
    },
    description,
    metadata: {
      invoice_id: invoiceId,
    },
  });

  return payment.id!;
}

/**
 * Cancel a pending payment.
 */
export async function cancelPayment(paymentId: string): Promise<void> {
  const gc = getGoCardlessClient();
  await gc.payments.cancel(paymentId, {});
}

/**
 * Get mandate details to check status.
 */
export async function getMandate(mandateId: string) {
  const gc = getGoCardlessClient();
  return gc.mandates.find(mandateId);
}

/**
 * Verify a GoCardless webhook signature.
 * Uses the SDK's built-in verifySignature which throws InvalidSignatureError on failure.
 */
export function verifyWebhookSignature(
  body: string,
  signature: string
): boolean {
  const secret = process.env.GOCARDLESS_WEBHOOK_SECRET;
  if (!secret) throw new Error("GOCARDLESS_WEBHOOK_SECRET not set");

  try {
    verifySignature(body, secret, signature);
    return true;
  } catch {
    return false;
  }
}
