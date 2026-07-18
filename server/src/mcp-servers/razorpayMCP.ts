// Razorpay MCP Server — Test Mode Payment Integration
// Implements the MCP-style tool pattern used across this project.
// Uses the official Razorpay REST API (not the remote MCP server) because we are running
// server-side and need direct programmatic control over order creation and payment verification.
//
// Tools exposed:
//   createRazorpayOrder     — creates an order (amount in INR, returns order_id)
//   verifyRazorpayPayment   — verifies HMAC signature after Razorpay checkout
//   createRazorpayPaymentLink — creates a hosted payment link (optional)
//   fetchRazorpayPayment    — fetches payment details by payment_id

import { createHmac } from 'crypto';

const RAZORPAY_KEY_ID     = process.env.RAZORPAY_KEY_ID     || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const RAZORPAY_BASE_URL   = 'https://api.razorpay.com/v1';

// ---------------------------------------------------------------------------
// Internal HTTP helper — all Razorpay API calls use Basic Auth
// ---------------------------------------------------------------------------
async function razorpayFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error('[razorpayMCP] Razorpay credentials are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.');
  }

  const credentials = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');

  const response = await fetch(`${RAZORPAY_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const body = await response.json() as any;

  if (!response.ok) {
    const errMsg = body?.error?.description || body?.error?.reason || `Razorpay API error (${response.status})`;
    throw new Error(`[razorpayMCP] ${errMsg}`);
  }

  return body as T;
}

// ---------------------------------------------------------------------------
// Tool 1: Create Razorpay Order
// Razorpay requires amount in the smallest currency unit (paise = INR × 100)
// ---------------------------------------------------------------------------
export interface RazorpayOrder {
  id: string;            // order_id e.g. order_xxxxxxxxxx
  entity: string;
  amount: number;        // in paise
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;        // created | attempted | paid
  created_at: number;
}

export async function createRazorpayOrder(params: {
  amount_inr: number;   // in full rupees — we convert to paise internally
  receipt: string;       // unique receipt ID (e.g. trip session ID)
  notes?: Record<string, string>;
}): Promise<{ success: boolean; order?: RazorpayOrder; error?: string }> {
  try {
    const amount_paise = Math.round(params.amount_inr * 100);

    if (amount_paise < 100) {
      return { success: false, error: 'Amount must be at least ₹1 (100 paise).' };
    }

    const order = await razorpayFetch<RazorpayOrder>('/orders', {
      method: 'POST',
      body: JSON.stringify({
        amount: amount_paise,
        currency: 'INR',
        receipt: params.receipt.substring(0, 40), // Razorpay max receipt length is 40 chars
        notes: params.notes || {},
      }),
    });

    console.log(`[razorpayMCP] Order created: ${order.id} for ₹${params.amount_inr}`);
    return { success: true, order };
  } catch (err: any) {
    console.error('[razorpayMCP] createRazorpayOrder failed:', err.message);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Tool 2: Verify Razorpay Payment Signature (HMAC-SHA256)
// Must be called server-side after Razorpay checkout success callback
// ---------------------------------------------------------------------------
export function verifyRazorpayPayment(params: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): { valid: boolean; error?: string } {
  try {
    if (!RAZORPAY_KEY_SECRET) {
      return { valid: false, error: 'Razorpay key secret is not configured.' };
    }

    // Compute expected HMAC signature
    const message = `${params.razorpay_order_id}|${params.razorpay_payment_id}`;
    const expectedSignature = createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(message)
      .digest('hex');

    const isValid = expectedSignature === params.razorpay_signature;

    if (isValid) {
      console.log(`[razorpayMCP] Payment signature verified ✓ for payment: ${params.razorpay_payment_id}`);
    } else {
      console.warn(`[razorpayMCP] Payment signature MISMATCH for payment: ${params.razorpay_payment_id}`);
    }

    return { valid: isValid };
  } catch (err: any) {
    console.error('[razorpayMCP] verifyRazorpayPayment error:', err.message);
    return { valid: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Tool 3: Fetch Payment Details (to get paid amount, status, method, etc.)
// ---------------------------------------------------------------------------
export interface RazorpayPayment {
  id: string;
  entity: string;
  amount: number;      // paise
  currency: string;
  status: string;      // created | authorized | captured | refunded | failed
  order_id: string;
  method: string;      // card | netbanking | upi | wallet
  captured: boolean;
  description?: string;
  email?: string;
  contact?: string;
  created_at: number;
}

export async function fetchRazorpayPayment(
  paymentId: string
): Promise<{ success: boolean; payment?: RazorpayPayment; error?: string }> {
  try {
    const payment = await razorpayFetch<RazorpayPayment>(`/payments/${paymentId}`);
    return { success: true, payment };
  } catch (err: any) {
    console.error(`[razorpayMCP] fetchRazorpayPayment(${paymentId}) failed:`, err.message);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Tool 4: Create Razorpay Payment Link (hosted checkout page — optional)
// Useful for sending payment links via email/SMS
// ---------------------------------------------------------------------------
export interface RazorpayPaymentLink {
  id: string;
  short_url: string;
  status: string;
  amount: number;
  currency: string;
  description?: string;
}

export async function createRazorpayPaymentLink(params: {
  amount_inr: number;
  description: string;
  customer_name?: string;
  customer_email?: string;
  customer_contact?: string;
  expire_by?: number;   // Unix timestamp (optional TTL)
}): Promise<{ success: boolean; paymentLink?: RazorpayPaymentLink; error?: string }> {
  try {
    const amount_paise = Math.round(params.amount_inr * 100);

    const body: any = {
      amount: amount_paise,
      currency: 'INR',
      accept_partial: false,
      description: params.description.substring(0, 255),
      notify: {
        sms: false,
        email: false,
      },
    };

    if (params.customer_name || params.customer_email || params.customer_contact) {
      body.customer = {
        ...(params.customer_name    ? { name: params.customer_name }      : {}),
        ...(params.customer_email   ? { email: params.customer_email }    : {}),
        ...(params.customer_contact ? { contact: params.customer_contact } : {}),
      };
    }

    if (params.expire_by) {
      body.expire_by = params.expire_by;
    }

    const paymentLink = await razorpayFetch<RazorpayPaymentLink>('/payment_links', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    console.log(`[razorpayMCP] Payment link created: ${paymentLink.short_url}`);
    return { success: true, paymentLink };
  } catch (err: any) {
    console.error('[razorpayMCP] createRazorpayPaymentLink failed:', err.message);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Tool 5: Capture Payment (required if auto-capture is disabled in Razorpay dashboard)
// ---------------------------------------------------------------------------
export async function captureRazorpayPayment(
  paymentId: string,
  amount_inr: number
): Promise<{ success: boolean; payment?: RazorpayPayment; error?: string }> {
  try {
    const amount_paise = Math.round(amount_inr * 100);
    const payment = await razorpayFetch<RazorpayPayment>(`/payments/${paymentId}/capture`, {
      method: 'POST',
      body: JSON.stringify({ amount: amount_paise, currency: 'INR' }),
    });
    console.log(`[razorpayMCP] Payment captured: ${paymentId}`);
    return { success: true, payment };
  } catch (err: any) {
    console.error(`[razorpayMCP] captureRazorpayPayment(${paymentId}) failed:`, err.message);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Helper: Check if Razorpay is enabled (for graceful fallback)
// ---------------------------------------------------------------------------
export function isRazorpayConfigured(): boolean {
  return !!(
    RAZORPAY_KEY_ID &&
    RAZORPAY_KEY_SECRET &&
    !RAZORPAY_KEY_ID.includes('PLACEHOLDER') &&
    !RAZORPAY_KEY_SECRET.includes('PLACEHOLDER')
  );
}
