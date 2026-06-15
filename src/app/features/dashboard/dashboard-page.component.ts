import { CommonModule, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal, effect } from '@angular/core';
import { Router } from '@angular/router';
import { ArchitectureMapComponent } from '../architecture-map/architecture-map.component';
import { AiNavigatorPanelComponent } from '../ai-navigator-panel/ai-navigator-panel.component';
import { MOCK_REPOSITORY_WORKSPACE_DATA } from '../../shared/data/mock-repository-workspace.data';
import { EvolutionTimelineStore, SimulationAction } from '../../shared/store/evolution-timeline.store';
import { TrafficLevel } from '../../shared/models/repository-workspace.model';
import { RepositoryContextService } from '../../shared/services/repository-context.service';
import { AiNavigatorService } from '../../shared/services/ai-navigator.service';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, DecimalPipe, ArchitectureMapComponent, AiNavigatorPanelComponent],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss'
})
export class DashboardPageComponent {
  readonly timelineStore = inject(EvolutionTimelineStore);
  readonly context = inject(RepositoryContextService);
  readonly navigatorAI = inject(AiNavigatorService);
  readonly router = inject(Router);

  readonly workspaceData = signal(MOCK_REPOSITORY_WORKSPACE_DATA);
  readonly selectedDistrictId = signal('auth');
  readonly showIntroduction = signal(true);
  readonly drawerOpen = signal(false);
  readonly navigatorPanelOpen = signal(false);
  readonly visualizationMode = signal<'graph'>('graph');
  readonly pulseMode = signal(true);
  readonly mapReactionToken = signal(0);
  readonly mapReactionType = signal<SimulationAction | null>(null);
  readonly simulationBusy = signal(false);
  readonly feedBusy = signal(true);
  readonly activeNavigatorCommand = signal<string | null>(null);
  readonly navigatorResponse = signal('You are connected to AI Navigator. I can explain architecture, dependency flow, risks, and likely future debt.');
  readonly commandDistrictIds = signal<string[]>([]);
  readonly commandRoadIds = signal<string[]>([]);
  readonly navigatorSuggestions = ['What should I fix first?', 'Show critical dependencies.', 'Which services are risky?', 'Predict future architecture issues.', 'What changed over time?'];

  constructor() {
    this.timelineStore.startEventStream();
    setTimeout(() => this.feedBusy.set(false), 550);

    // Load city from context if available
    effect(() => {
      const contextWorkspace = this.context.currentWorkspaceData();
      const contextAnalysis = this.context.currentAnalysis();
      
      if (contextWorkspace) {
        this.workspaceData.set(contextWorkspace);
        this.selectedDistrictId.set(contextWorkspace.districts[0]?.id ?? 'auth');
        
        // Show AI Navigator introduction.
        if (contextAnalysis && this.showIntroduction()) {
          const intro = this.navigatorAI.generateIntroduction(contextAnalysis, contextWorkspace);
          this.navigatorResponse.set(intro.message);
          this.showIntroduction.set(false);
        }
      } else {
        // Redirect to input if no repository workspace data.
        this.router.navigate(['/']);
      }
    });
  }

  readonly selectedDistrict = computed(() => {
    return this.workspaceData().districts.find((district) => district.id === this.selectedDistrictId()) ?? this.workspaceData().districts[0];
  });

  readonly selectedDistrictRoads = computed(() => {
    const id = this.selectedDistrictId();
    return this.workspaceData().roads.filter((road) => road.from === id || road.to === id);
  });

  readonly connectedDistricts = computed(() => {
    const id = this.selectedDistrictId();
    const ids = new Set<string>();
    this.selectedDistrictRoads().forEach((road) => {
      ids.add(road.from === id ? road.to : road.from);
    });
    return this.workspaceData().districts.filter((district) => ids.has(district.id));
  });

  readonly districtRecommendations = computed(() => {
    const district = this.selectedDistrict();
    const list: string[] = [];

    if (district.health < 55) {
      list.push('Stabilize this service with defensive retries and health checks.');
    }
    if (district.dependencies > 14) {
      list.push('Reduce dependency fan-out by extracting bounded utility modules.');
    }
    if (district.traffic === 'High') {
      list.push('Add queue buffering to smooth peak traffic bursts.');
    }
    if (district.criticality > 35) {
      list.push('Prioritize an incident runbook and stronger observability alerts.');
    }
    if (list.length === 0) {
      list.push('Service is stable. Continue incremental refactors and contract tests.');
    }

    return list;
  });

  readonly currentYear = this.timelineStore.selectedYear;
  readonly currentSnapshot = this.timelineStore.currentSnapshot;
  readonly eventFeed = this.timelineStore.latestEvents;
  readonly yearToken = this.timelineStore.transitionToken;
  readonly simulationButtons: Array<{ label: string; action: SimulationAction }> = [
    { label: 'Push Code', action: 'push-code' },
    { label: 'Add Technical Debt', action: 'add-technical-debt' },
    { label: 'Add Tests', action: 'add-tests' },
    { label: 'Refactor Service', action: 'refactor-service' }
  ];

  selectDistrict(districtId: string): void {
    this.selectedDistrictId.set(districtId);
    if (!this.navigatorPanelOpen()) {
      this.drawerOpen.set(true);
    }
  }

  setYear(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.timelineStore.setYear(Number(target.value));
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  toggleNavigatorPanel(): void {
    const willOpen = !this.navigatorPanelOpen();
    this.navigatorPanelOpen.set(willOpen);
    if (willOpen) {
      this.drawerOpen.set(false);
    }
  }

  closeNavigatorPanel(): void {
    this.navigatorPanelOpen.set(false);
  }

  openNavigatorPanel(): void {
    this.navigatorPanelOpen.set(true);
    this.drawerOpen.set(false);
  }

  setVisualizationMode(mode: 'graph'): void {
    this.visualizationMode.set(mode);
  }

  analyzeNewRepo(): void {
    this.context.reset();
    this.router.navigate(['/']);
  }

  togglePulseMode(): void {
    this.pulseMode.update((value) => !value);
  }

  runSimulation(action: SimulationAction): void {
    if (this.simulationBusy()) {
      return;
    }

    this.simulationBusy.set(true);
    this.mapReactionType.set(action);
    this.mapReactionToken.update((value) => value + 1);

    const selectedId = this.selectedDistrictId();
    const deltaTraffic: Record<SimulationAction, TrafficLevel> = {
      'push-code': 'Medium',
      'add-technical-debt': 'High',
      'add-tests': 'Low',
      'refactor-service': 'Low'
    };

    const impactText: Record<SimulationAction, string> = {
      'push-code': 'Deployment burst detected. Dependency traffic is rebalancing.',
      'add-technical-debt': 'Debt added. Risk and traffic pressure increased.',
      'add-tests': 'Test coverage increased. Risk pressure dropped.',
      'refactor-service': 'Refactor complete. Repository health is trending upward.'
    };

    this.timelineStore.applySimulation(action);

    this.workspaceData.update((workspace) => ({
      ...workspace,
      stats: {
        ...workspace.stats,
        health: this.timelineStore.currentSnapshot().health
      },
      roads: workspace.roads.map((road) => {
        if (road.from !== selectedId && road.to !== selectedId) {
          return road;
        }

        const countDelta = action === 'add-technical-debt' ? 85 : action === 'push-code' ? 58 : action === 'add-tests' ? -34 : -64;
        return {
          ...road,
          traffic: deltaTraffic[action],
          trafficCount: Math.max(80, road.trafficCount + countDelta)
        };
      }),
      districts: workspace.districts.map((district) => {
        if (district.id !== selectedId) {
          return district;
        }

        const healthDelta = action === 'add-technical-debt' ? -6 : action === 'push-code' ? 2 : action === 'add-tests' ? 4 : 7;
        const critDelta = action === 'add-technical-debt' ? 7 : action === 'push-code' ? 1 : action === 'add-tests' ? -4 : -7;
        return {
          ...district,
          health: this.clamp(district.health + healthDelta, 20, 99),
          criticality: this.clamp(district.criticality + critDelta, 5, 98),
          traffic: deltaTraffic[action]
        };
      })
    }));

    this.timelineStore.addEvent({
      type: action === 'add-technical-debt' ? 'high-risk-alert' : action === 'refactor-service' ? 'refactor-completed' : action === 'add-tests' ? 'new-district' : 'traffic-congestion',
      title:
        action === 'push-code'
          ? 'Push Code'
          : action === 'add-technical-debt'
            ? 'Technical Debt Added'
            : action === 'add-tests'
              ? 'Tests Added'
              : 'Refactor Service',
      detail: impactText[action],
      district: this.selectedDistrict().name,
      severity: action === 'add-technical-debt' ? 'High' : action === 'push-code' ? 'Medium' : 'Low',
      timestamp: 'just now'
    });

    this.navigatorResponse.set(impactText[action]);

    setTimeout(() => {
      this.simulationBusy.set(false);
      this.mapReactionType.set(null);
    }, 760);
  }

  handleNavigatorCommand(command: string): void {
    const analysis = this.context.currentAnalysis();
    const workspace = this.workspaceData();

    if (!analysis) {
      this.navigatorResponse.set('I need repository analysis to answer that question. Analyze a repository first.');
      return;
    }

    // Use AI Navigator for architecture-focused responses.
    const navigatorResponse = this.navigatorAI.respondToQuery(command, analysis, workspace);
    this.navigatorResponse.set(navigatorResponse.message);
    this.activeNavigatorCommand.set(command);

    // Apply actions
    for (const action of navigatorResponse.actions) {
      const serviceIds = action.serviceIds ?? action.districtIds;
      const dependencyIds = action.dependencyIds ?? action.roadIds;

      if (action.type === 'highlight-services' && serviceIds) {
        this.commandDistrictIds.set(serviceIds);
        const roadIds = workspace.roads
          .filter((road) => serviceIds.includes(road.from) || serviceIds.includes(road.to))
          .map((road) => road.id);
        this.commandRoadIds.set(roadIds);
        this.selectedDistrictId.set(serviceIds[0]);
      } else if (action.type === 'focus-service' && serviceIds) {
        this.selectedDistrictId.set(serviceIds[0]);
        if (!this.navigatorPanelOpen()) {
          this.drawerOpen.set(true);
        }
      } else if (action.type === 'show-dependencies') {
        // Highlight high-traffic dependency paths.
        this.commandRoadIds.set(
          dependencyIds && dependencyIds.length > 0
            ? dependencyIds
            : workspace.roads.filter((r) => r.traffic === 'High').map((r) => r.id)
        );
      }
    }
  }

  eventSeverityClass(severity: 'High' | 'Medium' | 'Low'): string {
    if (severity === 'High') {
      return 'text-red-300';
    }
    if (severity === 'Medium') {
      return 'text-amber-300';
    }
    return 'text-emerald-300';
  }

  districtNameById(id: string): string {
    return this.workspaceData().districts.find((district) => district.id === id)?.name ?? id;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  readonly navItems = [
    'Repository Overview',
    'Architecture Map',
    'Evolution Timeline',
    'Dependency Analysis',
    'AI Navigator',
    'Future Insights',
    'Reports',
    'Achievements'
  ];

  readonly navIcons = ['pi pi-home', 'pi pi-map', 'pi pi-building', 'pi pi-sitemap', 'pi pi-comments', 'pi pi-chart-line', 'pi pi-file', 'pi pi-star'];
}
