// Accommodation Agent — search hotels with 1-hour Redis cache.

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { ChatGroq } from '@langchain/groq';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import redis from '../config/redis';
import { searchHotels } from '../mcp-servers/bookingMCP';
import logger from '../utils/logger';

const llm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: 'llama-3.1-8b-instant',
  temperature: 0.3,
});

export const accommodationTool = tool(
  async ({ destination, check_in, check_out, travelers }) => {
    const cacheKey = `hotels:${destination}:${check_in}:${check_out}:${travelers}`;

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
      const systemPrompt = `You are VoyageFlow's Lodging & Accommodation Specialist Agent. 
Analyze the accommodation choices in ${destination} checking in on ${check_in} and out on ${check_out} for ${travelers} guests.
Briefly explain if the hotels are suitable, what amenities or lodging tiers are interesting, and safety/convenience ratings in 2-3 sentences. Keep it short.`;
      const llmRes = await llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(JSON.stringify(data)),
      ]);
      reasoning = llmRes.content.toString();
    } catch (err) {
      logger.error('Accommodation Agent reasoning analysis failed', err);
      reasoning = 'Lodgings are chosen near primary destination routes.';
    }

    const finalResult = {
      ...data,
      reasoning,
    };

    const finalResultString = JSON.stringify(finalResult);
    try {
      await redis.setex(cacheKey, 365, finalResultString);
    } catch {
      logger.warn('Could not write hotels to cache');
    }

    return finalResultString;
  },
  {
    name: 'fetch_accommodation',
    description: 'Search for recommended hotels in a destination city/area for specific dates and guest count.',
    schema: z.object({
      destination: z.string().describe('Destination city/area name'),
      check_in: z.string().describe('Check-in travel date (YYYY-MM-DD)'),
      check_out: z.string().describe('Check-out travel date (YYYY-MM-DD)'),
      travelers: z.number().describe('Number of guests/travelers'),
    }),
  }
);
