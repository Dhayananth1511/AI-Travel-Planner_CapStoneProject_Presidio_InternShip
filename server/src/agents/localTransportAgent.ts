// Local Transport Agent — estimates local transport options at the destination city.
// Computes distances from hotel to each tourist attraction using Google Maps Distance Matrix.
// Also provides auto rickshaw, cab, and bike rental options.

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { ChatGroq } from '@langchain/groq';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import redis from '../config/redis';
import { getDistanceMatrix } from '../mcp-servers/mapsMCP';
import { withRetry } from '../utils/retry';
import logger from '../utils/logger';

const llm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: 'llama-3.1-8b-instant',
  temperature: 0.3,
});

export const localTransportTool = tool(
  async ({ destination, hotel_location, attractions }) => {
    const hotel = hotel_location || `${destination} city center`;
    const attractionsList = Array.isArray(attractions) ? attractions : [];
    const cacheKey = `local_transport:v2:${destination}:${hotel}:${attractionsList.slice(0, 3).join('-')}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.debug('Cache HIT — local transport tool', { cacheKey });
        return cached;
      }
    } catch {
      logger.warn('Redis unavailable for local transport cache');
    }

    logger.debug('Cache MISS — local transport tool fetching from MCP', { cacheKey });

    // Base local transport modes (fare rates per km)
    const CAB_RATE = 18;    // ₹/km — Ola/Uber
    const AUTO_RATE = 12;   // ₹/km — Auto Rickshaw
    const BIKE_RATE = 8;    // ₹/km — Bike rental
    const METRO_RATE = 3;   // ₹/km — Metro (flat estimate)

    // Compute hotel → city center distance for base rates
    let baseCabData = { distance_km: 5.0, duration_min: 20, cab_estimate_inr: 200 };
    try {
      baseCabData = await getDistanceMatrix(hotel, `${destination} City Center`);
    } catch {
      // keep defaults
    }

    // Options for local transport at destination
    const cab_options = [
      {
        type: 'Cab / Taxi (Ola/Uber)',
        icon: '🚖',
        rate_per_km: CAB_RATE,
        base_distance_km: baseCabData.distance_km,
        estimated_one_way_inr: Math.round(baseCabData.distance_km * CAB_RATE),
        note: 'Best for groups. AC, door-to-door, available 24/7.',
        availability: 'High',
        comfort: 'High',
      },
      {
        type: 'Auto Rickshaw',
        icon: '🛺',
        rate_per_km: AUTO_RATE,
        base_distance_km: baseCabData.distance_km,
        estimated_one_way_inr: Math.max(30, Math.round(baseCabData.distance_km * AUTO_RATE)),
        note: 'Most common for short rides. Economical & quick through traffic.',
        availability: 'Very High',
        comfort: 'Medium',
      },
      {
        type: 'Bike Rental',
        icon: '🏍️',
        rate_per_km: BIKE_RATE,
        base_distance_km: baseCabData.distance_km,
        estimated_one_way_inr: Math.max(20, Math.round(baseCabData.distance_km * BIKE_RATE)),
        note: 'Great for solo travelers. Freedom to explore at own pace.',
        availability: 'Medium',
        comfort: 'Low-Medium',
      },
    ];

    // Daily pass estimate for metro (if applicable)
    const metro_options = [
      {
        type: 'Metro / Local Train',
        icon: '🚇',
        daily_pass_inr: 60,
        note: 'Available in major cities. Fastest during peak hours.',
        availability: 'Medium (city dependent)',
        comfort: 'High',
      },
    ];

    // Compute real distances from hotel to each tourist attraction
    const attraction_distances: Array<{
      attraction: string;
      distance_km: number;
      duration_min: number;
      cab_cost_inr: number;
      auto_cost_inr: number;
    }> = [];

    // Process up to 6 attractions to keep API calls manageable
    const toProcess = attractionsList.slice(0, 6);
    for (const attraction of toProcess) {
      try {
        const distData = await getDistanceMatrix(hotel, `${attraction}, ${destination}`);
        attraction_distances.push({
          attraction,
          distance_km: Math.round(distData.distance_km * 10) / 10,
          duration_min: Math.round(distData.duration_min),
          cab_cost_inr: Math.round(distData.distance_km * CAB_RATE),
          auto_cost_inr: Math.max(30, Math.round(distData.distance_km * AUTO_RATE)),
        });
      } catch {
        // fallback estimate
        attraction_distances.push({
          attraction,
          distance_km: 5.0,
          duration_min: 20,
          cab_cost_inr: 90,
          auto_cost_inr: 60,
        });
      }
    }

    // Estimate daily local transport budget
    const avgDistancePerDay = attraction_distances.length > 0
      ? attraction_distances.reduce((sum, a) => sum + a.distance_km, 0) / attraction_distances.length * 2 // round trip
      : baseCabData.distance_km * 3; // 3 trips default

    const daily_transport_budget = {
      cab_per_day_inr: Math.round(avgDistancePerDay * CAB_RATE),
      auto_per_day_inr: Math.round(avgDistancePerDay * AUTO_RATE),
      bike_per_day_inr: Math.round(avgDistancePerDay * BIKE_RATE),
    };

    const data = {
      cab_options,
      metro_options,
      attraction_distances,
      daily_transport_budget,
      recommended_mode: attraction_distances.length > 0 && attraction_distances[0].distance_km > 10
        ? 'Cab / Taxi'
        : 'Auto Rickshaw',
      cab_estimate_inr: baseCabData.cab_estimate_inr, // for budget agent
    };

    // Standalone LLM Reasoning Phase
    let reasoning = '';
    try {
      const systemPrompt = `You are TripPlanner's Local Transportation Specialist Agent. 
Analyze the local transport options in ${destination} from the lodging area (${hotel}).
There are ${attraction_distances.length} tourist spots to visit.
Briefly advise on the best local transport mode, typical fares, and any location-specific tips (e.g., "use Ola in Goa", "metro is best in Delhi") in 2-3 sentences. Keep it concise.`;
      const llmRes = await withRetry(() => llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(JSON.stringify({ attraction_distances, daily_transport_budget, cab_options })),
      ]));
      reasoning = llmRes.content.toString();
    } catch (err) {
      logger.error('Local Transport Agent reasoning analysis failed', err);
      reasoning = 'Auto Rickshaws and ride-hailing cabs are readily accessible from the accommodation.';
    }

    const finalResult = {
      ...data,
      reasoning,
    };

    const finalResultString = JSON.stringify(finalResult);
    try {
      await redis.setex(cacheKey, 43200, finalResultString); // 12 hrs
    } catch {
      logger.warn('Could not write local transport to cache');
    }

    return finalResultString;
  },
  {
    name: 'fetch_local_transport',
    description: 'Fetch local transportation options (cabs, auto rickshaws, bike rentals, metro) at the destination. Calculates real distances from hotel to each tourist attraction for itinerary planning.',
    schema: z.object({
      destination: z.string().describe('Destination city/area name'),
      hotel_location: z.string().optional().describe('Accommodation name or area location within the destination'),
      attractions: z.array(z.string()).optional().describe('List of tourist attraction names to calculate distances from hotel'),
    }),
  }
);
