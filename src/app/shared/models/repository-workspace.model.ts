export type DependencyTrafficLevel = 'High' | 'Medium' | 'Low' | 'None';

export interface ServiceNode {
  id: string;
  name: string;
  subtitle: string;
  type: string;
  description: string;
  personality: string;
  icon: string;
  health: number;
  files: number;
  linesOfCode: number;
  dependencies: number;
  dependents: number;
  traffic: DependencyTrafficLevel;
  stability: number;
  criticality: number;
  complexity: number;
  position: {
    x: number;
    y: number;
  };
}

export interface DependencyLink {
  id: string;
  from: string;
  to: string;
  traffic: DependencyTrafficLevel;
  trafficCount: number;
}

export interface RepositoryWorkspaceStats {
  population: number;
  age: number;
  commits: number;
  contributors: number;
  files: number;
  totalLines: number;
  languages: number;
  testCoverage: number;
  health: number;
}

export interface ArchitectureRiskMetrics {
  highDebtDistricts: number;
  abandonedFiles: number;
  complexBuildings: number;
  noTestBuildings: number;
}

export interface FutureInsightsForecast {
  withoutRefactor: number;
  withRefactor: number;
}

export interface CriticalDependencyPath {
  from: string;
  to: string;
  calls: number;
}

export interface RepositoryWorkspaceData {
  cityName: string;
  tagline: string;
  repository: string;
  branch: string;
  lastAnalyzed: string;
  stats: RepositoryWorkspaceStats;
  districts: ServiceNode[];
  roads: DependencyLink[];
  problems: ArchitectureRiskMetrics;
  topDependencies: CriticalDependencyPath[];
  forecast: FutureInsightsForecast;
}

// Transitional aliases for compatibility while internal naming migrates.
export type TrafficLevel = DependencyTrafficLevel;
export type District = ServiceNode;
export type Road = DependencyLink;
export type CityStats = RepositoryWorkspaceStats;
export type ProblemMetrics = ArchitectureRiskMetrics;
export type Forecast = FutureInsightsForecast;
export type TopDependency = CriticalDependencyPath;
export type CityData = RepositoryWorkspaceData;
