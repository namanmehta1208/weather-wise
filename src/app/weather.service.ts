import { Injectable } from '@angular/core';
import { Observable, from, throwError, of } from 'rxjs';
import { forkJoin } from 'rxjs';
import { fetchWeatherApi } from 'openmeteo';
import { HttpClient } from '@angular/common/http';
import { catchError, map, switchMap } from 'rxjs/operators';
import { WeatherResponse, AirQualityResponse } from './weather.interfaces';

@Injectable({
  providedIn: 'root',
})
export class WeatherService {
  constructor(private http: HttpClient) {}

  getCurrentLocation(): Observable<{
    lat: number;
    lon: number;
    city: string;
    country: string;
  }> {
    // First, wrap the browser geolocation in an Observable.
    return new Observable<{ lat: number; lon: number }>((observer) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            observer.next({
              lat: position.coords.latitude,
              lon: position.coords.longitude,
            });
            observer.complete();
          },
          (error) => {
            observer.error('Unable to retrieve your location.');
          }
        );
      } else {
        observer.error('Geolocation is not supported by this browser.');
      }
    }).pipe(
      // Once we have coordinates, call the Nominatim reverse API.
      switchMap(({ lat, lon }) =>
        this.http
          .get<any>(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
          )
          .pipe(
            map((result) => {
              const address = result.address || {};
              // Some responses may include city, town, or village.
              const city =
                address.city || address.town || address.village || '';
              const country = address.country || '';
              // console.log(
              //   `Lat ${lat}, Lon ${lon}, City: ${city}, Country: ${country}`
              // );
              return { lat, lon, city, country };
            }),
            catchError((error) => {
              console.error('Error during reverse geocoding', error);
              return of({ lat, lon, city: '', country: '' });
            })
          )
      )
    );
  }

  searchLocation(
    query: string
  ): Observable<{ lat: number; lon: number; city: string; country: string }> {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query
    )}&format=json&limit=1`;
    return this.http.get<any[]>(nominatimUrl).pipe(
      map((results) => {
        if (results && results.length > 0) {
          const result = results[0];
          const lat = Number(result.lat);
          const lon = Number(result.lon);
          // The result may contain an 'address' object; if not, fallback to parsing the display name.
          const address = result.address || {};
          const city =
            address.city ||
            address.town ||
            address.village ||
            (result.display_name ? result.display_name.split(',')[0] : '');
          const country = address.country || '';
          return { lat, lon, city, country };
        } else {
          throw new Error('No location found.');
        }
      }),
      catchError((error) => {
        console.error('Error searching location', error);
        return throwError(() => new Error('Error searching location.'));
      })
    );
  }

  searchLocations(query: string): Observable<any[]> {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query
    )}`;
    return this.http.get<any[]>(url);
  }

  fetchWeatherData(latitude: number, longitude: number): Observable<any> {
    const weatherUrl = 'https://api.open-meteo.com/v1/forecast';
    const airQualityUrl =
      'https://air-quality-api.open-meteo.com/v1/air-quality';

    const weatherParams = {
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'is_day',
        'precipitation',
        'rain',
        'showers',
        'snowfall',
        'weather_code',
        'wind_speed_10m',
        'wind_direction_10m',
        'cloud_cover',
      ].join(','),
      daily: [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'apparent_temperature_max',
        'apparent_temperature_min',
        'sunrise',
        'sunset',
        'uv_index_max',
        'precipitation_sum',
        'rain_sum',
        'showers_sum',
        'snowfall_sum',
        'precipitation_probability_max',
      ].join(','),
      hourly: ['visibility'].join(','),
      timezone: 'auto',
    };

    // Air Quality API parameters (fetch PM2.5 hourly)
    const airQualityParams = {
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      hourly: ['pm2_5'].join(','),
      timezone: 'auto',
    };

    // Using forkJoin with typed HTTP requests
    return forkJoin({
      weather: this.http.get<WeatherResponse>(weatherUrl, {
        params: weatherParams,
      }),
      airQuality: this.http.get<AirQualityResponse>(airQualityUrl, {
        params: airQualityParams,
      }),
    }).pipe(
      map(({ weather, airQuality }) => {
        const current = weather.current;
        const daily = weather.daily;
        const hourly = weather.hourly;
        const utcOffsetSeconds = weather.utc_offset_seconds;

        const currentTime = new Date(current.time);
        const currentTimeMs = currentTime.getTime();
        const hourlyTimes = hourly.time.map((t: string) =>
          new Date(t).getTime()
        );
        const visibilityIndex = this.findIndexForTime(
          hourlyTimes,
          currentTimeMs
        );
        const currentVisibility = hourly.visibility[visibilityIndex];

        // Compute current AQI from air quality data
        const airQualityTimes = airQuality.hourly.time.map((t: string) =>
          new Date(t).getTime()
        );
        const pm25Values = airQuality.hourly.pm2_5;
        const airQualityIndex = this.findIndexForTime(
          airQualityTimes,
          currentTimeMs
        );
        const currentPm25 = pm25Values[airQualityIndex];
        const aqi = this.calculateAQIFromPm25(currentPm25);

        // weatherData object with AQI added
        const weatherData = {
          current: {
            time: new Date(
              (new Date(current.time).getTime() / 1000 + utcOffsetSeconds) *
                1000
            ),
            temperature2m: current.temperature_2m,
            relativeHumidity2m: current.relative_humidity_2m,
            apparentTemperature: current.apparent_temperature,
            isDay: current.is_day,
            precipitation: current.precipitation,
            rain: current.rain,
            showers: current.showers,
            snowfall: current.snowfall,
            weatherCode: current.weather_code,
            windSpeed10m: current.wind_speed_10m,
            windDirection10m: current.wind_direction_10m,
            visibility: currentVisibility,
            aqi: aqi,
            cloudCover: current.cloud_cover,
          },
          daily: {
            time: daily.time.map((t: string) => new Date(t)),
            weatherCode: daily.weather_code,
            temperature2mMax: daily.temperature_2m_max,
            temperature2mMin: daily.temperature_2m_min,
            apparentTemperatureMax: daily.apparent_temperature_max,
            apparentTemperatureMin: daily.apparent_temperature_min,
            sunrise: daily.sunrise,
            sunset: daily.sunset,
            uvIndexMax: daily.uv_index_max,
            precipitationSum: daily.precipitation_sum,
            rainSum: daily.rain_sum,
            showersSum: daily.showers_sum,
            snowfallSum: daily.snowfall_sum,
            precipitationProbabilityMax: daily.precipitation_probability_max,
          },
        };

        return weatherData;
      })
    );
  }

  // Helper function to find the index for the current time
  private findIndexForTime(times: number[], currentTimeMs: number): number {
    const index = times.findIndex(
      (time, i) =>
        time > currentTimeMs && (i === 0 || times[i - 1] <= currentTimeMs)
    );
    return index === -1 ? times.length - 1 : index > 0 ? index - 1 : 0;
  }

  // Calculate AQI based on PM2.5 concentration using US EPA standard
  private calculateAQIFromPm25(pm25: number): number {
    if (pm25 <= 12.0) {
      return this.linearAQI(pm25, 0, 50, 0, 12.0);
    } else if (pm25 <= 35.4) {
      return this.linearAQI(pm25, 51, 100, 12.1, 35.4);
    } else if (pm25 <= 55.4) {
      return this.linearAQI(pm25, 101, 150, 35.5, 55.4);
    } else if (pm25 <= 150.4) {
      return this.linearAQI(pm25, 151, 200, 55.5, 150.4);
    } else if (pm25 <= 250.4) {
      return this.linearAQI(pm25, 201, 300, 150.5, 250.4);
    } else if (pm25 <= 350.4) {
      return this.linearAQI(pm25, 301, 400, 250.5, 350.4);
    } else if (pm25 <= 500.4) {
      return this.linearAQI(pm25, 401, 500, 350.5, 500.4);
    } else {
      return 500; // Cap at 500 for very high concentrations
    }
  }

  // Linear interpolation formula for AQI calculation
  private linearAQI(
    C: number,
    I_low: number,
    I_high: number,
    C_low: number,
    C_high: number
  ): number {
    return Math.round(
      ((I_high - I_low) / (C_high - C_low)) * (C - C_low) + I_low
    );
  }

  getWeatherMain(code: number): string {
    if (code === 0) return 'Clear';
    if (code >= 1 && code <= 3) return 'Clouds';
    if (code === 45 || code === 48) return 'Fog';
    if (code >= 51 && code <= 57) return 'Drizzle';
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'Rain';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'Snow';
    if (code === 95 || code === 96 || code === 99) return 'Thunderstorm';
    return 'Unknown';
  }

  getWeatherDetailsAndIcon(
    code: number,
    isDay: boolean,
    cloudCover: number
  ): {
    description: string;
    iconPath: string;
    backgroundImage: string;
    textColor: string;
  } {
    const descriptions: { [key: number]: string } = {
      0: 'Clear Sky',
      1: 'Mostly Clear',
      2: 'Partly Cloudy',
      3: 'Overcast',
      45: 'Fog',
      48: 'Depositing Rime Fog',
      51: 'Light Drizzle',
      53: 'Moderate Drizzle',
      55: 'Heavy Drizzle',
      56: 'Light Freezing Drizzle',
      57: 'Heavy Freezing Drizzle',
      61: 'Light Rain',
      63: 'Moderate Rain',
      65: 'Heavy Rain',
      66: 'Light Freezing Rain',
      67: 'Heavy Freezing Rain',
      71: 'Light Snow',
      73: 'Moderate Snow',
      75: 'Heavy Snow',
      77: 'Snow Grains',
      80: 'Light Rain Showers',
      81: 'Moderate Rain Showers',
      82: 'Heavy Rain Showers',
      85: 'Light Snow Showers',
      86: 'Heavy Snow Showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with Light Hail',
      99: 'Thunderstorm with Heavy Hail',
    };

    const timeOfDay = isDay ? 'day' : 'night';
    const baseIconPath = `assets/icons/${timeOfDay}`;
    const baseBackgroundPath = `assets/backgrounds/${timeOfDay}`;

    // Default values for unknown codes
    let iconCode = `${code}`;
    type BackgroundName =
      | 'clear'
      | 'mostlyClr'
      | 'cloudy'
      | 'foggy'
      | 'rainy'
      | 'snowy'
      | 'storm'
      | 'default';
    let backgroundName: BackgroundName = 'clear';
    let textColor: string;

    //adjust the theme based on the background
    const backgroundTextColors = {
      clear: { day: 'dark', night: 'light' },
      mostlyClr: { day: 'dark', night: 'light' },
      cloudy: { day: 'dark', night: 'light' },
      foggy: { day: 'dark', night: 'light' },
      rainy: { day: 'light', night: 'light' },
      snowy: { day: 'dark', night: 'light' },
      storm: { day: 'light', night: 'light' },
      default: { day: 'dark', night: 'light' },
    };

    // Map weather codes to icons and backgrounds
    switch (code) {
      case 0:
        iconCode = 'clear';
        backgroundName = 'clear';
        break;
      case 1:
      case 2:
        iconCode = 'partly-cloudy';
        backgroundName = 'mostlyClr';
        break;
      case 3:
        iconCode = 'overcast';
        backgroundName = 'cloudy';
        break;
      case 45:
      case 48:
        iconCode = 'fog';
        backgroundName = 'foggy';
        break;
      case 51:
      case 53:
      case 55:
      case 56:
      case 57:
        iconCode = 'drizzle';
        backgroundName = 'rainy';
        break;
      case 61:
      case 63:
      case 65:
      case 66:
      case 67:
      case 80:
      case 81:
      case 82:
        iconCode = 'rain';
        backgroundName = 'rainy';
        break;
      case 71:
      case 73:
      case 75:
      case 85:
      case 86:
        iconCode = 'snow';
        backgroundName = 'snowy';
        break;
      case 77:
        iconCode = 'sleet';
        backgroundName = 'snowy';
        break;
      case 95:
        iconCode = 'thunderstorms-rain';
        backgroundName = 'storm';
        break;
      case 96:
      case 99:
        iconCode = 'thunderstorms-snow';
        backgroundName = 'storm';
        break;
      default:
        iconCode = 'unknown';
        backgroundName = 'default';
    }

    textColor = backgroundTextColors[backgroundName][timeOfDay];

    const description = `${
      descriptions[code] || 'Unknown'
    }, with ${cloudCover}% cloud cover`;

    return {
      description,
      iconPath: `${baseIconPath}/${iconCode}.svg`,
      backgroundImage: `url('${baseBackgroundPath}/${backgroundName}.webp')`,
      textColor: textColor,
    };
  }

  // Wind-related methods
  private beaufortTable = {
    speed: [0, 2, 6, 12, 20, 29, 40, 51, 62, 75, 89, 103, 118],
    description: [
      'Calm',
      'Light air',
      'Light breeze',
      'Gentle breeze',
      'Moderate breeze',
      'Fresh breeze',
      'Strong breeze',
      'High wind',
      'Fresh gale',
      'Strong gale',
      'Storm, whole gale',
      'Violent storm',
      'Hurricane-force',
    ],
  };

  getWindInfo(speedKmH: number, direction: number): string {
    const index = this.beaufortTable.speed.findIndex((s) => speedKmH < s);
    const effectiveIndex =
      index === -1
        ? this.beaufortTable.speed.length - 1
        : index === 0
        ? 0
        : index - 1;
    const description = this.beaufortTable.description[effectiveIndex];
    const drct = this.getDirection(direction);
    return `${drct} - ${description}`;
  }

  getDirection(degree: number): string {
    const directions = [
      'North',
      'North-East',
      'East',
      'South-East',
      'South',
      'South-West',
      'West',
      'North-West',
    ];
    const normalizedDegree = ((degree % 360) + 360) % 360;
    const index = Math.round(normalizedDegree / 45) % 8;
    return directions[index];
  }
}
