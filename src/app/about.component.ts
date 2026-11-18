import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [RouterLink],
  template: `
    <h1>About Eventboard</h1>
    <p class="lead">Eventboard is a simple place to publish an event, fill its seats, and see exactly who is coming.</p>

    <h2>How it works</h2>
    <ol class="steps">
      <li><b>Create an account.</b> Pick a username. That’s the name hosts see on their guest list.</li>
      <li><b>Publish or find an event.</b> Hosts add photos, a place, a time and a number of seats. Guests browse and search.</li>
      <li><b>Join and follow.</b> One tap on <i>Join event</i> takes a seat. Follow a host to be notified when they publish again.</li>
    </ol>

    <div class="two">
      <div class="panel">
        <h2>For hosts</h2>
        <ul>
          <li>Set the seat limit. When the last seat goes, joining closes automatically.</li>
          <li>Open your event to see the guest list, with the time each person joined.</li>
          <li>Edit details, swap photos or raise the seat count at any time.</li>
          <li>You’re notified when someone joins or follows you.</li>
        </ul>
      </div>
      <div class="panel">
        <h2>For guests</h2>
        <ul>
          <li>Search by title or place.</li>
          <li>Follow hosts you like and use <i>From people I follow</i> on the events page.</li>
          <li>Leave an event whenever plans change, and the seat goes back.</li>
          <li>Check Notifications for new events from your friends.</li>
        </ul>
      </div>
    </div>

    <h2>Questions</h2>
    <details><summary>Does it cost anything?</summary><p>No. Publishing, joining and following are free.</p></details>
    <details><summary>Who can see the guest list?</summary><p>Only the host of the event. Other guests see how many seats are taken, not who took them.</p></details>
    <details><summary>Can I join without an account?</summary><p>You can browse without one. Joining, publishing and following need a username so hosts know who is coming.</p></details>
    <details><summary>How do I stop getting notifications from someone?</summary><p>Open their profile and press <i>Following</i> to unfollow.</p></details>

    <p class="cta">Still stuck? <a routerLink="/contact" class="btn primary">Contact us</a></p>
  `,
  styles: [`
    .lead { font-size: 1.25rem; max-width: 55ch; }
    h2 { margin-top: 2rem; }
    .steps { max-width: 62ch; padding-left: 1.25rem; } .steps li { margin: .75rem 0; }
    .two { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; margin-top: 1rem; }
    .two h2 { margin-top: 0; } .two ul { padding-left: 1.1rem; margin: 0; } .two li { margin: .4rem 0; }
    details { background: var(--surface); border: 2px solid var(--line); border-radius: 10px; padding: .75rem 1rem; margin: .5rem 0; max-width: 62ch; }
    summary { cursor: pointer; font-weight: 600; } details p { margin: .5rem 0 0; }
    .cta { margin-top: 2rem; }
  `],
})
export class AboutComponent {}
