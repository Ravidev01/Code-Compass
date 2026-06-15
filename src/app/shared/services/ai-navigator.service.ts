import { Injectable } from '@angular/core';
import { NavigatorResponse, RepositoryAnalysis } from '../models/repository-analysis.model';
import { RepositoryWorkspaceData } from '../models/repository-workspace.model';

@Injectable({ providedIn: 'root' })
export class AiNavigatorService {
  generateIntroduction(analysis: RepositoryAnalysis, city: RepositoryWorkspaceData): NavigatorResponse {
    const tone = analysis.riskLevel === 'Critical' ? 'warning' : 'informative';
    const healthDescriptor =
      analysis.health > 80
        ? 'strong'
        : analysis.health > 60
          ? 'stable'
          : analysis.health > 40
            ? 'under pressure'
            : 'critical';

    const message =
      `I am your AI Navigator, an expert software architect. ` +
      `I analyzed ${analysis.services.length} services and ${analysis.dependencies.length} dependency relationships. ` +
      `Repository health is currently ${analysis.health}% and trending ${healthDescriptor}. ` +
      `Ask me what to fix first, where dependency risk is concentrated, or what may break next.`;

    return {
      message,
      tone,
      actions: [],
      workspaceFacts: [
        `Services: ${analysis.services.length}`,
        `Languages: ${analysis.languages.join(', ')}`,
        `Commits: ${analysis.commits}`,
        `Contributors: ${analysis.contributors}`
      ]
    };
  }

  respondToQuery(query: string, analysis: RepositoryAnalysis, city: RepositoryWorkspaceData): NavigatorResponse {
    const normalized = query.toLowerCase();

    // Analyze query intent
    if (normalized.includes('architecture') || normalized.includes('system')) {
      return this.explainArchitecture(analysis, city);
    }

    if (normalized.includes('risk') || normalized.includes('health') || normalized.includes('problem')) {
      return this.identifyRisks(analysis, city);
    }

    if (normalized.includes('depend') || normalized.includes('connection') || normalized.includes('critical dependencies')) {
      return this.explainDependencies(analysis, city);
    }

    if (normalized.includes('fix') || normalized.includes('improve') || normalized.includes('refactor')) {
      return this.recommendActions(analysis, city);
    }

    if (normalized.includes('complex') || normalized.includes('difficult') || normalized.includes('complicated')) {
      return this.explainComplexity(analysis, city);
    }

    if (normalized.includes('ghost') || normalized.includes('dead') || normalized.includes('deprecated')) {
      return this.identifyGhostTowns(city);
    }

    if (normalized.includes('future') || normalized.includes('predict') || normalized.includes('next')) {
      return this.predictFutureRisks(analysis, city);
    }

    if (normalized.includes('changed') || normalized.includes('history') || normalized.includes('time')) {
      return this.summarizeEvolution(analysis, city);
    }

    return this.provideOverview(analysis, city);
  }

  private explainArchitecture(analysis: RepositoryAnalysis, city: RepositoryWorkspaceData): NavigatorResponse {
    const criticalServices = city.districts.filter((d) => d.criticality > 80);
    const criticalNames = criticalServices.map((d) => d.name).join(', ');

    const message =
      `Your architecture is service-oriented with ${city.districts.length} primary services and ${city.roads.length} dependency links. ` +
      `Critical services include ${criticalNames || 'none above threshold'}. ` +
      `The repository currently spans ${analysis.languages.length} languages, which increases coordination overhead but supports specialization.`;

    const serviceIds = criticalServices.map((d) => d.id);

    return {
      message,
      tone: 'informative',
      actions: [
        {
          type: 'highlight-services',
          serviceIds
        }
      ],
      workspaceFacts: [
        `Critical Services: ${criticalNames || 'None'}`,
        `Total Services: ${city.districts.length}`,
        `Dependency Links: ${city.roads.length}`,
        `Languages in Use: ${analysis.languages.join(', ')}`
      ]
    };
  }

  private identifyRisks(analysis: RepositoryAnalysis, city: RepositoryWorkspaceData): NavigatorResponse {
    const unhealthyDistricts = city.districts.filter((d) => d.health < 60);
    const complexDistricts = city.districts.filter((d) => d.complexity > 75);
    const highCriticalityRisks = city.districts.filter((d) => d.criticality > 80 && d.health < 70);

    const riskFactors = [];
    if (unhealthyDistricts.length > 0) {
      riskFactors.push(`${unhealthyDistricts.length} services show declining health (technical debt pressure)`);
    }
    if (complexDistricts.length > 0) {
      riskFactors.push(`${complexDistricts.length} services exceed safe complexity levels`);
    }
    if (analysis.metrics.circularDependencies > 0) {
      riskFactors.push(`${analysis.metrics.circularDependencies} circular dependencies increase propagation risk`);
    }

    const message =
      `I identified the highest architecture risks:\n\n` +
      riskFactors.map((f) => `• ${f}`).join('\n') +
      `\n\nOur overall risk level is **${analysis.riskLevel}**. ` +
      `If unresolved, repository health could decline from ${analysis.health}% to ${Math.max(20, analysis.health - 30)}%.`;

    const serviceIds = [...unhealthyDistricts, ...highCriticalityRisks].map((d) => d.id);

    return {
      message,
      tone: 'warning',
      actions: [
        {
          type: 'highlight-services',
          serviceIds
        }
      ],
      workspaceFacts: analysis.issues_found
    };
  }

  private explainDependencies(analysis: RepositoryAnalysis, city: RepositoryWorkspaceData): NavigatorResponse {
    const topDeps = city.topDependencies.slice(0, 3);
    const depDescriptions = topDeps.map((d) => `**${d.from}** heavily relies on **${d.to}** (${d.calls} calls)`).join('\n• ');

    const message =
      `Dependency analysis shows these critical paths:\n\n` +
      `• ${depDescriptions}\n\n` +
      `Heavy dependency traffic along these paths creates broad blast-radius risk. ` +
      `There are ${analysis.metrics.circularDependencies} circular dependencies that should be reduced. ` +
      `Prioritize decoupling and explicit contracts on the busiest edges.`;

    return {
      message,
      tone: 'informative',
      actions: [
        {
          type: 'show-dependencies'
        }
      ],
      workspaceFacts: [
        `Total Dependencies: ${city.roads.length}`,
        `High Traffic Dependencies: ${city.roads.filter((r) => r.traffic === 'High').length}`,
        `Circular Dependencies: ${analysis.metrics.circularDependencies}`
      ]
    };
  }

  private recommendActions(analysis: RepositoryAnalysis, city: RepositoryWorkspaceData): NavigatorResponse {
    const worstDistrict = city.districts.reduce((prev, curr) =>
      curr.health + curr.criticality / 100 < prev.health + prev.criticality / 100 ? curr : prev
    );

    const message =
      `Recommended refactoring priorities:\n\n` +
      `**1. Priority Fix: ${worstDistrict.name}**\n` +
      `This service has the highest weighted risk and broadest impact.\n\n` +
      `**2. Testing Initiative**\n` +
      `Average test coverage is ${analysis.metrics.avgTestCoverage}%. Increase coverage in high-risk services first.\n\n` +
      `**3. Reduce Coupling**\n` +
      `Break up circular dependencies to prevent cascading failures.\n\n` +
      `**4. Complexity Reduction**\n` +
      `${analysis.metrics.complexServices} services are overcomplicated. Refactor and simplify.\n\n` +
      `If these improvements land, repository health could reach ${Math.min(95, analysis.health + 25)}%.`;

    return {
      message,
      tone: 'celebratory',
      actions: [
        {
          type: 'focus-service',
          serviceIds: [worstDistrict.id]
        }
      ],
      workspaceFacts: analysis.recommendations
    };
  }

  private explainComplexity(analysis: RepositoryAnalysis, city: RepositoryWorkspaceData): NavigatorResponse {
    const complexDistricts = city.districts.filter((d) => d.complexity > 75).sort((a, b) => b.complexity - a.complexity);
    const complexNames = complexDistricts.slice(0, 3).map((d) => d.name).join(', ');

    const message =
      `Architecture complexity is concentrated in: ${complexNames || 'none'}. ` +
      `${complexDistricts.length} services exceed 75% complexity, which increases lead time and regression risk. ` +
      `Refactoring strategy: split responsibilities, remove hidden coupling, and improve module boundaries.`;

    const serviceIds = complexDistricts.map((d) => d.id);

    return {
      message,
      tone: 'analytical',
      actions: [
        {
          type: 'highlight-services',
          serviceIds
        }
      ],
      workspaceFacts: [
        `Highly Complex Services: ${complexDistricts.length}`,
        `Avg Complexity: ${Math.round(city.districts.reduce((sum, d) => sum + d.complexity, 0) / city.districts.length)}%`,
        `Avg Maintainability: ${Math.round(analysis.metrics.debtRisk)}%`
      ]
    };
  }

  private identifyGhostTowns(city: RepositoryWorkspaceData): NavigatorResponse {
    const lowActivityDistricts = city.districts.filter((d) => d.dependents < 2 && d.health < 60);
    const ghostNames = lowActivityDistricts.map((d) => d.name).join(', ') || 'None currently';

    const message =
      `**Deprecated Services Detected**\n\n` +
      `Low-activity services with weak ownership: ${ghostNames}.\n\n` +
      `Why this matters:\n` +
      `• Dead code accumulates\n` +
      `• Change intent is unclear\n` +
      `• Maintenance cost grows over time\n\n` +
      `Decide whether to restore ownership, refactor, or retire each service.`;

    const serviceIds = lowActivityDistricts.map((d) => d.id);

    return {
      message,
      tone: 'analytical',
      actions: [
        {
          type: 'highlight-services',
          serviceIds
        }
      ],
      workspaceFacts: [`Deprecated Services: ${lowActivityDistricts.length}`, `Total Services: ${city.districts.length}`]
    };
  }

  private predictFutureRisks(analysis: RepositoryAnalysis, city: RepositoryWorkspaceData): NavigatorResponse {
    const risky = city.districts.filter((d) => d.health < 60 || d.criticality > 75).sort((a, b) => b.criticality - a.criticality).slice(0, 3);
    const names = risky.map((d) => d.name).join(', ') || 'No immediate hotspots';

    return {
      message:
        `Future risk forecast points to: ${names}. ` +
        `If dependency coupling and debt continue at the current pace, expect increased regression frequency over the next two release cycles. ` +
        `Mitigation: prioritize contract tests, dependency pruning, and staged refactors in these services.`,
      tone: 'warning',
      actions: [
        {
          type: 'highlight-services',
          serviceIds: risky.map((d) => d.id)
        }
      ],
      workspaceFacts: [
        `Current Risk Level: ${analysis.riskLevel}`,
        `Debt Risk Index: ${analysis.metrics.debtRisk}%`,
        `Circular Dependencies: ${analysis.metrics.circularDependencies}`
      ]
    };
  }

  private summarizeEvolution(analysis: RepositoryAnalysis, city: RepositoryWorkspaceData): NavigatorResponse {
    return {
      message:
        `Repository evolution summary: ${analysis.commits} commits by ${analysis.contributors} contributors across ${analysis.services.length} services. ` +
        `Current architecture health is ${analysis.health}% with ${analysis.metrics.circularDependencies} circular dependencies still active. ` +
        `The strongest improvements usually come from reducing cross-service coupling in critical paths first.`,
      tone: 'informative',
      actions: [],
      workspaceFacts: [
        `Repository Health: ${analysis.health}%`,
        `Commits: ${analysis.commits}`,
        `Contributors: ${analysis.contributors}`
      ]
    };
  }

  private provideOverview(analysis: RepositoryAnalysis, city: RepositoryWorkspaceData): NavigatorResponse {
    const healthTrend = analysis.health > 70 ? '📈 improving' : analysis.health > 50 ? '➡️ stable' : '📉 declining';

    const message =
      `Repository status is **${healthTrend}**. ` +
      `Overall health: ${analysis.health}%.\n\n` +
      `Quick stats:\n` +
      `• **${city.districts.length} Services**\n` +
      `• **${city.roads.length} Dependency Links**\n` +
      `• **${analysis.contributors} Contributors**\n` +
      `• **${analysis.commits} Commits**\n\n` +
      `Ask me about architecture, dependency risks, technical debt, or refactoring priorities.`;

    return {
      message,
      tone: 'informative',
      actions: [],
      workspaceFacts: [
        `Overall Health: ${analysis.health}%`,
        `Risk Level: ${analysis.riskLevel}`,
        `Avg Test Coverage: ${analysis.metrics.avgTestCoverage}%`
      ]
    };
  }
}
