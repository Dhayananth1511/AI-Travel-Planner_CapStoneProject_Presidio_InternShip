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

  return {
    bookingRefs: {
      hotel: '',
      calendar: calendarResult.eventId || 'No calendar synced',
      transport: '',
    },
    confirmed: true,
  };
}
