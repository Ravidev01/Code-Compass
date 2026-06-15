import { Routes } from '@angular/router';
import { DashboardPageComponent } from './features/dashboard/dashboard-page.component';
import { RepoInputComponent } from './features/repo-input/repo-input.component';

export const routes: Routes = [
	{
		path: '',
		component: RepoInputComponent
	},
	{
		path: 'workspace',
		component: DashboardPageComponent
	},
	{
		path: '**',
		redirectTo: ''
	}
];
