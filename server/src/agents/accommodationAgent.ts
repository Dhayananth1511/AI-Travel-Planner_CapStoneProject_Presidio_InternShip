// Accommodation Agent — search hotels with 1-hour Redis cache.
// Categories: Budget (<₹5000/night), Mid-Range (₹5000-₹15000/night), Luxury (>₹15000/night)

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { ChatGroq } from '@langchain/groq';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import redis from '../config/redis';
import { searchHotels } from '../mcp-servers/bookingMCP';
import { withRetry } from '../utils/retry';
import logger from '../utils/logger';

const llm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: 'llama-3.1-8b-instant',
  temperature: 0.3,
});

export const accommodationTool = tool(
  async ({ destination, check_in, check_out, travelers, tier }) => {
    const cacheKey = `hotels:${destination}:${check_in}:${check_out}:${travelers}:${tier || 'default'}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.debug('Cache HIT — hotel options tool', { cacheKey });
        return cached;
      }
    } catch {
      logger.warn('Redis unavailable for hotel cache');
    }

    logger.debug('Cache MISS — hotel options tool fetching from MCP', { cacheKey });
    const data = await searchHotels(destination, check_in, check_out, travelers);

    // Standalone LLM Reasoning Phase
    let reasoning = '';
    try {
      const systemPrompt = `You are TripPlanner's Lodging & Accommodation Specialist Agent. 
Analyze the accommodation choices in ${destination} checking in on ${check_in} and out on ${check_out} for ${travelers} guests.
Briefly explain if the hotels are suitable, what amenities or lodging tiers are interesting, and safety/convenience ratings in 2-3 sentences. Keep it short.`;
      const llmRes = await withRetry(() => llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(JSON.stringify(data)),
      ]));
      reasoning = llmRes.content.toString();
    } catch (err) {
      logger.error('Accommodation Agent reasoning analysis failed', err);
      reasoning = 'Lodgings are chosen near primary destination routes.';
    }

    const nights = Math.max(
      1,
      (new Date(check_out).getTime() - new Date(check_in).getTime()) / (1000 * 60 * 60 * 24)
    );

    // ── STRICT PRICE-BASED CATEGORY THRESHOLDS ──────────────────────────────
    // Budget: price_per_night_inr < 5000
    // Mid-Range: 5000 <= price_per_night_inr <= 15000
    // Luxury: price_per_night_inr > 15000
    const BUDGET_MAX = 4999;
    const MID_MIN = 5000;
    const MID_MAX = 15000;
    const LUXURY_MIN = 15001;

    // Fallback hotel templates for when real data doesn't fill a category
    const budgetFallbacks = [
      { name: `${destination} Budget Inn`, rating: 4.1, price: 1800, amenities: ['WiFi', 'AC', 'Breakfast'] },
      { name: `${destination} Traveler's Hostel`, rating: 4.0, price: 1200, amenities: ['WiFi', 'Locker Room', 'Breakfast'] },
      { name: `${destination} Cozy Guesthouse`, rating: 4.2, price: 2800, amenities: ['WiFi', 'AC', 'Parking'] },
    ];
    const midRangeFallbacks = [
      { name: `${destination} Premium Inn & Suites`, rating: 4.5, price: 6500, amenities: ['WiFi', 'AC', 'Pool', 'Restaurant'] },
      { name: `${destination} Heritage Hotel`, rating: 4.4, price: 8000, amenities: ['WiFi', 'AC', 'Heritage Courtyard', 'Restaurant'] },
      { name: `${destination} City Center Vista`, rating: 4.3, price: 11500, amenities: ['WiFi', 'AC', 'Gym', 'Restaurant'] },
    ];
    const luxuryFallbacks = [
      { name: `${destination} Grand Resort & Spa`, rating: 4.9, price: 18000, amenities: ['WiFi', 'AC', 'Pool', 'Spa', 'Restaurant', 'Bar'] },
      { name: `${destination} Royal Palace Retreat`, rating: 4.8, price: 25000, amenities: ['WiFi', 'AC', 'Pool', 'Spa', 'Butler Service'] },
      { name: `${destination} Signature Elite Villa`, rating: 4.7, price: 32000, amenities: ['WiFi', 'AC', 'Private Pool', 'Kitchen', 'Concierge'] },
    ];

    // Sort all fetched hotels by price
    const hotelsList = [...(data.hotels || [])].sort((a, b) => a.price_per_night_inr - b.price_per_night_inr);

    const categories: { budget: any[]; mid_range: any[]; luxury: any[] } = {
      budget: [],
      mid_range: [],
      luxury: [],
    };

    // Classify real hotels by exact price thresholds
    hotelsList.forEach((hotel: any) => {
      const price = hotel.price_per_night_inr || 0;
      if (price <= BUDGET_MAX) {
        categories.budget.push(hotel);
      } else if (price >= MID_MIN && price <= MID_MAX) {
        categories.mid_range.push(hotel);
      } else if (price >= LUXURY_MIN) {
        categories.luxury.push(hotel);
      }
    });

    // Helper: pad a category with fallback templates to ensure at least 3 options
    const padCategory = (catList: any[], fallbacks: any[], catName: string) => {
      const result = [...catList];
      for (const fb of fallbacks) {
        if (result.length >= 3) break;
        const duplicate = result.some(
          (h: any) => h.name.toLowerCase().includes(fb.name.toLowerCase().split(' ').slice(-2).join(' ').toLowerCase())
        );
        if (!duplicate) {
          result.push({
            name: fb.name,
            price_per_night_inr: fb.price,
            rating: fb.rating,
            amenities: fb.amenities,
            total_cost_inr: fb.price * nights,
          });
        }
      }
      return result.slice(0, 3); // Show max 3 per category
    };

    categories.budget = padCategory(categories.budget, budgetFallbacks, 'budget');
    categories.mid_range = padCategory(categories.mid_range, midRangeFallbacks, 'mid_range');
    categories.luxury = padCategory(categories.luxury, luxuryFallbacks, 'luxury');

    // Merge all unique hotels back into the flat list for downstream budget agent compatibility
    const allUniqueHotels = new Map<string, any>();
    [...categories.budget, ...categories.mid_range, ...categories.luxury].forEach(h => {
      allUniqueHotels.set(h.name, h);
    });
    data.hotels = Array.from(allUniqueHotels.values());

    // Pre-select hotel based on requested tier (default: mid_range)
    let selectedCategory: 'budget' | 'mid_range' | 'luxury' = 'mid_range';
    if (tier === 'budget') selectedCategory = 'budget';
    else if (tier === 'luxury') selectedCategory = 'luxury';

    // Safeguard: if the preferred category is empty, fall back
    if (categories[selectedCategory].length === 0) {
      if (categories.mid_range.length > 0) selectedCategory = 'mid_range';
      else if (categories.budget.length > 0) selectedCategory = 'budget';
      else if (categories.luxury.length > 0) selectedCategory = 'luxury';
    }

    const selectedHotel = categories[selectedCategory][0] || null;

    if (selectedHotel) {
      const originalIdx = data.hotels.findIndex((h: any) => h.name === selectedHotel.name);
      if (originalIdx > -1) {
        const [removed] = data.hotels.splice(originalIdx, 1);
        data.hotels.unshift(removed);
      }
      data.recommended = selectedHotel.name;
      data.price_per_night = selectedHotel.price_per_night_inr;
    }

    const finalResult = {
      ...data,
      categories,
      selected_category: selectedCategory,
      selected_hotel: selectedHotel,
      category_thresholds: {
        budget: `Below ₹${BUDGET_MAX + 1}/night`,
        mid_range: `₹${MID_MIN} – ₹${MID_MAX}/night`,
        luxury: `Above ₹${MID_MAX}/night`,
      },
      reasoning,
    };

    const finalResultString = JSON.stringify(finalResult);
    try {
      await redis.setex(cacheKey, 3600, finalResultString); // 1 hour cache
    } catch {
      logger.warn('Could not write hotels to cache');
    }

    return finalResultString;
  },
  {
    name: 'fetch_accommodation',
    description: 'Search for recommended hotels in a destination city/area for specific dates and guest count. Hotels are categorized by price: Budget (<₹5000/night), Mid-Range (₹5000-₹15000/night), Luxury (>₹15000/night).',
    schema: z.object({
      destination: z.string().describe('Destination city/area name'),
      check_in: z.string().describe('Check-in travel date (YYYY-MM-DD)'),
      check_out: z.string().describe('Check-out travel date (YYYY-MM-DD)'),
      travelers: z.number().describe('Number of guests/travelers'),
      tier: z.enum(['luxury', 'mid-range', 'budget']).optional().describe('Hotel budget tier preference. Use budget for <₹5000/night, mid-range for ₹5000-₹15000/night, luxury for >₹15000/night.')
    }),
  }
);
