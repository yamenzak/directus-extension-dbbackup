import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { SETTINGS_DIR, SETTINGS_FILE, DEFAULT_SETTINGS } from './constants.js';

function getSettingsPath(extensionsPath) {
	return join(extensionsPath, SETTINGS_DIR, SETTINGS_FILE);
}

export function readSettings(extensionsPath) {
	const filePath = getSettingsPath(extensionsPath);

	try {
		if (!existsSync(filePath)) return { ...DEFAULT_SETTINGS };
		const raw = readFileSync(filePath, 'utf-8');
		return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
	} catch {
		return { ...DEFAULT_SETTINGS };
	}
}

export function writeSettings(extensionsPath, settings) {
	const dir = join(extensionsPath, SETTINGS_DIR);
	const filePath = join(dir, SETTINGS_FILE);

	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}

	writeFileSync(filePath, JSON.stringify(settings, null, '\t'), 'utf-8');
}
