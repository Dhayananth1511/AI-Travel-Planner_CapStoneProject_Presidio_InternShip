// Local Transport Agent — estimates local transport options (cabs, auto rickshaws) with 12-hour Redis cache.

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
  async ({ destination, hotel_location }) => {
    const hotel = hotel_location || `${destination} center`;
    const cacheKey = `local_transport:${destination}:${hotel}`;

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
    
    // Calculate distance and travel estimates between the hotel location and a general landmark / city center
    const distanceData = await getDistanceMatrix(hotel, `${destination} City Center`);
    
    // Common local fare models in India
    const cabRate = 18;  // per km
    const autoRate = 12; // per km
    
    const cabObj = {
      type: 'Cab / Taxi',
      distance_km: distanceData.distance_km,
      duration_min: distanceData.duration_min,
      estimated_cost_inr: Math.round(distanceData.distance_km * cabRate),
      note: 'Ideal for groups, luggage, and air-conditioned travel.'
    };
    
    const autoObj = {
      type: 'Auto Rickshaw',
      distance_km: distanceData.distance_km,
      duration_min: Math.round(distanceData.duration_min * 1.2), // traffic correction
      estimated_cost_inr: Math.max(30, Math.round(distanceData.distance_km * autoRate)),
      note: 'Most common and cost-effective mode for short city rides.'
    };

    const data = {
      cab_estimates: [cabObj],
      auto_estimates: [autoObj]
    };

    // Standalone LLM Reasoning Phase
    let reasoning = '';
    try {
      const systemPrompt = `You are TripPlanner's Local Transportation Specialist Agent. 
Analyze the local transport estimates (cab and auto rickshaw) in ${destination} from the lodging area (${hotel}) to the city center.
Briefly explain the best local transit choice, relative availability, and travel advice in 2-3 sentences. Keep it short.`;
      const llmRes = await withRetry(() => llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(JSON.stringify(data)),
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
      await redis.setex(cacheKey, 43200, finalResultString);
    } catch {
      logger.warn('Could not write local transport to cache');
    }

    return finalResultString;
  },
  {
    name: 'fetch_local_transport',
    description: 'Fetch estimates and advice for local transportation (such as cabs and auto rickshaws) between the lodging location and the destination city center or hotspots.',
    schema: z.object({
      destination: z.string().describe('Destination city/area name'),
      hotel_location: z.string().optional().describe('Accommodation name or area location'),
    }),
  }
);
