import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-details-block',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './details-block.component.html',
  styleUrl: './details-block.component.scss',
})
export class DetailsBlockComponent {
  @Input() label: string = '';
  @Input() value: string | number = '';
  @Input() icon: string = '';
  @Input() moreInfo?: string = '';
}
