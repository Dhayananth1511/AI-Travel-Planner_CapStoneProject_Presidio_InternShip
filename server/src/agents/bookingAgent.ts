// Booking Agent — handles calendar scheduling post-approval.
// In a real production deployment, this would invoke real-world GDS / travel booking API integrations.

import { createCalendarEvent } from '../mcp-servers/calendarMCP';
import { TripContext } from './plannerAgent';

export async function runBookingAgent(
  context: TripContext,
  userEmail: string
): Promise<{ bookingRefs: any; confirmed: boolean }> {
  // Create Google Calendar events for the trip dates (uses real calendarMCP)
  const calendarResult = await createCalendarEvent(
    context.input.destination || 'India Tour',
    context.input.start_date!,
    context.input.end_date!,
    userEmail
  );

  const hotelName = context.accommodation?.recommended || 'Cozy Lodge';
  const transportMode = context.transport?.options?.[0]?.mode || 'Train';
  const transportOperator = context.transport?.options?.[0]?.operator || 'Indian Railways';

  // Generate realistic confirmation reference codes based on selection
  const hotelRef = `HB-HTL-${hotelName.replace(/[^A-Za-z0-9]/g, '').substring(0, 4).toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;
  const transportRef = `PNR-${transportMode.replace(/[^A-Za-z0-9]/g, '').substring(0, 3).toUpperCase()}-${transportOperator.replace(/[^A-Za-z0-9]/g, '').substring(0, 3).toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;

  return {
    bookingRefs: {
      hotel: hotelRef,
      calendar: calendarResult.eventId || 'No calendar synced',
      transport: transportRef,
    },
    confirmed: true,
  };
}
