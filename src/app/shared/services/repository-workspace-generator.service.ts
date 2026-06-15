import { Injectable } from '@angular/core';
import { RepositoryWorkspaceData, ServiceNode, DependencyLink } from '../models/repository-workspace.model';
import { RepositoryAnalysis, RepositoryService } from '../models/repository-analysis.model';

@Injectable({ providedIn: 'root' })
export class RepositoryWorkspaceGeneratorService {
  generateWorkspaceData(analysis: RepositoryAnalysis): RepositoryWorkspaceData {
    const districts = this.generateDistricts(analysis.services, analysis);
    const roads = this.generateRoads(analysis.dependencies, districts);

    return {
      cityName: 'CodeCompass',
      tagline: `Navigate repository evolution across ${analysis.services.length} services and ${analysis.languages.length} languages`,
      repository: analysis.repository,
      branch: analysis.branch,
      lastAnalyzed: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      stats: {
        population: analysis.services.length,
        age: Math.max(1, Math.round(analysis.commits / 365)),
        commits: analysis.commits,
        contributors: analysis.contributors,
        files: analysis.services.reduce((sum, s) => sum + s.files, 0),
        totalLines: analysis.services.reduce((sum, s) => sum + s.linesOfCode, 0),
        languages: analysis.languages.length,
        testCoverage: analysis.metrics.avgTestCoverage,
        health: analysis.health
      },
      districts,
      roads,
      problems: {
        highDebtDistricts: districts.filter((d) => d.health < 55).length,
        abandonedFiles: 0,
        complexBuildings: districts.filter((d) => d.complexity > 75).length,
        noTestBuildings: districts.filter((d) => d.stability < 60).length
      },
      topDependencies: analysis.dependencies
        .sort((a, b) => b.trafficCount - a.trafficCount)
        .slice(0, 3)
        .map((dep) => ({
          from: dep.from,
          to: dep.to,
          calls: dep.trafficCount
        })),
      forecast: {
        withoutRefactor: Math.max(20, analysis.health - Math.floor(Math.random() * 30) - 15),
        withRefactor: Math.min(95, analysis.health + Math.floor(Math.random() * 20) + 10)
      }
    };
  }

  // Backward-compatible alias used while call sites migrate.
  generateCity(analysis: RepositoryAnalysis): RepositoryWorkspaceData {
    return this.generateWorkspaceData(analysis);
  }

  private generateDistricts(services: RepositoryService[], analysis: RepositoryAnalysis): ServiceNode[] {
    // Map service types to visualization characteristics.
    const districtTypeMap: Record<string, { icon: string; type: string }> = {
      'Auth Service': { icon: '🔐', type: 'Government' },
      'Payment Service': { icon: '💰', type: 'Commercial' },
      'User Service': { icon: '👥', type: 'Residential' },
      'API Gateway': { icon: '🚪', type: 'Infrastructure' },
      'Notification Service': { icon: '📢', type: 'Communications' },
      'Analytics Engine': { icon: '📊', type: 'Research' },
      'Cache Layer': { icon: '⚡', type: 'Utility' },
      'Search Service': { icon: '🔍', type: 'Utility' },
      'Legacy Utils': { icon: '👻', type: 'Deprecated' },
      'Shared Utils': { icon: '🛠️', type: 'Utility' }
    };

    // Generate grid positions
    const cols = 4;
    const rows = Math.ceil(services.length / cols);
    const positions = this.generateGridPositions(services.length, cols, rows);

    return services.map((service, idx) => {
      const typeInfo = districtTypeMap[service.name] ?? { icon: '🧩', type: 'Generic' };
      const position = positions[idx];

      return {
        id: service.name.toLowerCase().replace(/\s+/g, '-'),
        name: service.name,
        subtitle: service.description.substring(0, 40),
        type: typeInfo.type,
        description: service.description,
        personality: this.generatePersonality(service),
        icon: typeInfo.icon,
        health: service.health,
        files: service.files,
        linesOfCode: service.linesOfCode,
        dependencies: service.dependencies,
        dependents: service.dependents,
        traffic: service.traffic,
        stability: service.testCoverage,
        criticality: service.criticality,
        complexity: service.complexity,
        position
      };
    });
  }

  private generateRoads(dependencies: any[], districts: ServiceNode[]): DependencyLink[] {
    const districtMap = new Map(districts.map((d) => [d.name.toLowerCase().replace(/\s+/g, '-'), d]));

    return dependencies.map((dep, idx) => {
      const fromId = dep.from.toLowerCase().replace(/\s+/g, '-');
      const toId = dep.to.toLowerCase().replace(/\s+/g, '-');

      return {
        id: `road-${idx}`,
        from: fromId,
        to: toId,
        traffic: dep.risk === 'High' ? 'High' : dep.risk === 'Medium' ? 'Medium' : 'Low',
        trafficCount: dep.trafficCount
      };
    });
  }

  private generateGridPositions(
    count: number,
    cols: number,
    rows: number
  ): Array<{ x: number; y: number }> {
    const positions: Array<{ x: number; y: number }> = [];
    const colWidth = 100 / (cols + 1);
    const rowHeight = 100 / (rows + 1);

    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      positions.push({
        x: colWidth * (col + 1),
        y: rowHeight * (row + 1)
      });
    }

    return positions;
  }

  private generatePersonality(service: RepositoryService): string {
    const traits = {
      high_health: [
        'Well-maintained service with strong operational maturity',
        'Reliable module with stable ownership',
        'Consistent quality and predictable behavior',
        'Low-friction service for ongoing delivery'
      ],
      medium_health: [
        'Stable service with room for refactoring',
        'Needs maintenance to preserve quality',
        'Growing module with manageable risk',
        'Requires focused technical improvements'
      ],
      low_health: [
        'Service health is declining and needs intervention',
        'Struggling with technical debt and complexity',
        'At risk of system failure',
        'Critical intervention required'
      ],
      high_complexity: [
        'Complex implementation with high cognitive load',
        'Requires expert knowledge to navigate',
        'Dense interdependencies increase change risk',
        'Sophisticated but hard to change'
      ],
      high_criticality: [
        'Core to platform reliability',
        'Cannot function without this service',
        'Backbone of the architecture',
        'Essential to all operations'
      ],
      low_dependents: [
        'Self-sufficient and independent',
        'Does its own thing',
        'Few relying on its services',
        'Isolated module'
      ]
    };

    let personality = '';
    if (service.health >= 75) personality = traits.high_health[Math.floor(Math.random() * traits.high_health.length)];
    else if (service.health >= 60) personality = traits.medium_health[Math.floor(Math.random() * traits.medium_health.length)];
    else personality = traits.low_health[Math.floor(Math.random() * traits.low_health.length)];

    if (service.complexity > 75) personality += ' ' + traits.high_complexity[Math.floor(Math.random() * traits.high_complexity.length)];
    if (service.criticality > 80) personality += ' ' + traits.high_criticality[Math.floor(Math.random() * traits.high_criticality.length)];

    return personality;
  }
}
