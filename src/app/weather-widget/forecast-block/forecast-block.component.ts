import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-forecast-block',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './forecast-block.component.html',
  styleUrl: './forecast-block.component.scss',
})
export class ForecastBlockComponent {
  @Input() forecastData: {
    date: string;
    iconPath: string;
  } = {
    date: '',
    iconPath: '',
  };

  @Input() tempMax: string = '';
  @Input() tempMin: string = '';
}
