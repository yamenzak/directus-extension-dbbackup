import { BACKUP_FOLDER_NAME } from './constants.js';

let cachedFolderId = null;

export async function ensureBackupFolder(foldersService) {
	if (cachedFolderId) {
		try {
			await foldersService.readOne(cachedFolderId);
			return cachedFolderId;
		} catch {
			cachedFolderId = null;
		}
	}

	const existing = await foldersService.readByQuery({
		filter: { name: { _eq: BACKUP_FOLDER_NAME } },
		limit: 1,
	});

	if (existing.length > 0) {
		cachedFolderId = existing[0].id;
		return cachedFolderId;
	}

	cachedFolderId = await foldersService.createOne({
		name: BACKUP_FOLDER_NAME,
	});

	return cachedFolderId;
}
