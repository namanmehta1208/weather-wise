export interface WeatherResponse {
  current: {
    cloud_cover: number;
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    is_day: number;
    precipitation: number;
    rain: number;
    showers: number;
    snowfall: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    apparent_temperature_max: number[];
    apparent_temperature_min: number[];
    sunrise: string[];
    sunset: string[];
    uv_index_max: number[];
    precipitation_sum: number[];
    rain_sum: number[];
    showers_sum: number[];
    snowfall_sum: number[];
    precipitation_probability_max: number[];
  };
  hourly: {
    time: string[];
    visibility: number[];
  };
  utc_offset_seconds: number;
}

export interface AirQualityResponse {
  hourly: {
    time: string[];
    pm2_5: number[];
  };
}
