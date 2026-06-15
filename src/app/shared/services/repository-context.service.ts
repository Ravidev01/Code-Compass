import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { RepositoryAnalysis } from '../models/repository-analysis.model';
import { RepositoryWorkspaceData } from '../models/repository-workspace.model';

@Injectable({ providedIn: 'root' })
export class RepositoryContextService {
  readonly currentRepository = signal<string | null>(null);
  readonly currentAnalysis = signal<RepositoryAnalysis | null>(null);
  readonly currentWorkspaceData = signal<RepositoryWorkspaceData | null>(null);
  readonly currentCity = this.currentWorkspaceData;
  readonly isLoading = signal(false);

  constructor(private router: Router) {}

  setRepositoryAnalysis(url: string, analysis: RepositoryAnalysis, workspaceData: RepositoryWorkspaceData): void {
    this.currentRepository.set(url);
    this.currentAnalysis.set(analysis);
    this.currentWorkspaceData.set(workspaceData);
  }

  reset(): void {
    this.currentRepository.set(null);
    this.currentAnalysis.set(null);
    this.currentWorkspaceData.set(null);
  }

  navigateToDashboard(): void {
    this.router.navigate(['/workspace']);
  }

  navigateToInput(): void {
    this.router.navigate(['/']);
  }
}
