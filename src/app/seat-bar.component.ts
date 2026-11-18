import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-seat-bar',
  standalone: true,
  template: `
    <div class="seatbar" [attr.aria-label]="taken + ' of ' + seats + ' seats taken'">
      @for (s of slots; track $index) { <i [class.on]="$index < taken"></i> }
    </div>`,
})
export class SeatBarComponent {
  @Input() seats = 0;
  @Input() taken = 0;
  get slots() { return Array.from({ length: Math.min(this.seats, 60) }); }
}
