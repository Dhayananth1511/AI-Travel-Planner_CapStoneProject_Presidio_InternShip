/**
 * Prompts for Activity Agent
 */

export function getActivityFallbackPrompt(
  destination: string,
  attractionCount: number,
  restaurantCount: number,
  interests: string[]
): string {
  return `Return ONLY valid JSON for destination-aware travel recommendations when live provider data is unavailable.
Schema:
{
  "attractions": [{ "name": "string", "vicinity": "string", "rating": 4.2, "description": "1-sentence short description describing the place (max 12 words)" }],
  "restaurants": [{ "name": "string", "rating": 4.3, "price_level": 2 }]
}
Rules:
- Recommendations must fit ${destination}.
- Use exactly ${attractionCount} attractions and ${restaurantCount} restaurants.
- These are recommendations, not confirmed live listings.
- Avoid generic placeholders like City Center, Old Town, Culinary Hub.
- Keep names plausible and destination-specific.
- Align attractions with traveler interests: ${interests.join(', ') || 'general sightseeing'}.
- Suggest ONLY scenic, historic, cultural, recreational, or sightseeing tourist attractions. Do NOT suggest municipal utilities, government offices, emergency or transit hubs (e.g. police stations, fire stations, post offices, bus stands, or train stations).`;
}

export function getActivityEnrichmentPrompt(destination: string, names: string[]): string {
  return `For each tourist spot listed below in key-value structure, write a very short, appealing 1-sentence description (max 12 words) describing what it is or why people visit it.
Destination: ${destination}
Spots:
${names.map((n: string) => `- ${n}`).join('\n')}

Format your reply ONLY as a valid JSON object mapping spot name to description:
{
  "Spot Name 1": "Description here",
  "Spot Name 2": "Description here"
}`;
}

export function getActivityReasoningPrompt(destination: string, interests: string[], days: number): string {
  return `You are TripPlanner's Local Sightseeing & Activities Specialist Agent. 
Analyze the suggested places in ${destination} for a ${days}-day trip matching traveler interests: ${interests.join(', ')}.
Briefly explain if these matches fit traveler preferences, and highlight 2-3 key landmark recommendations in 2-3 sentences. Keep it short.`;
}

export function getActivityFilteringPrompt(destination: string, attractionCount: number, interests: string[]): string {
  return `You are TripPlanner's Sightseeing & Activities Specialist. You are given a raw list of tourist attractions in or near ${destination} retrieved from a live geo-directory API.
Your task is to create a high-quality, curated, and MIXED list of exactly ${attractionCount} tourist attractions for a trip to ${destination}.

Follow these strict rules:
1. STRICT FILTERING (Tourist Places Only): Keep ONLY genuine sightseeing/tourist spots (famous landmarks, viewpoints, parks, historical structures, monuments, temples, museums, scenic spots). Stricly remove any municipal offices, administrative utilities, government buildings, transit hubs (bus stands, taxi ranks, train stations), local shops, or ordinary facilities (e.g. post offices, municipal municipal corporations, public works).
2. INTEREST ALIGNMENT: Prioritize attractions that align with traveler interests: ${interests.join(', ') || 'general sightseeing'}. For instance, if 'nature sightseeing' is requested, prioritize waterfalls, peaks, scenic viewpoints, valleys, parks, and botanical gardens. Avoid municipal, industrial, commercial or administrative structures; focus purely on the natural and cultural beauty of the destination.
3. STRUCTURAL EXCLUSIONS: Absolutely exclude roads, highways, municipal water tanks, power grids, government departments, and ordinary residential blocks.
4. MANDATORY MIX: You MUST produce a blended list. Take the best genuine tourist attractions from the provided API list, then SUPPLEMENT it with the most famous, must-visit, iconic landmarks for ${destination} that are NOT already in the API list. The final list MUST contain both API-sourced and AI-recommended entries.
5. RATING & POPULARITY SORT: Assign realistic ratings (1.0 to 5.0) and review counts based on real-world fame. Sort the final list in descending order by rating.
6. TARGET COUNT: Return exactly ${attractionCount} attractions. Supplement with famous sightseeing spots if the API list is insufficient.
7. SOURCE TAGGING (CRITICAL): You MUST correctly set the "source_type" field for every single attraction:
   - If the attraction came FROM the provided API list: set source_type to exactly "geoapify_places"
   - If you ADDED or SUPPLEMENTED it yourself (not in the API list): set source_type to exactly "llm_recommendation"
   This is critical for the UI badge display. Do not set all entries to the same source_type.

Format your reply ONLY as a valid JSON object of this structure (no markdown, no explanation, no code block):
{
  "attractions": [
    {
      "name": "Attraction Name",
      "vicinity": "Address or area, ${destination}",
      "rating": 4.9,
      "user_ratings_total": 45000,
      "description": "Short 1-sentence description (max 12 words) of why this is a great tourist spot",
      "place_id": "original_place_id_if_from_api_or_llm-rec-NNN",
      "types": ["tourism.attraction"],
      "source_type": "geoapify_places"
    }
  ]
}`;
}
