// Itinerary Agent — builds the day-by-day schedule using real tourist locations.
// It weaves together weather advisories, real attraction distances (from local_transport),
// meal breaks, check-in/out times, and daily spending caps into a coherent schedule.
//
// BATCHING STRATEGY: We generate at most 5 days per LLM call to prevent the
// model from truncating its JSON output mid-stream (which causes parse failures
// on longer trips). Results are merged into one consolidated itinerary.

import { ChatGroq } from '@langchain/groq';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { TripContext } from './plannerAgent';
import { withRetry } from '../utils/retry';
import logger from '../utils/logger';

const llm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: 'llama-3.1-8b-instant',
  temperature: 0.3, // Lower temp = more deterministic JSON
  maxTokens: 4096,  // Explicit cap per call to prevent runaway responses
});

/** Generates a single itinerary batch for a slice of dates. */
async function generateBatch(
  batchDays: { day: number; date: string }[],
  context: TripContext,
  dailyBudget: number
): Promise<any[]> {
  const { input, weather, transport, accommodation, activities, local_transport } = context;

  // Find matching weather for these dates
  const weatherSnippet = batchDays.map(d =>
    (weather?.forecast || []).find((f: any) => f.date === d.date) || { date: d.date, condition: 'Clear', temp_high_c: 28, temp_low_c: 22 }
  );

  // Build a structured list of attractions with distances from hotel
  const attractionDistances = (local_transport as any)?.attraction_distances || [];
  const realAttractions = (activities?.attraction_options || []) as any[];
  
  // Create enriched attraction info: name + distance + cost + rating
  const enrichedAttractions = realAttractions.map((attr: any) => {
    const distInfo = attractionDistances.find(
      (d: any) => d.attraction?.toLowerCase().includes(attr.name?.toLowerCase().split(' ')[0]) ||
                  attr.name?.toLowerCase().includes(d.attraction?.toLowerCase().split(' ')[0])
    );
    return {
      name: attr.name,
      rating: attr.rating || 4.0,
      vicinity: attr.vicinity || input.destination,
      distance_from_hotel_km: distInfo?.distance_km || null,
      cab_cost_inr: distInfo?.cab_cost_inr || null,
    };
  }).filter((a: any) => a.name);

  // Fallback: use simple attraction names if no enriched data
  const attractionsForPrompt = enrichedAttractions.length > 0
    ? enrichedAttractions.slice(0, 10).map((a: any) =>
        `${a.name} (${a.rating}★${a.distance_from_hotel_km ? `, ${a.distance_from_hotel_km}km from hotel, cab ~₹${a.cab_cost_inr}` : ''})`)
    : (activities?.attractions || []).slice(0, 10);

  const batchPrompt = `Trip: ${input.destination} | Travelers: ${input.travelers}
Hotel: ${accommodation?.recommended || 'Hotel'} (${accommodation?.selected_category || 'mid_range'} category)
Tourist Attractions (with distance from hotel): ${attractionsForPrompt.join('; ')}
Restaurants: ${(activities?.restaurants || []).slice(0, 6).join(', ')}
Available Local Transport: ${(local_transport as any)?.recommended_mode || 'Auto Rickshaw'} (avg cab fare ₹${(local_transport as any)?.daily_transport_budget?.cab_per_day_inr || 300}/day)
Daily budget: ₹${dailyBudget} (excluding accommodation)
Transport arrival (Day 1 only): ${(transport as any)?.options?.[0]?.arrival || '14:00'}
Weather: ${JSON.stringify(weatherSnippet)}

Generate the itinerary for ONLY these ${batchDays.length} day(s): ${batchDays.map(d => `Day ${d.day} (${d.date})`).join(', ')}.
Start day numbering from ${batchDays[0].day}.
IMPORTANT: 
- Day 1 should begin with arrival/check-in then start sightseeing
- Use the REAL tourist attractions listed above
- Include distances and local transport costs in the schedule where relevant
- Spread attractions across days (don't repeat same place)
- Include local transport cost in cost_inr for travel activities`;

  const systemPrompt = `You are a travel itinerary planner. Return ONLY valid, complete JSON — no markdown fences, no explanation.
Schema (STRICTLY follow this, closing ALL braces/brackets):
{
  "days": [
    {
      "day": 1,
      "date": "YYYY-MM-DD",
      "title": "Day title",
      "schedule": [
        { "time": "HH:MM", "activity": "description", "location": "exact place name", "cost_inr": 500, "duration_min": 60, "transport_note": "5km by auto ₹60" }
      ],
      "daily_total_inr": 2000,
      "weather_note": "brief weather note"
    }
  ]
}
Include 4-6 schedule items per day. Keep activity descriptions concise (under 80 chars).
Always include a transport_note field for activities that require travel from hotel.`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await withRetry(
        () => llm.invoke([new SystemMessage(systemPrompt), new HumanMessage(batchPrompt)]),
        { maxRetries: 4, timeout: 45000 }
      );

      const raw = response.content.toString().trim();
      const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON object found in response');

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed.days) || parsed.days.length === 0) {
        throw new Error('Parsed itinerary has empty days array');
      }
      return parsed.days;
    } catch (err: any) {
      logger.warn(`Itinerary batch (days ${batchDays[0].day}-${batchDays[batchDays.length-1].day}) attempt ${attempt}/2 failed`, { error: err.message });
      if (attempt === 2) {
        // Return minimal fallback with real attraction names when available
        const fallbackAttractions = (activities?.attractions || []);
        return batchDays.map((d, idx) => ({
          day: d.day,
          date: d.date,
          title: `Day ${d.day} — ${input.destination}`,
          schedule: [
            { time: '09:00', activity: fallbackAttractions[idx * 2] ? `Visit ${fallbackAttractions[idx * 2]}` : 'Morning exploration', location: fallbackAttractions[idx * 2] || input.destination, cost_inr: 200, duration_min: 120, transport_note: 'By auto ₹60' },
            { time: '13:00', activity: 'Lunch at local restaurant', location: (activities?.restaurants || [])[0] || input.destination, cost_inr: 400, duration_min: 60 },
            { time: '15:00', activity: fallbackAttractions[idx * 2 + 1] ? `Explore ${fallbackAttractions[idx * 2 + 1]}` : 'Sightseeing & local activities', location: fallbackAttractions[idx * 2 + 1] || input.destination, cost_inr: 300, duration_min: 180, transport_note: 'By cab ₹150' },
            { time: '19:00', activity: 'Dinner & evening leisure', location: accommodation?.recommended || 'Hotel', cost_inr: 500, duration_min: 90 },
          ],
          daily_total_inr: 1800 + Math.round((local_transport as any)?.daily_transport_budget?.auto_per_day_inr || 200),
          weather_note: 'Check local conditions before heading out.',
        }));
      }
    }
  }
  return [];
}

export async function runItineraryAgent(context: TripContext): Promise<{ days: any[]; notes: string }> {
  const { input, budget, activities, accommodation, local_transport } = context;

  // Build the list of all trip days
  const startDate = new Date(input.start_date || new Date());
  const endDate = new Date(input.end_date || new Date());
  const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const dailyBudget = Math.round((budget?.remaining_budget_inr || 10000) / totalDays);

  const allDays: { day: number; date: string }[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    allDays.push({ day: i + 1, date: d.toISOString().split('T')[0] });
  }

  // Split into batches of ≤5 days
  const BATCH_SIZE = 5;
  const batches: { day: number; date: string }[][] = [];
  for (let i = 0; i < allDays.length; i += BATCH_SIZE) {
    batches.push(allDays.slice(i, i + BATCH_SIZE));
  }

  logger.info(`Itinerary Agent: generating ${totalDays} days in ${batches.length} batch(es)`, { destination: input.destination });

  const allGeneratedDays: any[] = [];
  for (const batch of batches) {
    const days = await generateBatch(batch, context, dailyBudget);
    allGeneratedDays.push(...days);
  }

  // Build summary notes including actual attractions and local transport info
  const attractionCount = (activities?.attractions || []).length;
  const localMode = (local_transport as any)?.recommended_mode || 'Auto Rickshaw';
  const hotelName = accommodation?.recommended || 'Accommodation';

  return {
    days: allGeneratedDays,
    notes: `${totalDays}-day trip to ${input.destination}. Staying at ${hotelName}. Budget ≈₹${dailyBudget}/day. ${attractionCount} tourist spots covered. Recommended local transport: ${localMode}. Book accommodations and transport well in advance.`,
  };
}
