import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { OPEN_METEO_WEATHER_CODE_TO_CONDITION } from "./openMeteoWeatherCodes";

/**
 * Responsibility:
 * - Provide a simple, auditable tool to fetch current weather for a location.
 *
 * Notes:
 * - Data sources are Open-Meteo (geocoding + forecast).
 */

const OPEN_METEO_GEOCODING_ENDPOINT =
  "https://geocoding-api.open-meteo.com/v1/search";
const OPEN_METEO_FORECAST_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_RESULT_COUNT = 1;

interface GeocodingResponse {
  results: {
    latitude: number;
    longitude: number;
    name: string;
  }[];
}
interface WeatherResponse {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    wind_gusts_10m: number;
    weather_code: number;
  };
}

export const weatherTool = createTool({
  id: "get-weather",
  description: "Get current weather for a location",
  inputSchema: z.object({
    location: z.string().describe("City name"),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    feelsLike: z.number(),
    humidity: z.number(),
    windSpeed: z.number(),
    windGust: z.number(),
    conditions: z.string(),
    location: z.string(),
  }),
  execute: async (inputData) => {
    return await getWeather(inputData.location);
  },
});

const getWeather = async (location: string) => {
  const geocodingUrl = new URL(OPEN_METEO_GEOCODING_ENDPOINT);
  geocodingUrl.searchParams.set("name", location);
  geocodingUrl.searchParams.set("count", String(GEOCODING_RESULT_COUNT));

  const geocodingResponse = await fetch(geocodingUrl);
  const geocodingData = (await geocodingResponse.json()) as GeocodingResponse;

  if (!geocodingData.results?.[0]) {
    throw new Error(`Location '${location}' not found`);
  }

  const { latitude, longitude, name } = geocodingData.results[0];

  const weatherUrl = new URL(OPEN_METEO_FORECAST_ENDPOINT);
  weatherUrl.searchParams.set("latitude", String(latitude));
  weatherUrl.searchParams.set("longitude", String(longitude));
  weatherUrl.searchParams.set(
    "current",
    [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "wind_speed_10m",
      "wind_gusts_10m",
      "weather_code",
    ].join(","),
  );

  const weatherResponse = await fetch(weatherUrl);
  const weatherResponseBody = (await weatherResponse.json()) as WeatherResponse;

  return {
    temperature: weatherResponseBody.current.temperature_2m,
    feelsLike: weatherResponseBody.current.apparent_temperature,
    humidity: weatherResponseBody.current.relative_humidity_2m,
    windSpeed: weatherResponseBody.current.wind_speed_10m,
    windGust: weatherResponseBody.current.wind_gusts_10m,
    conditions: getWeatherCondition(weatherResponseBody.current.weather_code),
    location: name,
  };
};

function getWeatherCondition(code: number): string {
  return OPEN_METEO_WEATHER_CODE_TO_CONDITION[code] ?? "Unknown";
}
