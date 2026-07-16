/**
 * Prompts for Activity Agent
 */

export function getActivityFallbackPrompt(
  destination: string,
  attractionCount: number,
  restaurantCount: number
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

export function getActivityFilteringPrompt(destination: string, attractionCount: number): string {
  return `You are TripPlanner's Sightseeing & Activities Specialist. You are given a list of tourist attractions in or near ${destination} retrieved from a directory API.
Your task is to create a high-quality, curated, and MIXED list of exactly ${attractionCount} tourist attractions for a trip to ${destination}.

Follow these strict rules:
1. STRICT FILTERING (Tourist Places Only): Keep ONLY genuine sightseeing/tourist spots (famous landmarks, viewpoints, parks, historical structures, monuments, temples, museums, scenic spots). Strictly filter out and remove any municipal offices, administrative utilities, government buildings, transit hubs (bus stands, taxi ranks, train stations), local shops, or ordinary facilities.
2. ALL MIXED: Create a blended/mixed list. Take the best genuine tourist attractions from the API features list, and MIX them with the most famous, must-visit tourist landmark recommendations for ${destination} that might be missing from the API. The final list should feel premium and comprehensive.
3. RATING & POPULARITY SORT: Assign realistic ratings (1.0 to 5.0) and review counts (user_ratings_total) based on real-world fame. You must sort the final list in descending order from highest rating (most rated/popular) to lowest rating (least rated/popular).
4. TARGET COUNT: You must return exactly ${attractionCount} attractions. If there are not enough genuine tourist spots in the API list, supplement them with famous sightseeing spots. If there are too many, prune them to keep only the ${attractionCount} highest-rated tourist places.

Format your reply ONLY as a valid JSON object of this structure:
{
  "attractions": [
    {
      "name": "Attraction Name",
      "vicinity": "Address or area, ${destination}",
      "rating": 4.9,
      "user_ratings_total": 45000,
      "description": "Short description (max 12 words) explaining why this is a great tourist spot",
      "place_id": "original_place_id_or_llm_recommendation_id",
      "types": ["tourism.attraction"],
      "source_type": "geoapify_places" // set to "geoapify_places" if it came from the API, or "llm_recommendation" if you added/supplemented it
    }
  ]
}`;
}
