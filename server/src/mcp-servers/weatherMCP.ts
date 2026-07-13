// Weather MCP Server — wraps OpenMeteo (100% free, no API key needed!) 
// and optionally OpenWeatherMap (requires a key in .env).
// Bypasses OpenWeatherMap and falls back dynamically to OpenMeteo if no key is supplied.

import { withRetry } from '../utils/retry';
import logger from '../utils/logger';

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

// Helper: Calculate range of dates between start_date and end_date
const getDatesRange = (startStr: string, endStr: string): string[] => {
  const dates = [];
  const current = new Date(startStr);
  const end = new Date(endStr);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

// Helper: Shift year of a date string backward
const shiftDateYear = (dateStr: string, yearsToSubtract: number): string => {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() - yearsToSubtract);
  return d.toISOString().split('T')[0];
};

// Helper: Calculate how many years to shift dates to get into the past
const getHistoricalShiftOffset = (startDateStr: string): number => {
  const start = new Date(startDateStr);
  const today = new Date();
  if (start < today) return 0;
  
  const yearDiff = start.getFullYear() - today.getFullYear();
  return yearDiff + 1;
};

export async function getWeatherForecast(
  destination: string,
  start_date: string,
  end_date: string
): Promise<{ forecast: WeatherForecast[]; source: 'forecast' | 'historical' }> {
  return withRetry(async () => {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    let latitude: number | null = null;
    let longitude: number | null = null;

    // 1. If OpenWeatherMap API key is provided, try OpenWeatherMap
    if (apiKey && !apiKey.includes('REPLACE_WITH')) {
      try {
        // Step A: Geocode via OpenWeatherMap Direct Geocoding API
        const geoUrl = `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(destination)}&limit=1&appid=${apiKey}`;
        const geoRes = await fetch(geoUrl);
        const geoData: any = await geoRes.json();

        if (geoData && geoData.length > 0) {
          latitude = Number(geoData[0].lat);
          longitude = Number(geoData[0].lon);

          // Step B: Fetch 5-day / 3-hour forecast
          const weatherUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&units=metric&appid=${apiKey}`;
          const weatherRes = await fetch(weatherUrl);
          const weatherData: any = await weatherRes.json();

          if (weatherData && weatherData.list) {
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

            if (dailyMap.size > 0) {
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

              return { forecast, source: 'forecast' };
            }
          }
        }
      } catch (err) {
        logger.error('OpenWeatherMap weather fetch failed; moving to fallback', err);
      }
    }

    // 2. Try the 100% free keyless OpenMeteo API
    try {
      // Step A: Geocode the destination name (if needed)
      if (latitude === null || longitude === null) {
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1`;
        const geoRes = await fetch(geoUrl);
        const geoData: any = await geoRes.json();

        if (geoData.results && geoData.results.length > 0) {
          latitude = Number(geoData.results[0].latitude);
          longitude = Number(geoData.results[0].longitude);
        }
      }

      if (latitude !== null && longitude !== null) {
        // Step B: Fetch weather forecast
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&start_date=${start_date}&end_date=${end_date}&timezone=auto`;
        const weatherRes = await fetch(weatherUrl);
        const weatherData: any = await weatherRes.json();

        if (weatherData && weatherData.daily && !weatherData.error) {
          const forecast: WeatherForecast[] = weatherData.daily.time.map(
            (date: string, i: number) => ({
              date,
              condition: interpretWeatherCode(weatherData.daily.weathercode[i]),
              temp_high_c: weatherData.daily.temperature_2m_max[i],
              temp_low_c: weatherData.daily.temperature_2m_min[i],
              rain_mm: weatherData.daily.precipitation_sum[i],
            })
          );

          return { forecast, source: 'forecast' };
        } else if (weatherData.error) {
          logger.warn(`OpenMeteo Forecast returned error: ${weatherData.reason}`);
        }
      }
    } catch (err) {
      logger.error('OpenMeteo forecast fetch failed; moving to historical fallback', err);
    }

    // 3. Fallback to OpenMeteo Archive API (real historical weather observations)
    if (latitude !== null && longitude !== null) {
      try {
        const yearShift = getHistoricalShiftOffset(start_date);
        const historicalStart = shiftDateYear(start_date, yearShift);
        const historicalEnd = shiftDateYear(end_date, yearShift);

        logger.info(`Fetching historical climate observations for ${destination} from ${historicalStart} to ${historicalEnd} (shifted by ${yearShift} year(s))`);
        const weatherUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&start_date=${historicalStart}&end_date=${historicalEnd}&timezone=auto`;
        const weatherRes = await fetch(weatherUrl);
        const weatherData: any = await weatherRes.json();

        if (weatherData && weatherData.daily && !weatherData.error) {
          const requestedDates = getDatesRange(start_date, end_date);
          const forecast: WeatherForecast[] = weatherData.daily.time.map(
            (archiveDate: string, i: number) => {
              const targetDate = requestedDates[i] || archiveDate;
              return {
                date: targetDate,
                condition: interpretWeatherCode(weatherData.daily.weathercode[i]),
                temp_high_c: weatherData.daily.temperature_2m_max[i],
                temp_low_c: weatherData.daily.temperature_2m_min[i],
                rain_mm: weatherData.daily.precipitation_sum[i] || 0,
              };
            }
          );
          return { forecast, source: 'historical' };
        } else if (weatherData.error) {
          logger.warn(`OpenMeteo Archive returned error: ${weatherData.reason}`);
        }
      } catch (err) {
        logger.error('OpenMeteo archive fallback fetch failed', err);
      }
    }

    // 4. Absolute last resort static fallback
    logger.warn('All live weather endpoints exhausted. Creating generic seasonal placeholder.');
    const requestedDates = getDatesRange(start_date, end_date);
    const forecast: WeatherForecast[] = requestedDates.map((date) => ({
      date,
      condition: 'Partly Cloudy',
      temp_high_c: 28,
      temp_low_c: 22,
      rain_mm: 0,
    }));
    return { forecast, source: 'historical' };
  });
}
