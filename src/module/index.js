import { defineModule } from '@directus/extensions-sdk';
import BackupsRoute from './routes/backups.vue';
import SettingsRoute from './routes/settings.vue';

export default defineModule({
	id: 'dbbackup',
	name: 'DB Backups',
	icon: 'backup',
	routes: [
		{ path: '', component: BackupsRoute },
		{ path: 'settings', component: SettingsRoute },
	],
});
