// Weather MCP Server — wraps OpenMeteo (100% free, no API key needed!) 
// and optionally OpenWeatherMap (requires a key in .env).
// Bypasses OpenWeatherMap and falls back dynamically to OpenMeteo if no key is supplied.

import { withRetry } from '../utils/retry';

interface WeatherForecast {
  date: string;
  condition: string;
  temp_high_c: number;
  temp_low_c: number;
  rain_mm: number;
}

// Convert OpenMeteo WMO weather codes to human-readable strings
const interpretWeatherCode = (code: number): string => {
  if (code === 0) return 'Clear Sky';
  if (code <= 2) return 'Partly Cloudy';
  if (code <= 45) return 'Foggy';
  if (code <= 55) return 'Drizzle';
  if (code <= 65) return 'Rainy';
  if (code <= 77) return 'Snowy';
  if (code <= 82) return 'Showers';
  return 'Thunderstorm';
};

export async function getWeatherForecast(
  destination: string,
  start_date: string,
  end_date: string
): Promise<{ forecast: WeatherForecast[] }> {
  return withRetry(async () => {
    const apiKey = process.env.OPENWEATHER_API_KEY;

    // 1. If OpenWeatherMap API key is provided, use it
    if (apiKey && !apiKey.includes('REPLACE_WITH')) {
      // Step A: Geocode via OpenWeatherMap Direct Geocoding API
      const geoUrl = `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(destination)}&limit=1&appid=${apiKey}`;
      const geoRes = await fetch(geoUrl);
      const geoData: any = await geoRes.json();

      if (!geoData || geoData.length === 0) {
        throw new Error(`Destination '${destination}' not found in OpenWeatherMap geocoding`);
      }

      const { lat, lon } = geoData[0];

      // Step B: Fetch 5-day / 3-hour forecast
      const weatherUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
      const weatherRes = await fetch(weatherUrl);
      const weatherData: any = await weatherRes.json();

      if (!weatherData.list) {
        throw new Error(`Failed to retrieve forecast from OpenWeatherMap: ${weatherData.message}`);
      }

      // Group 3-hour chunks into clean daily summaries
      const dailyMap = new Map<string, { temps: number[]; conditions: string[]; rain: number }>();

      weatherData.list.forEach((item: any) => {
        const dateObj = new Date(item.dt * 1000);
        const dateStr = dateObj.toISOString().split('T')[0];

        // Filter and aggregate only target dates
        if (dateStr >= start_date && dateStr <= end_date) {
          if (!dailyMap.has(dateStr)) {
            dailyMap.set(dateStr, { temps: [], conditions: [], rain: 0 });
          }
          const daily = dailyMap.get(dateStr)!;
          daily.temps.push(item.main.temp);
          daily.conditions.push(item.weather[0]?.main || 'Clear');
          if (item.rain?.['3h']) {
            daily.rain += item.rain['3h'];
          }
        }
      });

      const forecast: WeatherForecast[] = [];
      dailyMap.forEach((val, date) => {
        const temp_high_c = Math.max(...val.temps);
        const temp_low_c = Math.min(...val.temps);

        // Pick most common condition
        const counts: Record<string, number> = {};
        let maxCount = 0;
        let dominantCond = 'Clear';
        val.conditions.forEach((cond) => {
          counts[cond] = (counts[cond] || 0) + 1;
          if (counts[cond] > maxCount) {
            maxCount = counts[cond];
            dominantCond = cond;
          }
        });

        forecast.push({
          date,
          condition: dominantCond,
          temp_high_c: Math.round(temp_high_c),
          temp_low_c: Math.round(temp_low_c),
          rain_mm: Math.round(val.rain * 10) / 10,
        });
      });

      return { forecast };
    }

    // 2. Default: Fallback to the 100% free keyless OpenMeteo API
    // Step A: Geocode the destination name
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1`;
    const geoRes = await fetch(geoUrl);
    const geoData: any = await geoRes.json();

    if (!geoData.results?.length) {
      throw new Error(`Destination '${destination}' not found in geocoding`);
    }

    const { latitude, longitude } = geoData.results[0];

    // Step B: Fetch weather forecast
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&start_date=${start_date}&end_date=${end_date}&timezone=auto`;
    const weatherRes = await fetch(weatherUrl);
    const weatherData: any = await weatherRes.json();

    const forecast: WeatherForecast[] = weatherData.daily.time.map(
      (date: string, i: number) => ({
        date,
        condition: interpretWeatherCode(weatherData.daily.weathercode[i]),
        temp_high_c: weatherData.daily.temperature_2m_max[i],
        temp_low_c: weatherData.daily.temperature_2m_min[i],
        rain_mm: weatherData.daily.precipitation_sum[i],
      })
    );

    return { forecast };
  });
}
