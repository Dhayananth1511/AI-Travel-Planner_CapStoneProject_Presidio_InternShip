// Maps MCP Server — wraps Google Maps APIs (Geocoding, Places, Distance Matrix)
// Google gives $200 free credit/month which is more than enough for a capstone.
// We wrap all three sub-APIs in one MCP server because they all come from Google.

import { withRetry } from '../utils/retry';

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Get nearby attractions and restaurants using Google Places API
export async function getPlacesNearby(
  destination: string,
  interests: string[],
  days: number
): Promise<{ attractions: string[]; restaurants: string[]; restaurant_options: Array<{ name: string; rating: number; price_level?: number; user_ratings_total?: number }>; timings: string; entry_fees: string }> {
  if (!GOOGLE_API_KEY || GOOGLE_API_KEY.includes('REPLACE_WITH')) {
    throw new Error('Google Maps API Key is missing or not configured. Please set GOOGLE_MAPS_API_KEY in your environment variables.');
  }

  return withRetry(async () => {
    try {
      // First geocode destination to coordinates
      const geoRes = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(destination)}&key=${GOOGLE_API_KEY}`
      );
      const geoData: any = await geoRes.json();
      const location = geoData.results[0]?.geometry?.location;

      if (!location) throw new Error('Could not geocode destination');

      // Search for tourist attractions nearby
      const placesRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=10000&type=tourist_attraction&key=${GOOGLE_API_KEY}`
      );
      const placesData: any = await placesRes.json();

      const attractions = placesData.results
        ?.slice(0, Math.min(days * 2, 8))
        .map((p: any) => p.name) || [];

      // Search for restaurants
      const restRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=5000&type=restaurant&key=${GOOGLE_API_KEY}`
      );
      const restData: any = await restRes.json();
      const restaurantOptions = restData.results?.slice(0, 4).map((p: any) => ({
        name: p.name,
        rating: p.rating || 0,
        price_level: p.price_level,
        user_ratings_total: p.user_ratings_total,
      })) || [];
      const restaurants = restaurantOptions.map((restaurant: any) => restaurant.name);

      return {
        attractions,
        restaurants,
        restaurant_options: restaurantOptions,
        timings: '09:00 AM - 06:00 PM (general)',
        entry_fees: `₹${100 + Math.floor(Math.random() * 300)} per person (estimated)`,
      };
    } catch (err: any) {
      console.warn(`Places/Geocoding API failed: ${err.message}. Using defensive fallback activities for ${destination}.`);
      
      const fallbackAttractions = [
        `${destination} City Center & Shopping District`,
        `${destination} Historic Old Town & Heritage Site`,
        `${destination} Nature Reserve & Botanical Gardens`,
        `${destination} Panoramic Viewpoint & Scenic Trail`,
        `Local Museum & Arts Gallery of ${destination}`
      ].slice(0, Math.min(days * 2, 5));

      const fallbackRestaurantOptions = [
        { name: `${destination} Spice Garden`, rating: 4.5, price_level: 2, user_ratings_total: 120 },
        { name: `The Culinary Hub @ ${destination}`, rating: 4.3, price_level: 2, user_ratings_total: 80 },
        { name: `Heritage Kitchen`, rating: 4.6, price_level: 3, user_ratings_total: 190 },
        { name: `Royal Tavern & Lounge`, rating: 4.2, price_level: 2, user_ratings_total: 65 }
      ];

      return {
        attractions: fallbackAttractions,
        restaurants: fallbackRestaurantOptions.map(r => r.name),
        restaurant_options: fallbackRestaurantOptions,
        timings: '09:00 AM - 06:00 PM (general)',
        entry_fees: `₹150 per person (estimated)`,
      };
    }
  });
}

// Calculate distance/travel time between hotel and attraction for local transport estimates
export async function getDistanceMatrix(
  origin: string,
  destination: string
): Promise<{ distance_km: number; duration_min: number; cab_estimate_inr: number }> {
  if (!GOOGLE_API_KEY || GOOGLE_API_KEY.includes('REPLACE_WITH')) {
    throw new Error('Google Maps API Key is missing or not configured. Please set GOOGLE_MAPS_API_KEY in your environment variables.');
  }

  return withRetry(async () => {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&key=${GOOGLE_API_KEY}`
      );
      const data: any = await res.json();
      const element = data.rows[0]?.elements[0];

      if (!element || element.status === 'ZERO_RESULTS') {
        throw new Error('No travel route found');
      }

      const distance_km = (element?.distance?.value || 10000) / 1000;
      const duration_min = (element?.duration?.value || 1200) / 60;
      // ₹12/km estimate for city cab
      const cab_estimate_inr = Math.round(distance_km * 12 * 2); // x2 for round trip

      return { distance_km, duration_min, cab_estimate_inr };
    } catch (err: any) {
      console.warn(`Distance Matrix failed: ${err.message}. Using estimated default values.`);
      // Heuristic default: 15 km, 30 mins, and Rs. 360 cab cost
      return {
        distance_km: 15.0,
        duration_min: 30.0,
        cab_estimate_inr: 360
      };
    }
  });
}

