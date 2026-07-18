// Booking Agent — handles calendar scheduling + Razorpay order creation post-approval.
// Uses the razorpayMCP for payment gateway integration (Test Mode).
// Google Calendar sync is handled by the calendarMCP.

import { createCalendarEvent } from '../mcp-servers/calendarMCP';
import { createRazorpayOrder, isRazorpayConfigured } from '../mcp-servers/razorpayMCP';
import { TripContext } from '../types';

export async function runBookingAgent(
  context: TripContext,
  userEmail: string,
  razorpayPaymentId?: string   // If provided, payment was pre-verified → skips order creation
): Promise<{ bookingRefs: any; confirmed: boolean; razorpayOrderId?: string }> {
  let calendarEventId = 'No calendar synced';

  // Create Google Calendar events for the trip dates (uses real calendarMCP)
  try {
    const calendarResult = await createCalendarEvent(
      context.input.destination || 'India Tour',
      context.input.start_date!,
      context.input.end_date!,
      userEmail
    );
    if (calendarResult.success && calendarResult.eventId) {
      calendarEventId = calendarResult.eventId;
    }
  } catch (calendarErr) {
    console.error('Gracefully skipped Google Calendar event creation due to integration/auth error:', calendarErr);
  }

  const selectedHotelName = context.accommodation?.selected_hotel?.name || context.accommodation?.recommended || 'Cozy Lodge';
  const selectedTransportOption = context.transport?.selected_option || context.transport?.options?.[0];
  const transportMode = selectedTransportOption?.mode || 'Train';
  const transportOperator = selectedTransportOption?.operator || 'Indian Railways';

  const isHotelSkipped =
    context.accommodation?.selected_category === 'skipped' ||
    selectedHotelName === 'Self Arranged';

  const isTransportSkipped =
    transportMode === 'Self Arranged' ||
    transportMode === 'skipped' ||
    transportOperator === 'Self Arranged';

  // Generate realistic confirmation reference codes based on selection
  const cleanHotel = String(selectedHotelName).replace(/[^A-Za-z0-9]/g, '');
  const hotelRef = isHotelSkipped
    ? 'N/A (Self Arranged)'
    : `HB-HTL-${(cleanHotel || 'HTL').substring(0, 4).toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;

  const cleanMode = String(transportMode).replace(/[^A-Za-z0-9]/g, '');
  const cleanOperator = String(transportOperator).replace(/[^A-Za-z0-9]/g, '');
  const transportRef = isTransportSkipped
    ? 'N/A (Self Arranged)'
    : `PNR-${(cleanMode || 'TRN').substring(0, 3).toUpperCase()}-${(cleanOperator || 'OPR').substring(0, 3).toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;

  // Build payment ref — if Razorpay payment was processed, include the payment ID
  const paymentRef = razorpayPaymentId
    ? `RZP-${razorpayPaymentId}`
    : 'SELF_BOOKED';

  return {
    bookingRefs: {
      hotel: hotelRef,
      calendar: calendarEventId,
      transport: transportRef,
      payment: paymentRef,
    },
    confirmed: true,
  };
}

// ---------------------------------------------------------------------------
// Pre-booking: Create a Razorpay order for the trip (called before checkout)
// Returns the Razorpay order_id and key_id for the frontend checkout widget.
// IMPORTANT: We only charge the BOOKABLE costs — accommodation + transport.
// Food, sightseeing, local cabs, and emergency reserve are self-paid by the
// traveler during the trip and should NOT go through the payment gateway.
// ---------------------------------------------------------------------------
export async function createTripPaymentOrder(
  context: TripContext,
  tripSessionId: string
): Promise<{
  success: boolean;
  orderId?: string;
  keyId?: string;
  amount_inr?: number;
  accommodation_cost?: number;
  transport_cost?: number;
  error?: string;
}> {
  if (!isRazorpayConfigured()) {
    return {
      success: false,
      error: 'Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to your .env file.',
    };
  }

  // Only bill for what we're actually bookings: hotel stay + transit ticket
  const accommodationCost = context.budget?.accommodation || 0;
  const transportCost     = context.budget?.transport     || 0;

  // Fallback: if budget breakdown is missing, try the selected hotel/transport directly
  const hotelFallback     = context.accommodation?.selected_hotel?.total_cost_inr || 0;
  const transportFallback = context.transport?.selected_option?.cost_inr || context.transport?.options?.[0]?.cost_inr || 0;

  const billableAccommodation = accommodationCost || hotelFallback;
  const billableTransport     = transportCost     || transportFallback;
  const billableTotal         = billableAccommodation + billableTransport;

  // If both are self-arranged / skipped, nothing to charge via Razorpay
  const isHotelSkipped     = context.accommodation?.selected_category === 'skipped' || context.accommodation?.selected_hotel?.name === 'Self Arranged';
  const isTransportSkipped = context.transport?.selected_option?.operator === 'Self Arranged';

  const effectiveTotal = isHotelSkipped     ? billableTransport
                       : isTransportSkipped ? billableAccommodation
                       : billableTotal;

  if (effectiveTotal < 1) {
    return {
      success: false,
      error: 'Both hotel and transport are self-arranged, so there is nothing to pay via Razorpay. Use the "Book myself" option.',
    };
  }

  console.log(
    `[bookingAgent] Razorpay billable breakdown — ` +
    `Accommodation: ₹${billableAccommodation} | Transport: ₹${billableTransport} | Total charged: ₹${effectiveTotal}`
  );

  const result = await createRazorpayOrder({
    amount_inr: effectiveTotal,
    receipt: tripSessionId,
    notes: {
      destination:       context.input.destination || 'India Tour',
      accommodation_inr: String(billableAccommodation),
      transport_inr:     String(billableTransport),
      trip_session:      tripSessionId,
    },
  });

  if (!result.success || !result.order) {
    return { success: false, error: result.error || 'Failed to create payment order.' };
  }

  return {
    success: true,
    orderId:           result.order.id,
    keyId:             process.env.RAZORPAY_KEY_ID,
    amount_inr:        effectiveTotal,
    accommodation_cost: billableAccommodation,
    transport_cost:     billableTransport,
  };
}
