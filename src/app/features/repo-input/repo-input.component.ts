import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RepositoryAnalyzerService } from '../../shared/services/repository-analyzer.service';
import { RepositoryWorkspaceGeneratorService } from '../../shared/services/repository-workspace-generator.service';
import { RepositoryContextService } from '../../shared/services/repository-context.service';

@Component({
  selector: 'app-repo-input',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-[#050816] via-slate-950 to-[#0f1729] flex items-center justify-center p-4">
      <div class="max-w-lg w-full">
        <div class="text-center mb-8 animate-fadeInScale">
          <div class="text-6xl mb-4">🧭</div>
          <h1 class="text-4xl font-bold text-white mb-2">CodeCompass</h1>
          <p class="text-lg text-slate-400">Navigate your repository with AI.</p>
          <p class="mt-2 text-sm text-slate-500">Analyze repository architecture, understand historical evolution, discover hidden risks, and predict future technical debt.</p>
        </div>

        <div class="glass-panel p-8 rounded-3xl border border-white/10 backdrop-blur-xl">
          <div class="mb-6">
            <label class="block text-sm font-semibold text-slate-300 mb-3">📍 GitHub Repository URL</label>
            <input
              type="text"
              #urlInput
              placeholder="https://github.com/owner/repository"
              class="w-full px-4 py-3 rounded-xl border border-white/15 bg-slate-900/50 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30 transition"
              (keyup.enter)="submitUrl(urlInput.value)"
              [disabled]="isAnalyzing()"
            />
          </div>

          <button
            type="button"
            class="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white font-semibold transition hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
            [disabled]="isAnalyzing()"
            (click)="submitUrl(urlInput.value)"
          >
            <span *ngIf="!isAnalyzing()">✨ Analyze Repository</span>
            <span *ngIf="isAnalyzing()">🔄 Building CodeCompass insights...</span>
          </button>

          <div *ngIf="error()" class="mt-4 p-3 rounded-lg bg-red-500/15 border border-red-400/30 text-red-300 text-sm">
            {{ error() }}
          </div>

          <div class="mt-8 pt-6 border-t border-white/10">
            <p class="text-xs text-slate-500 mb-3">💡 Try an example:</p>
            <div class="space-y-2">
              <button
                type="button"
                class="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-500/20 text-sm text-slate-400 hover:text-indigo-300 transition"
                (click)="submitUrl('https://github.com/angular/angular')"
              >
                Angular Framework
              </button>
              <button
                type="button"
                class="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-500/20 text-sm text-slate-400 hover:text-indigo-300 transition"
                (click)="submitUrl('https://github.com/facebook/react')"
              >
                React
              </button>
              <button
                type="button"
                class="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-500/20 text-sm text-slate-400 hover:text-indigo-300 transition"
                (click)="submitUrl('https://github.com/microsoft/vscode')"
              >
                VS Code
              </button>
              <button
                type="button"
                class="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-500/20 text-sm text-slate-400 hover:text-indigo-300 transition"
                (click)="submitUrl('https://github.com/dotnet/runtime')"
              >
                .NET Runtime
              </button>
            </div>
          </div>
        </div>

        <div class="mt-8 grid grid-cols-3 gap-4 text-center text-sm">
          <div>
            <div class="text-2xl mb-1">📦</div>
            <p class="text-slate-500">Services</p>
          </div>
          <div>
            <div class="text-2xl mb-1">🛣️</div>
            <p class="text-slate-500">Dependency Analysis</p>
          </div>
          <div>
            <div class="text-2xl mb-1">🧱</div>
            <p class="text-slate-500">Services</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `
  ]
})
export class RepoInputComponent {
  readonly isAnalyzing = signal(false);
  readonly error = signal<string | null>(null);

  private readonly analyzer = inject(RepositoryAnalyzerService);
  private readonly workspaceGenerator = inject(RepositoryWorkspaceGeneratorService);
  private readonly context = inject(RepositoryContextService);

  async submitUrl(url: string): Promise<void> {
    this.error.set(null);

    if (!url.trim()) {
      this.error.set('Please enter a repository URL');
      return;
    }

    // Basic validation
    if (!url.includes('github.com')) {
      this.error.set('Please enter a valid GitHub URL (github.com)');
      return;
    }

    this.isAnalyzing.set(true);

    try {
      // Analyze repository
      const analysis = await this.analyzer.analyzeRepository(url);

      // Generate workspace model
      const workspaceData = this.workspaceGenerator.generateWorkspaceData(analysis);

      // Store in context
      this.context.setRepositoryAnalysis(url, analysis, workspaceData);

      // Navigate to dashboard
      this.context.navigateToDashboard();
    } catch (err) {
      this.error.set('Failed to analyze repository. Please try again.');
      this.isAnalyzing.set(false);
    }
  }
}
