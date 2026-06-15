import { Injectable } from '@angular/core';
import { delay, of } from 'rxjs';
import { RepositoryAnalysis, RepositoryService, ServiceDependency } from '../models/repository-analysis.model';

@Injectable({ providedIn: 'root' })
export class RepositoryAnalyzerService {
  /**
   * Mock analysis - in production, this would call GitHub API + code analysis
   */
  analyzeRepository(url: string): Promise<RepositoryAnalysis> {
    return new Promise((resolve) => {
      // Simulate network delay
      setTimeout(() => {
        const analysis = this.generateMockAnalysis(url);
        resolve(analysis);
      }, 1200);
    });
  }

  private generateMockAnalysis(url: string): RepositoryAnalysis {
    const repoMatch = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    const owner = repoMatch?.[1] ?? 'unknown';
    const repository = repoMatch?.[2]?.replace('.git', '') ?? 'repository';

    // Generate realistic mock services based on repository type
    const services = this.generateServices(repository);
    const dependencies = this.generateDependencies(services);

    const avgHealth = services.reduce((sum, s) => sum + s.health, 0) / services.length;
    const complexCount = services.filter((s) => s.complexity > 70).length;
    const circularDeps = dependencies.filter((d) => d.type === 'circular').length;

    return {
      url,
      repository,
      owner,
      branch: 'main',
      description: `${repository}: A modern software system with ${services.length} microservices and distributed architecture.`,
      services,
      dependencies,
      contributors: Math.floor(Math.random() * 40) + 5,
      commits: Math.floor(Math.random() * 5000) + 500,
      issues: Math.floor(Math.random() * 50) + 5,
      pullRequests: Math.floor(Math.random() * 30) + 3,
      stars: Math.floor(Math.random() * 3000) + 100,
      languages: ['TypeScript', 'Python', 'Go', 'JavaScript', 'SQL'],
      topics: ['microservices', 'distributed-systems', 'cloud-native'],
      health: Math.round(avgHealth),
      riskLevel: avgHealth > 75 ? 'Low' : avgHealth > 60 ? 'Medium' : avgHealth > 45 ? 'High' : 'Critical',
      issues_found: [
        `${complexCount} services with high complexity`,
        `${circularDeps} circular dependencies detected`,
        `${services.filter((s) => s.testCoverage < 60).length} services under-tested`,
        `${services.filter((s) => s.health < 50).length} services with declining health`
      ],
      recommendations: [
        'Implement automated dependency health checks',
        'Increase test coverage in core services',
        'Consider service decomposition for complex modules',
        'Establish circuit breakers for dependent services',
        'Document API contracts and breaking changes'
      ],
      metrics: {
        avgServiceHealth: Math.round(avgHealth),
        avgTestCoverage: Math.round(services.reduce((sum, s) => sum + s.testCoverage, 0) / services.length),
        complexServices: complexCount,
        debtRisk: Math.round(services.reduce((sum, s) => sum + (100 - s.maintainability), 0) / services.length),
        circularDependencies: circularDeps
      }
    };
  }

  private generateServices(repoName: string): RepositoryService[] {
    // Map common service names to realistic data
    const serviceTemplates: Record<string, Partial<RepositoryService>> = {
      'Auth Service': {
        description: 'Authentication and authorization service',
        files: 42,
        linesOfCode: 4200,
        language: 'TypeScript',
        health: 82,
        dependencies: 3,
        dependents: 12,
        traffic: 'High',
        criticality: 92,
        complexity: 65,
        testCoverage: 89,
        maintainability: 78,
        issues: 2
      },
      'Payment Service': {
        description: 'Payment processing and transaction management',
        files: 38,
        linesOfCode: 3800,
        language: 'TypeScript',
        health: 75,
        dependencies: 5,
        dependents: 8,
        traffic: 'High',
        criticality: 88,
        complexity: 78,
        testCoverage: 85,
        maintainability: 72,
        issues: 4
      },
      'User Service': {
        description: 'User profile and account management',
        files: 52,
        linesOfCode: 5200,
        language: 'TypeScript',
        health: 68,
        dependencies: 4,
        dependents: 15,
        traffic: 'Medium',
        criticality: 85,
        complexity: 72,
        testCoverage: 76,
        maintainability: 65,
        issues: 6
      },
      'API Gateway': {
        description: 'Request routing and API aggregation',
        files: 28,
        linesOfCode: 2800,
        language: 'Go',
        health: 79,
        dependencies: 6,
        dependents: 18,
        traffic: 'High',
        criticality: 95,
        complexity: 68,
        testCoverage: 82,
        maintainability: 74,
        issues: 1
      },
      'Notification Service': {
        description: 'Email, SMS, and push notifications',
        files: 35,
        linesOfCode: 3500,
        language: 'TypeScript',
        health: 71,
        dependencies: 2,
        dependents: 11,
        traffic: 'Medium',
        criticality: 72,
        complexity: 55,
        testCoverage: 68,
        maintainability: 70,
        issues: 3
      },
      'Analytics Engine': {
        description: 'Event tracking and data aggregation',
        files: 45,
        linesOfCode: 4500,
        language: 'Python',
        health: 64,
        dependencies: 3,
        dependents: 9,
        traffic: 'Low',
        criticality: 65,
        complexity: 82,
        testCoverage: 58,
        maintainability: 60,
        issues: 8
      },
      'Cache Layer': {
        description: 'Redis caching and session management',
        files: 22,
        linesOfCode: 2200,
        language: 'Go',
        health: 76,
        dependencies: 1,
        dependents: 14,
        traffic: 'High',
        criticality: 82,
        complexity: 45,
        testCoverage: 91,
        maintainability: 85,
        issues: 0
      },
      'Search Service': {
        description: 'Elasticsearch integration and query optimization',
        files: 38,
        linesOfCode: 3800,
        language: 'Python',
        health: 62,
        dependencies: 2,
        dependents: 7,
        traffic: 'Medium',
        criticality: 68,
        complexity: 88,
        testCoverage: 52,
        maintainability: 58,
        issues: 7
      },
      'Legacy Utils': {
        description: 'Deprecated utility functions (slated for removal)',
        files: 28,
        linesOfCode: 2800,
        language: 'JavaScript',
        health: 42,
        dependencies: 8,
        dependents: 22,
        traffic: 'Medium',
        criticality: 45,
        complexity: 92,
        testCoverage: 31,
        maintainability: 35,
        issues: 15
      },
      'Shared Utils': {
        description: 'Common utilities and helpers',
        files: 24,
        linesOfCode: 2400,
        language: 'TypeScript',
        health: 73,
        dependencies: 0,
        dependents: 25,
        traffic: 'High',
        criticality: 78,
        complexity: 52,
        testCoverage: 88,
        maintainability: 80,
        issues: 1
      }
    };

    const serviceNames = Object.keys(serviceTemplates);
    return serviceNames.map((name, idx) => ({
      name,
      ...serviceTemplates[name],
      lastModified: this.getRandomDate()
    } as RepositoryService));
  }

  private generateDependencies(services: RepositoryService[]): ServiceDependency[] {
    const dependencies: ServiceDependency[] = [];

    // Define realistic dependency patterns
    const connectionMap: Record<string, string[]> = {
      'API Gateway': ['Auth Service', 'User Service', 'Payment Service', 'Notification Service'],
      'Auth Service': ['Shared Utils', 'Cache Layer'],
      'Payment Service': ['Auth Service', 'User Service', 'Notification Service', 'Cache Layer'],
      'User Service': ['Auth Service', 'Shared Utils', 'Cache Layer', 'Analytics Engine'],
      'Notification Service': ['Shared Utils', 'Analytics Engine'],
      'Analytics Engine': ['Cache Layer', 'Search Service'],
      'Search Service': ['Shared Utils', 'Analytics Engine'],
      'Cache Layer': ['Shared Utils'],
      'Legacy Utils': ['Shared Utils', 'Payment Service'],
      'Shared Utils': []
    };

    for (const [from, targets] of Object.entries(connectionMap)) {
      for (const to of targets) {
        dependencies.push({
          from,
          to,
          type: Math.random() > 0.95 ? 'circular' : 'import',
          trafficCount: Math.floor(Math.random() * 200) + 50,
          risk:
            Math.random() > 0.7
              ? 'Low'
              : Math.random() > 0.4
                ? 'Medium'
                : 'High'
        });
      }
    }

    // Add a circular dependency for realism
    dependencies.push({
      from: 'Analytics Engine',
      to: 'User Service',
      type: 'circular',
      trafficCount: 120,
      risk: 'High'
    });

    return dependencies;
  }

  private getRandomDate(): string {
    const days = Math.floor(Math.random() * 60);
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
