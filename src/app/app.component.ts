import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { WeatherWidgetComponent } from './weather-widget/weather-widget.component';
import { WeatherService } from './weather.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [WeatherWidgetComponent, CommonModule, ReactiveFormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  weatherData: any;
  widgetData: any; // To store the mapped data for the widget
  searchQuery: string = '';
  errorMessage: string = '';
  locationName: string = '';
  locationCountry: string = '';
  searchControl = new FormControl(''); // FormControl for search input
  suggestions: any[] = [];
  isLoading: boolean = false;

  constructor(private weatherService: WeatherService) {}

  ngOnInit(): void {
    this.getCurrentLocationWeather();

    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => {
          if (query && query.length > 2) {
            // Start Suggesting after more than 2 chars entered
            return this.weatherService.searchLocations(query);
          } else {
            return of([]); // Return empty array if query is too short
          }
        })
      )
      .subscribe((results) => {
        this.suggestions = results; // Update suggestions array
      });
  }

  getCurrentLocationWeather(): void {
    this.isLoading = true;
    this.weatherService.getCurrentLocation().subscribe({
      next: (coords) => {
        this.locationName = coords.city;
        this.locationCountry = coords.country;
        this.fetchWeather(coords.lat, coords.lon);
        this.searchControl.setValue(''); // Clear search input
        this.suggestions = []; // Clear suggestions
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = err;
        this.isLoading = false;
      },
    });
  }

  fetchWeather(lat: number, lon: number): void {
    this.isLoading = true;
    this.weatherService.fetchWeatherData(lat, lon).subscribe({
      next: (data) => {
        this.weatherData = data;
        this.widgetData = this.mapToWidgetData(
          this.locationName,
          this.locationCountry,
          data
        );
        this.errorMessage = '';
        this.isLoading = false;
        // console.log('widget Data:', JSON.stringify(this.widgetData));
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = err.message;
        this.isLoading = false;
      },
    });
  }

  searchLocationWeather(): void {
    if (!this.searchQuery) return;
    this.weatherService.searchLocation(this.searchQuery).subscribe({
      next: (coords) => {
        this.locationName = coords.city;
        this.locationCountry = coords.country;
        this.fetchWeather(coords.lat, coords.lon);
        this.searchControl.setValue(''); // Clear search input
        this.suggestions = []; // Clear suggestions
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = err.message;
      },
    });
  }

  selectLocation(suggestion: any): void {
    const lat = suggestion.lat;
    const lon = suggestion.lon;
    this.locationName = suggestion.display_name.split(',')[0];
    this.locationCountry = suggestion.display_name.split(',').pop().trim();
    this.fetchWeather(lat, lon);
    this.suggestions = []; // Clear suggestions
    this.searchControl.setValue(''); // Clear search input
  }

  private mapToWidgetData(
    name: string,
    country: string,
    weatherData: any
  ): any {
    const isDay = weatherData.current.isDay === 1;
    const weatherDetails = this.weatherService.getWeatherDetailsAndIcon(
      weatherData.current.weatherCode,
      isDay
    );

    // will extract the forecast data for next six days
    const startIndex = 1;
    const endIndex = 7;
    const forecastDates = weatherData.daily.time.slice(startIndex, endIndex);
    const forecastWeatherCodes = weatherData.daily.weatherCode.slice(
      startIndex,
      endIndex
    );
    const forecastTempMax = weatherData.daily.temperature2mMax.slice(
      startIndex,
      endIndex
    );
    const forecastTempMin = weatherData.daily.temperature2mMin.slice(
      startIndex,
      endIndex
    );

    const forecast = forecastDates.map((date: string, index: number) => {
      const forecastDetails = this.weatherService.getWeatherDetailsAndIcon(
        forecastWeatherCodes[index],
        true
      );
      return {
        date: new Date(date).toISOString().split('T')[0],
        iconPath: forecastDetails.iconPath,
        tempMax: forecastTempMax[index],
        tempMin: forecastTempMin[index],
      };
    });

    const windSpeedKmH = weatherData.current.windSpeed10m;
    const windInfo = this.weatherService.getWindInfo(
      windSpeedKmH,
      weatherData.current.windDirection10m
    );

    return {
      name: name,
      sys: {
        country: country,
        sunrise: new Date(weatherData.daily.sunrise[0]).getTime() / 1000,
        sunset: new Date(weatherData.daily.sunset[0]).getTime() / 1000,
      },
      main: {
        temp: weatherData.current.temperature2m,
        feels_like: weatherData.current.apparentTemperature,
        humidity: weatherData.current.relativeHumidity2m,
        temp_max: weatherData.daily.temperature2mMax[0],
        temp_min: weatherData.daily.temperature2mMin[0],
        tempFeelsLike_max: weatherData.daily.apparentTemperatureMax[0],
        tempFeelsLike_min: weatherData.daily.apparentTemperatureMin[0],
      },
      wind: {
        speed: windSpeedKmH.toFixed(1),
        info: windInfo,
      },
      weather: [
        {
          id: weatherData.current.weatherCode,
          main: this.weatherService.getWeatherMain(
            weatherData.current.weatherCode
          ),
          description: weatherDetails.description,
          iconPath: weatherDetails.iconPath,
          backgroundImage: weatherDetails.backgroundImage,
          textColor: weatherDetails.textColor,
          visibility: weatherData.current.visibility / 1000,
          aqi: weatherData.current.aqi,
        },
      ],
      rain: {
        current: weatherData.daily.precipitationSum[0],
        currentProbability: weatherData.daily.precipitationProbabilityMax[0],
      },
      uvIndex: weatherData.daily.uvIndexMax[0],
      forecast: forecast,
    };
  }
}
