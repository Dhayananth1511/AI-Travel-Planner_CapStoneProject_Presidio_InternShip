// Maps MCP Server — Mocks Google Maps APIs (Geocoding, Places, Distance Matrix)
// Bypassed due to Google Maps API billing limitations. 
// Uses robust LLM fallbacks and deterministic calculations instead to generate rich city details.

export interface GoogleHotelOption {
  name: string;
  price_per_night_inr: number;
  rating: number;
  amenities: string[];
  total_cost_inr: number;
  stars?: number;
  address?: string;
  description?: string;
}

export interface TransitDirectionsInfo {
  transit_summary: string;
  steps: string[];
  duration_min: number;
  distance_km: number;
  cab_estimate_inr: number;
  mode: 'transit' | 'driving' | 'walking';
}

// Get nearby attractions and restaurants - returns empty lists to trigger high-quality LLM fallbacks in activityAgent
export async function getPlacesNearby(
  destination: string,
  interests: string[],
  days: number
): Promise<{ 
  attractions: string[]; 
  restaurants: string[]; 
  restaurant_options: Array<{ name: string; rating: number; price_level?: number; user_ratings_total?: number; source_type?: string }>; 
  attraction_options: Array<{ name: string; rating: number; user_ratings_total?: number; photo_reference?: string | null; place_id?: string | null; vicinity?: string | null; types?: string[]; source_type?: string }>;
  timings: string; 
  entry_fees: string; 
  source_status?: 'google_places_live' | 'live_fetch_failed';
}> {
  return {
    attractions: [],
    restaurants: [],
    restaurant_options: [],
    attraction_options: [],
    timings: 'Unavailable from live provider',
    entry_fees: 'Unavailable from live provider',
    source_status: 'live_fetch_failed',
  };
}

// Calculate distance/travel time between hotel and attraction - returns standard estimated defaults
export async function getDistanceMatrix(
  origin: string,
  destination: string
): Promise<{ distance_km: number; duration_min: number; cab_estimate_inr: number }> {
  return {
    distance_km: 15.0,
    duration_min: 30.0,
    cab_estimate_inr: 360
  };
}

// Fetch restaurants near the selected hotel - generates realistic nearby mock dining spots
export async function getRestaurantsNearHotel(
  hotelName: string,
  destination: string
): Promise<{
  restaurants: string[];
  restaurant_options: Array<{ name: string; rating: number; price_level?: number; user_ratings_total?: number; source_type?: string }>;
}> {
  const prefix = hotelName.replace(/hotel|inn|stay|resort|palace/gi, '').trim();
  const mockNames = [
    `${prefix} Garden Restaurant`,
    `Local Punjabi Dhaba`,
    `Authentic South Indian Cafe`,
    `${destination} Spice Kitchen`,
    `Royal Delight Dining`,
    `Street Food Plaza`
  ];
  const restaurantOptions = mockNames.map((name) => ({
    name,
    rating: parseFloat((4.0 + Math.random() * 0.9).toFixed(1)),
    price_level: Math.round(1 + Math.random() * 2),
    user_ratings_total: Math.round(50 + Math.random() * 950),
    source_type: 'mock_places'
  }));

  return {
    restaurants: mockNames,
    restaurant_options: restaurantOptions
  };
}

// Search for real accommodation - returns empty to trigger LLM fallback in accommodationAgent
export async function getHotelsNearby(
  destination: string,
  nights: number
): Promise<GoogleHotelOption[]> {
  return [];
}

// Calculates step-by-step transit or driving routes - triggers smart fallback with 10.0 distance
export async function getTransitDirections(
  origin: string,
  destination: string
): Promise<TransitDirectionsInfo> {
  return {
    transit_summary: 'Cab/Auto commute',
    steps: [`Commute from ${origin} to ${destination} via local auto/cab.`],
    duration_min: 30,
    distance_km: 10.0,
    cab_estimate_inr: 250,
    mode: 'driving',
  };
}
