# Booking Flow Account Signup CTA

## Overview

Add prompts within the existing public booking flow at `/book` to encourage estate agents to sign up for a trade account instead of paying per-booking via Stripe.

## Changes

### 1. Top Banner on `/book`

A subtle banner above the booking form content: "Book regularly? Create a trade account to book on credit and receive a single monthly invoice." with a link to `/portal/signup`.

Styled as a non-intrusive info bar — not a blocking modal or alert. Uses the project's design language (warm off-white background, dark border, small text).

### 2. Checkout Step — Dual Path

At the point where the user would normally proceed to Stripe checkout (the basket/summary area), show two options:

1. **"Pay Now"** — existing Stripe checkout flow, completely unchanged
2. **"Create a Trade Account"** — expands an inline signup form below

### 3. Inline Signup Form

Pre-filled with agent details already entered in the booking form (name, company, email, phone). The user only needs to add:
- Password
- Confirm password

On submit:
1. Calls `POST /api/portal/signup-with-booking` which atomically creates the client account (`pending_approval` status) and saves the booking(s) as `pending` with the new `clientId`
2. Shows success message: "Account created and booking submitted! Your account is pending approval — we'll email you when it's active. Your booking has been added to the calendar."
3. Sends Harrison the signup notification email and booking notification email

### 4. New API Endpoint

`POST /api/portal/signup-with-booking`

Accepts:
```json
{
  "account": { "companyName", "contactName", "email", "phone", "password" },
  "properties": [{ ...same shape as checkout properties }]
}
```

Does in one transaction:
1. Check email doesn't already exist
2. Hash password, create client with `pending_approval` status
3. For each property: calculate pricing/scheduling, create booking with `clientId` set, `status: "pending"`, no `stripeSession`
4. Send signup notification email to Harrison
5. Send booking notification email to Harrison
6. Return `{ success: true }`

### 5. Booking Visibility

Bookings created this way appear on the calendar immediately as "pending" and block the time slot. The account being `pending_approval` does not affect the booking's visibility — it only restricts the client from self-service booking via the portal until approved.

## Files Changed

- `src/components/BookingSection.tsx` — add top banner, add account signup option at checkout step
- `src/app/api/portal/signup-with-booking/route.ts` — new endpoint combining signup + booking

## What Stays Unchanged

- Existing Stripe checkout flow (the "Pay Now" path)
- Portal signup at `/portal/signup`
- All other booking and account functionality
