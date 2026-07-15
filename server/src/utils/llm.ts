import { ChatGroq } from '@langchain/groq';

export interface CreateChatModelOptions {
  temperature?: number;
  tools?: any[];
  maxTokens?: number;
}

/**
 * Centrally creates a ChatGroq LLM instance with automatic run-time fallbacks.
 * This cycles through multiple Groq API keys/accounts to bypass rate limit blocks.
 */
export function createChatModel(options: CreateChatModelOptions = {}) {
  const modelName = 'llama-3.1-8b-instant';
  const { temperature = 0.1, tools = [], ...rest } = options;

  // Load all fallback keys, keeping only configured ones
  const keys = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4,
    process.env.GROQ_API_KEY_5,
  ].filter(Boolean);

  // Fallback to default key if no extra keys are present in env
  if (keys.length === 0) {
    keys.push(process.env.GROQ_API_KEY || '');
  }

  // Map each key to a tool-bound / configured ChatGroq instance
  const modelInstances = keys.map(apiKey => {
    let modelInstance = new ChatGroq({
      apiKey,
      model: modelName,
      temperature,
      ...rest,
    });
    
    if (tools.length > 0) {
      modelInstance = modelInstance.bindTools(tools) as any;
    }
    
    return modelInstance;
  });

  const [primary, ...fallbacks] = modelInstances;

  const baseChain = fallbacks.length > 0 ? primary.withFallbacks(fallbacks) : primary;

  // Pre-filter response to strip '<think>' blocks from reasoning models for consistency
  return baseChain.pipe((output: any) => {
    if (output && typeof output === 'object' && 'content' in output) {
      if (typeof output.content === 'string') {
        output.content = output.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      }
    }
    return output;
  });
}
