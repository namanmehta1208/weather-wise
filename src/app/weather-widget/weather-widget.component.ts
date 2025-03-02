import {
  Component,
  Input,
  AfterViewInit,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DetailsBlockComponent } from './details-block/details-block.component';
import { ForecastBlockComponent } from './forecast-block/forecast-block.component';
import { TemperaturePipe } from '../temperature.pipe';

@Component({
  selector: 'app-weather-widget',
  standalone: true,
  imports: [
    CommonModule,
    DetailsBlockComponent,
    ForecastBlockComponent,
    TemperaturePipe,
  ],
  templateUrl: './weather-widget.component.html',
  styleUrl: './weather-widget.component.scss',
})
export class WeatherWidgetComponent {
  @Input() weatherData: any;
  view: 'today' | 'forecast' = 'today';
  unit: 'C' | 'F' = 'C';

  setView(view: 'today' | 'forecast'): void {
    this.view = view;
  }

  isTodayView(): boolean {
    return this.view === 'today';
  }

  isForecastView(): boolean {
    return this.view === 'forecast';
  }

  setUnit(newUnit: 'C' | 'F') {
    this.unit = newUnit;
  }
}
