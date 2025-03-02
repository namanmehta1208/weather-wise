import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'temperature',
  standalone: true,
})
export class TemperaturePipe implements PipeTransform {
  transform(value: number, unit: 'C' | 'F'): string {
    if (unit === 'F') {
      const fahrenheit = (value * 9) / 5 + 32;
      return fahrenheit.toFixed(1) + '°F';
    } else {
      return value.toFixed(1) + '°C';
    }
  }
}
