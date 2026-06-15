import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-ai-navigator-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ai-navigator-panel.component.html',
  styleUrl: './ai-navigator-panel.component.scss'
})
export class AiNavigatorPanelComponent {
  readonly suggestions = input<string[]>([
    'What should I fix first?',
    'Show critical dependencies.',
    'Which services are risky?',
    'Predict future architecture issues.',
    'What changed over time?'
  ]);

  readonly activeCommand = input<string | null>(null);
  readonly navigatorResponse = input<string>('I am your AI Navigator. Ask about structure, risk, dependencies, or future debt.');
  readonly commandTriggered = output<string>();

  runSuggestion(command: string): void {
    this.commandTriggered.emit(command);
  }
}
