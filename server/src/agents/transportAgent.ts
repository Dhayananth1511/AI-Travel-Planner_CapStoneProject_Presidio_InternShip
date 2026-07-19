// Transport Agent — search transit options (flights, trains, buses).
// Includes real flights, multiple train classes, and bus options.
// Supports user selection of preferred transport mode.

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { getTransportOptions } from '../mcp-servers/transitMCP';
import { withRetry } from '../utils/retry';
import logger from '../utils/logger';
import { createChatModel } from '../utils/llm';
import { getTransportReasoningPrompt } from '../prompts';

const llm = createChatModel({
  temperature: 0.3,
});

export const transportTool = tool(
  async ({ origin, destination, travel_date, travelers, preferred_mode, user_query }) => {
    logger.debug('Transport tool fetching from MCP', { origin, destination, travel_date, travelers, preferred_mode, user_query });
    const data = await getTransportOptions(origin, destination, travel_date, travelers);

    // Standalone LLM Reasoning Phase
    let reasoning = '';
    try {
      const systemPrompt = getTransportReasoningPrompt(origin, destination, travelers, travel_date);
      const llmRes = await withRetry(() => llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(JSON.stringify(data)),
      ]));
      reasoning = llmRes.content.toString();
    } catch (err) {
      logger.error('Transport Agent reasoning analysis failed', err);
      reasoning = 'Transit options are scheduled and recommended based on speed and cost.';
    }

    // Determine target mode preference
    let targetMode: 'Flight' | 'Train' | 'Bus' | null = null;
    if (preferred_mode && preferred_mode !== 'none') {
      targetMode = preferred_mode as any;
    } else if (user_query) {
      const qLower = user_query.toLowerCase();
      if (/\b(?:flight|plane|fly|air|airline|flights|aviation)\b/i.test(qLower)) {
        targetMode = 'Flight';
      } else if (/\b(?:train|rail|railway|trains)\b/i.test(qLower)) {
        targetMode = 'Train';
      } else if (/\b(?:bus|coach|buses|volvo)\b/i.test(qLower)) {
        targetMode = 'Bus';
      }
    }

    // Default selected option is cheapest of targetMode, or cheapest overall
    let selectedOption = null;
    if (targetMode) {
      const modeOptions = data.options.filter((opt: any) => opt.mode === targetMode);
      if (modeOptions.length > 0) {
        selectedOption = modeOptions.reduce((cheapest: any, curr: any) =>
          curr.cost_inr < cheapest.cost_inr ? curr : cheapest, modeOptions[0]);
      }
    }

    if (!selectedOption) {
      selectedOption = data.options.reduce((cheapest: any, curr: any) =>
        curr.cost_inr < cheapest.cost_inr ? curr : cheapest, data.options[0] || null);
    }

    const finalResult = {
      ...data,
      selected_option: selectedOption,
      reasoning,
    };

    return JSON.stringify(finalResult);
  },
  {
    name: 'fetch_transport',
    description: 'Search transit and travel options (flights, trains in multiple classes, buses) from an origin city to a destination with real pricing and ratings.',
    schema: z.object({
      origin: z.string().describe('Origin city name'),
      destination: z.string().describe('Destination city name'),
      travel_date: z.string().describe('Travel departure date (YYYY-MM-DD)'),
      travelers: z.number().describe('Number of travelers'),
      preferred_mode: z.enum(['Flight', 'Train', 'Bus', 'none']).optional().describe('Filter/preference for transport mode'),
      user_query: z.string().optional().describe('The user message or query context to scan for transport choice preferences'),
    }),
  }
);
