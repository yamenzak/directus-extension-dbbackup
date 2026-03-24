import { defineHook } from '@directus/extensions-sdk';
import { readSettings } from '../shared/settings.js';
import { performBackup } from '../shared/backup.js';

export default defineHook(({ init }, context) => {
	const { services, getSchema, env, logger, database } = context;

	init('app.after', () => {
		setInterval(async () => {
			try {
				const settings = readSettings(env.EXTENSIONS_PATH);

				if (!settings.interval_hours || settings.interval_hours <= 0) return;

				const intervalMs = settings.interval_hours * 3600_000;
				const lastBackup = settings.last_backup_at
					? new Date(settings.last_backup_at).getTime()
					: 0;

				if (Date.now() - lastBackup < intervalMs) return;

				logger.info('[dbbackup] Running scheduled backup...');

				const schema = await getSchema();
				const accountability = { admin: true, role: null, user: null };

				await performBackup({
					filesService: new services.FilesService({ schema, accountability }),
					foldersService: new services.FoldersService({ schema, accountability }),
					env,
					label: 'Scheduled backup',
					database,
				});

				logger.info('[dbbackup] Scheduled backup completed.');
			} catch (err) {
				logger.error(`[dbbackup] Scheduled backup failed: ${err.message}`);
			}
		}, 60_000);
	});
});
