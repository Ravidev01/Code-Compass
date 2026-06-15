export interface RepositoryService {
  name: string;
  description: string;
  files: number;
  linesOfCode: number;
  language: string;
  health: number; // 0-100
  dependencies: number;
  dependents: number;
  traffic: 'High' | 'Medium' | 'Low' | 'None';
  criticality: number; // 0-100, importance to system
  complexity: number; // 0-100
  testCoverage: number; // 0-100
  maintainability: number; // 0-100
  issues: number;
  lastModified: string;
}

export interface ServiceDependency {
  from: string;
  to: string;
  type: 'import' | 'api' | 'circular';
  trafficCount: number;
  risk: 'High' | 'Medium' | 'Low';
}

export interface RepositoryAnalysis {
  url: string;
  repository: string;
  owner: string;
  branch: string;
  description: string;
  services: RepositoryService[];
  dependencies: ServiceDependency[];
  contributors: number;
  commits: number;
  issues: number;
  pullRequests: number;
  stars: number;
  languages: string[];
  topics: string[];
  health: number;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  issues_found: string[];
  recommendations: string[];
  metrics: {
    avgServiceHealth: number;
    avgTestCoverage: number;
    complexServices: number;
    debtRisk: number;
    circularDependencies: number;
  };
}

export interface NavigatorResponse {
  message: string;
  tone: 'informative' | 'warning' | 'celebratory' | 'analytical';
  actions: {
    type: 'highlight-services' | 'focus-service' | 'show-dependencies' | 'show-metrics';
    serviceIds?: string[];
    dependencyIds?: string[];
    // Compatibility fields used by legacy handlers while migration is in progress.
    districtIds?: string[];
    roadIds?: string[];
  }[];
  workspaceFacts: string[];
}
