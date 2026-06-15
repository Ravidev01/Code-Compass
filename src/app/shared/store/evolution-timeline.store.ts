import { Injectable, computed, signal } from '@angular/core';

export type CityEventType = 'traffic-congestion' | 'new-district' | 'ghost-town' | 'high-risk-alert' | 'refactor-completed';

export interface CityEvent {
  id: number;
  type: CityEventType;
  title: string;
  detail: string;
  district: string;
  severity: 'High' | 'Medium' | 'Low';
  timestamp: string;
}

export interface CityYearSnapshot {
  year: number;
  health: number;
  traffic: number;
  risk: number;
  forecast: number;
}

export type SimulationAction = 'push-code' | 'add-technical-debt' | 'add-tests' | 'refactor-service';

@Injectable({ providedIn: 'root' })
export class EvolutionTimelineStore {
  private nextEventId = 100;
  private eventTimer: ReturnType<typeof setInterval> | null = null;

  readonly selectedYear = signal(2026);
  readonly transitionToken = signal(0);

  readonly timeline = signal<Record<number, CityYearSnapshot>>({
    2022: { year: 2022, health: 52, traffic: 78, risk: 72, forecast: 49 },
    2023: { year: 2023, health: 57, traffic: 74, risk: 67, forecast: 54 },
    2024: { year: 2024, health: 62, traffic: 69, risk: 61, forecast: 61 },
    2025: { year: 2025, health: 69, traffic: 61, risk: 54, forecast: 70 },
    2026: { year: 2026, health: 74, traffic: 58, risk: 49, forecast: 76 },
    2027: { year: 2027, health: 77, traffic: 54, risk: 43, forecast: 81 },
    2028: { year: 2028, health: 81, traffic: 49, risk: 37, forecast: 85 },
    2029: { year: 2029, health: 84, traffic: 45, risk: 32, forecast: 89 },
    2030: { year: 2030, health: 87, traffic: 39, risk: 26, forecast: 92 }
  });

  readonly events = signal<CityEvent[]>([
    {
      id: 1,
      type: 'high-risk-alert',
      title: 'High Risk Alert',
      detail: 'Legacy Utils exceeded debt threshold after dependency surge.',
      district: 'Legacy Utils',
      severity: 'High',
      timestamp: '1 min ago'
    },
    {
      id: 2,
      type: 'traffic-congestion',
      title: 'Dependency Traffic Spike',
      detail: 'Auth Service to Payment Service route is experiencing heavy call volume.',
      district: 'Auth Service',
      severity: 'Medium',
      timestamp: '5 min ago'
    },
    {
      id: 3,
      type: 'refactor-completed',
      title: 'Refactor Completed',
      detail: 'Shared Utils cleanup reduced circular dependency pressure.',
      district: 'Shared Utils',
      severity: 'Low',
      timestamp: '14 min ago'
    }
  ]);

  readonly latestEvents = computed(() => this.events().slice(0, 8));

  readonly currentSnapshot = computed(() => {
    const year = this.selectedYear();
    return this.timeline()[year] ?? this.timeline()[2026];
  });

  setYear(year: number): void {
    this.selectedYear.set(year);
    this.transitionToken.update((value) => value + 1);
  }

  applySimulation(action: SimulationAction): CityYearSnapshot {
    const year = this.selectedYear();
    const current = this.currentSnapshot();

    const deltaMap: Record<SimulationAction, Partial<CityYearSnapshot>> = {
      'push-code': { health: 2, traffic: 4, risk: -1, forecast: 2 },
      'add-technical-debt': { health: -5, traffic: 6, risk: 8, forecast: -7 },
      'add-tests': { health: 5, traffic: -2, risk: -6, forecast: 7 },
      'refactor-service': { health: 6, traffic: -5, risk: -9, forecast: 9 }
    };

    const delta = deltaMap[action];
    const next: CityYearSnapshot = {
      year,
      health: this.clamp((delta.health ?? 0) + current.health, 10, 99),
      traffic: this.clamp((delta.traffic ?? 0) + current.traffic, 10, 99),
      risk: this.clamp((delta.risk ?? 0) + current.risk, 5, 99),
      forecast: this.clamp((delta.forecast ?? 0) + current.forecast, 10, 99)
    };

    this.timeline.update((all) => ({
      ...all,
      [year]: next
    }));
    this.transitionToken.update((value) => value + 1);

    return next;
  }

  addEvent(event: Omit<CityEvent, 'id'>): void {
    const next: CityEvent = {
      ...event,
      id: this.nextEventId++
    };
    this.events.update((items) => [next, ...items].slice(0, 30));
  }

  startEventStream(): void {
    if (this.eventTimer) {
      return;
    }

    this.eventTimer = setInterval(() => {
      const pool: Omit<CityEvent, 'id'>[] = [
        {
          type: 'traffic-congestion',
          title: 'Dependency Traffic Spike',
          detail: 'Payment Service ingress latency is climbing above baseline.',
          district: 'Payment Service',
          severity: 'Medium',
          timestamp: 'just now'
        },
        {
          type: 'new-district',
          title: 'Service Added',
          detail: 'A new Analytics service module was provisioned from repository growth.',
          district: 'Analytics Service',
          severity: 'Low',
          timestamp: 'just now'
        },
        {
          type: 'ghost-town',
          title: 'Deprecated Service',
          detail: 'Old APIs activity dropped to near zero in the last interval.',
          district: 'Old APIs',
          severity: 'Medium',
          timestamp: 'just now'
        },
        {
          type: 'high-risk-alert',
          title: 'High Risk Alert',
          detail: 'Auth Service error burst detected across dependent services.',
          district: 'Auth Service',
          severity: 'High',
          timestamp: 'just now'
        },
        {
          type: 'refactor-completed',
          title: 'Refactor Completed',
          detail: 'Frontend bundle partitioning reduced cross-zone dependency drag.',
          district: 'Frontend',
          severity: 'Low',
          timestamp: 'just now'
        }
      ];

      const random = pool[Math.floor(Math.random() * pool.length)];
      this.addEvent(random);
    }, 9000);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
