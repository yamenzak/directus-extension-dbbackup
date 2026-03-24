<template>
	<private-view title="Backups">
		<template #title-outer:prepend>
			<v-button class="header-icon" rounded disabled icon secondary>
				<v-icon name="backup" />
			</v-button>
		</template>

		<template #headline>
			<v-breadcrumb :items="[{ name: 'DB Backups', to: '/dbbackup' }]" />
		</template>

		<template #navigation>
			<v-list nav>
				<v-list-item to="/dbbackup" exact>
					<v-list-item-icon><v-icon name="backup" /></v-list-item-icon>
					<v-list-item-content>Backups</v-list-item-content>
				</v-list-item>
				<v-list-item to="/dbbackup/settings">
					<v-list-item-icon><v-icon name="settings" /></v-list-item-icon>
					<v-list-item-content>Settings</v-list-item-content>
				</v-list-item>
			</v-list>
		</template>

		<!-- Access denied for non-admins -->
		<div v-if="accessDenied" class="access-denied">
			<v-icon name="lock" class="access-denied-icon" />
			<h2>Access Denied</h2>
			<p>Only administrators can manage database backups.</p>
		</div>

		<div v-else class="page-content">
			<!-- Notices -->
			<v-notice v-if="pgWarning" type="warning" class="notice">
				<div>
					<strong>PostgreSQL tools not found.</strong>
					<p>Add <code>postgresql16-client</code> to your Directus Docker image.</p>
				</div>
			</v-notice>
			<v-notice v-if="error" type="danger" class="notice">{{ error }}</v-notice>
			<v-notice v-if="successMsg" type="success" class="notice">{{ successMsg }}</v-notice>

			<!-- Stats bar -->
			<div v-if="!pgWarning && !loading && backups.length > 0" class="stats-bar">
				<div class="stat">
					<v-icon name="inventory_2" class="stat-icon" />
					<div class="stat-body">
						<span class="stat-value">{{ backups.length }}</span>
						<span class="stat-label">{{ backups.length === 1 ? 'Backup' : 'Backups' }}</span>
					</div>
				</div>
				<div class="stat">
					<v-icon name="storage" class="stat-icon" />
					<div class="stat-body">
						<span class="stat-value">{{ totalSize }}</span>
						<span class="stat-label">Total Size</span>
					</div>
				</div>
				<div class="stat">
					<v-icon name="schedule" class="stat-icon" />
					<div class="stat-body">
						<span class="stat-value">{{ lastBackupRelative }}</span>
						<span class="stat-label">Last Backup</span>
					</div>
				</div>
			</div>

			<!-- Loading -->
			<div v-if="loading" class="loading-state">
				<v-progress-circular indeterminate />
			</div>

			<!-- Timeline -->
			<div v-else class="timeline">
				<!-- Action node: Create / Sync / Upload -->
				<div class="timeline-node action-node">
					<div class="node-track">
						<div class="node-dot action-dot">
							<v-icon name="add" />
						</div>
						<div v-if="backups.length > 0" class="node-line"></div>
					</div>
					<div class="node-body action-body">
						<div class="action-buttons-row">
							<v-button v-if="!pgWarning" @click="showCreateDialog = true" :loading="creating">
								<v-icon name="backup" left />
								Create Backup
							</v-button>
							<v-button @click="syncFromStorage" :loading="syncing" secondary>
								<v-icon name="sync" left />
								Sync Storage
							</v-button>
							<v-button v-if="!pgWarning" @click="showUploadDialog = true" secondary>
								<v-icon name="upload_file" left />
								Upload
							</v-button>
						</div>
					</div>
				</div>

				<!-- Empty state (no backups) -->
				<div v-if="backups.length === 0 && !pgWarning" class="timeline-node">
					<div class="node-track">
						<div class="node-dot empty-dot">
							<v-icon name="cloud_off" />
						</div>
					</div>
					<div class="node-body empty-body">
						<h3>No backups yet</h3>
						<p class="subdued">Create your first database backup to get started.</p>
					</div>
				</div>

				<!-- Backup nodes -->
				<div
					v-for="(backup, index) in formattedBackups"
					:key="backup.id"
					class="timeline-node backup-node"
				>
					<div class="node-track">
						<div :class="['node-dot', dotClass(backup)]">
							<v-icon :name="dotIcon(backup)" />
						</div>
						<div v-if="index < formattedBackups.length - 1" class="node-line"></div>
					</div>

					<div class="node-body backup-body">
						<div class="backup-header">
							<span class="backup-title">{{ backup.title || 'Untitled backup' }}</span>
							<div class="badges">
								<span v-for="b in backup._badges" :key="b.text" :class="['badge', b.type]">{{ b.text }}</span>
							</div>
						</div>
						<div class="backup-meta">
							<span class="meta-item">
								<v-icon name="schedule" x-small />
								{{ backup.uploaded_on_display }}
							</span>
							<span class="meta-item">
								<v-icon name="save" x-small />
								{{ backup.filesize_display }}
							</span>
						</div>
						<div class="backup-filename">{{ backup.filename_download }}</div>

						<div class="backup-actions">
							<v-button x-small secondary @click="startRestore(backup)">
								<v-icon name="settings_backup_restore" small left />
								Restore
							</v-button>
							<v-button x-small secondary :href="getDownloadUrl(backup.id)" :download="backup.filename_download">
								<v-icon name="download" small left />
								Download
							</v-button>
							<v-button x-small secondary @click="startDelete(backup)">
								<v-icon name="close" small left />
								Delete
							</v-button>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Create backup dialog -->
		<v-dialog v-model="showCreateDialog" @esc="showCreateDialog = false">
			<v-card>
				<v-card-title>Create Backup</v-card-title>
				<v-card-text>
					<p class="dialog-hint">Full PostgreSQL dump uploaded to storage.</p>
					<v-input v-model="newLabel" placeholder="Label (e.g., Before v2 migration)" />
				</v-card-text>
				<v-card-actions>
					<v-button secondary @click="showCreateDialog = false">Cancel</v-button>
					<v-button @click="createBackup" :loading="creating">
						<v-icon name="backup" left />
						Create
					</v-button>
				</v-card-actions>
			</v-card>
		</v-dialog>

		<!-- Restore dialog -->
		<v-dialog v-model="showRestoreDialog" @esc="showRestoreDialog = false">
			<v-card>
				<v-card-title>Restore Database</v-card-title>
				<v-card-text>
					<v-notice type="warning">
						<div>
							<strong>This will replace the entire database.</strong>
							The server restarts after restore. All data since this backup will be lost.
						</div>
					</v-notice>
					<div v-if="selectedBackup" class="restore-target">
						<div class="restore-target-icon">
							<v-icon name="settings_backup_restore" />
						</div>
						<div>
							<strong>{{ selectedBackup.title || selectedBackup.filename_download }}</strong>
							<br />
							<span class="subdued">{{ selectedBackup.uploaded_on_display }} &middot; {{ selectedBackup.filesize_display }}</span>
						</div>
					</div>
				</v-card-text>
				<v-card-actions>
					<v-button secondary @click="showRestoreDialog = false">Cancel</v-button>
					<v-button kind="danger" @click="confirmRestore" :loading="restoring">
						<v-icon name="settings_backup_restore" left />
						Restore Now
					</v-button>
				</v-card-actions>
			</v-card>
		</v-dialog>

		<!-- Delete dialog -->
		<v-dialog v-model="showDeleteDialog" @esc="showDeleteDialog = false">
			<v-card>
				<v-card-title>Delete Backup</v-card-title>
				<v-card-text>
					<p>Permanently delete this backup from storage?</p>
					<p v-if="selectedBackup" style="margin-top: 8px;">
						<strong>{{ selectedBackup.title || selectedBackup.filename_download }}</strong>
					</p>
				</v-card-text>
				<v-card-actions>
					<v-button secondary @click="showDeleteDialog = false">Cancel</v-button>
					<v-button kind="danger" @click="confirmDelete" :loading="deleting">Delete</v-button>
				</v-card-actions>
			</v-card>
		</v-dialog>

		<!-- Upload dialog -->
		<v-dialog v-model="showUploadDialog" @esc="showUploadDialog = false">
			<v-card>
				<v-card-title>Upload Backup</v-card-title>
				<v-card-text>
					<p class="dialog-hint">Upload a <code>.dump</code> backup file to storage.</p>
					<input ref="fileInput" type="file" accept=".dump,.sql,.gz" @change="onFileSelect" style="margin-bottom: 12px;" />
					<v-input v-model="uploadLabel" placeholder="Label" />
				</v-card-text>
				<v-card-actions>
					<v-button secondary @click="showUploadDialog = false">Cancel</v-button>
					<v-button @click="uploadBackup" :loading="uploading" :disabled="!selectedFile">Upload</v-button>
				</v-card-actions>
			</v-card>
		</v-dialog>

		<!-- Restarting overlay -->
		<v-dialog :model-value="restarting" persistent>
			<v-card>
				<v-card-text style="text-align: center; padding: 40px;">
					<v-progress-circular indeterminate style="margin-bottom: 16px;" />
					<h3 style="margin-bottom: 8px;">Restoring Database...</h3>
					<p class="subdued">The server is restarting. This page will reload automatically.</p>
				</v-card-text>
			</v-card>
		</v-dialog>
	</private-view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useApi } from '@directus/extensions-sdk';

const api = useApi();
const BASE = '/dbbackup';

const accessDenied = ref(false);
const backups = ref([])
const loading = ref(false);
const creating = ref(false);
const restoring = ref(false);
const restarting = ref(false);
const deleting = ref(false);
const uploading = ref(false);
const syncing = ref(false);
const error = ref(null);
const successMsg = ref(null);

const showCreateDialog = ref(false);
const showRestoreDialog = ref(false);
const showDeleteDialog = ref(false);
const showUploadDialog = ref(false);
const newLabel = ref('');
const uploadLabel = ref('');
const selectedBackup = ref(null);
const selectedFile = ref(null);

const pgWarning = ref(false);
const backupFolderId = ref(null);

const formattedBackups = computed(() => {
	const sorted = [...backups.value];
	const biggest = sorted.reduce((max, b) => Math.max(max, parseInt(b.filesize) || 0), 0);
	const oldest = sorted.length > 0 ? sorted[sorted.length - 1] : null;

	return sorted.map((b, i) => {
		const size = parseInt(b.filesize) || 0;
		const badges = [];

		if (i === 0) badges.push({ text: 'Latest', type: 'primary' });
		if (sorted.length > 1 && size === biggest) badges.push({ text: 'Largest', type: 'warning' });
		if (sorted.length > 2 && oldest && b.id === oldest.id) badges.push({ text: 'Oldest', type: 'muted' });

		if (b.title === 'Scheduled backup') badges.push({ text: 'Auto', type: 'info' });

		return {
			...b,
			filesize_display: formatSize(size),
			uploaded_on_display: formatDate(b.uploaded_on),
			_badges: badges,
			_isLatest: i === 0,
			_isBiggest: sorted.length > 1 && size === biggest,
		};
	});
});

const totalSize = computed(() => {
	const total = backups.value.reduce((sum, b) => sum + (parseInt(b.filesize) || 0), 0);
	return formatSize(total);
});

const lastBackupRelative = computed(() => {
	if (backups.value.length === 0) return 'Never';
	const latest = backups.value[0]?.uploaded_on;
	if (!latest) return 'Never';
	return timeAgo(new Date(latest));
});

function dotClass(backup) {
	if (backup._isLatest) return 'dot-latest';
	return '';
}

function dotIcon(backup) {
	if (backup._isLatest) return 'verified';
	if (backup.title === 'Scheduled backup') return 'schedule';
	return 'description';
}

function formatSize(bytes) {
	if (!bytes) return '0 B';
	bytes = parseInt(bytes);
	if (bytes < 1024) return bytes + ' B';
	if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
	if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
	return (bytes / 1073741824).toFixed(2) + ' GB';
}

function formatDate(iso) {
	if (!iso) return '—';
	const d = new Date(iso);
	return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
		+ ' at ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function timeAgo(date) {
	const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
	if (seconds < 60) return 'Just now';
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days}d ago`;
	return formatDate(date.toISOString());
}

function getDownloadUrl(fileId) {
	return `/assets/${fileId}`;
}

function clearMessages() {
	error.value = null;
	successMsg.value = null;
}

async function fetchStatus() {
	try {
		const { data } = await api.get(`${BASE}/status`);
		pgWarning.value = !data.data.pg_dump_available || !data.data.pg_restore_available;
	} catch {}
}

async function fetchBackups() {
	loading.value = true;
	try {
		const { data } = await api.get(`${BASE}/backups`);
		backups.value = data.data || [];
	} catch (err) {
		error.value = 'Failed to load backups: ' + (err.response?.data?.errors?.[0]?.message || err.message);
	} finally {
		loading.value = false;
	}
}

async function createBackup() {
	clearMessages();
	creating.value = true;
	try {
		await api.post(`${BASE}/backup`, { label: newLabel.value || undefined });
		showCreateDialog.value = false;
		newLabel.value = '';
		successMsg.value = 'Backup created successfully.';
		await fetchBackups();
	} catch (err) {
		error.value = 'Backup failed: ' + (err.response?.data?.errors?.[0]?.message || err.message);
		showCreateDialog.value = false;
	} finally {
		creating.value = false;
	}
}

function startRestore(backup) {
	selectedBackup.value = backup;
	showRestoreDialog.value = true;
}

async function confirmRestore() {
	clearMessages();
	restoring.value = true;
	try {
		await api.post(`${BASE}/restore/${selectedBackup.value.id}`);
		showRestoreDialog.value = false;
		restarting.value = true;
		pollForRestart();
	} catch (err) {
		error.value = 'Restore failed: ' + (err.response?.data?.errors?.[0]?.message || err.message);
		showRestoreDialog.value = false;
	} finally {
		restoring.value = false;
	}
}

function pollForRestart() {
	let attempts = 0;
	const interval = setInterval(async () => {
		attempts++;
		if (attempts > 60) {
			clearInterval(interval);
			restarting.value = false;
			error.value = 'Server did not come back within 2 minutes. Please refresh manually.';
			return;
		}
		try {
			await api.get('/server/ping');
			clearInterval(interval);
			window.location.reload();
		} catch {}
	}, 2000);
}

function startDelete(backup) {
	selectedBackup.value = backup;
	showDeleteDialog.value = true;
}

async function confirmDelete() {
	clearMessages();
	deleting.value = true;
	try {
		await api.delete(`${BASE}/backup/${selectedBackup.value.id}`);
		showDeleteDialog.value = false;
		successMsg.value = 'Backup deleted.';
		await fetchBackups();
	} catch (err) {
		error.value = 'Delete failed: ' + (err.response?.data?.errors?.[0]?.message || err.message);
		showDeleteDialog.value = false;
	} finally {
		deleting.value = false;
	}
}

function onFileSelect(e) {
	selectedFile.value = e.target.files?.[0] || null;
}

async function uploadBackup() {
	if (!selectedFile.value) return;
	clearMessages();
	uploading.value = true;
	try {
		const formData = new FormData();
		formData.append('file', selectedFile.value);
		if (uploadLabel.value) formData.append('title', uploadLabel.value);
		formData.append('folder', await getBackupFolderId());
		await api.post('/files', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
		showUploadDialog.value = false;
		selectedFile.value = null;
		uploadLabel.value = '';
		successMsg.value = 'Backup uploaded successfully.';
		await fetchBackups();
	} catch (err) {
		error.value = 'Upload failed: ' + (err.response?.data?.errors?.[0]?.message || err.message);
	} finally {
		uploading.value = false;
	}
}

async function getBackupFolderId() {
	if (backupFolderId.value) return backupFolderId.value;
	const { data } = await api.get('/folders', {
		params: { filter: { name: { _eq: 'DB Backups' } }, limit: 1 },
	});
	if (data.data?.length > 0) {
		backupFolderId.value = data.data[0].id;
		return backupFolderId.value;
	}
	const { data: created } = await api.post('/folders', { name: 'DB Backups' });
	backupFolderId.value = created.data.id;
	return backupFolderId.value;
}

async function syncFromStorage() {
	clearMessages();
	syncing.value = true;
	try {
		const { data } = await api.post(`${BASE}/sync`);
		if (data.recovered > 0) {
			successMsg.value = `Recovered ${data.recovered} backup(s) from storage.`;
			await fetchBackups();
		} else {
			successMsg.value = 'Storage is in sync — no orphaned backups found.';
		}
	} catch (err) {
		error.value = 'Sync failed: ' + (err.response?.data?.errors?.[0]?.message || err.message);
	} finally {
		syncing.value = false;
	}
}

onMounted(async () => {
	try {
		await api.get(`${BASE}/status`);
	} catch (err) {
		if (err.response?.status === 403) {
			accessDenied.value = true;
			return;
		}
	}

	fetchStatus();
	fetchBackups();
});
</script>

<style scoped>
.page-content {
	padding: var(--content-padding);
	padding-top: 0;
}

.notice { margin-bottom: 16px; }

/* ---- Access Denied ---- */
.access-denied {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	text-align: center;
	padding: 80px 24px;
}

.access-denied-icon {
	--v-icon-size: 64px;
	color: var(--theme--foreground-subdued);
	opacity: 0.3;
	margin-bottom: 16px;
}

.access-denied h2 {
	margin: 0 0 4px;
	color: var(--theme--foreground);
}

.access-denied p {
	color: var(--theme--foreground-subdued);
	margin: 0;
}

/* ---- Stats ---- */
.stats-bar {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 12px;
	margin-bottom: 28px;
}

@media (max-width: 640px) {
	.stats-bar { grid-template-columns: 1fr; }
}

.stat {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 16px;
	background: var(--theme--background-normal);
	border-radius: var(--theme--border-radius);
}
.stat-icon { color: var(--theme--foreground-subdued); }
.stat-body { display: flex; flex-direction: column; }
.stat-value { font-size: 16px; font-weight: 700; color: var(--theme--foreground); line-height: 1.2; }
.stat-label { font-size: 12px; color: var(--theme--foreground-subdued); }

/* ---- Loading ---- */
.loading-state { display: flex; justify-content: center; padding: 60px 0; }

/* ---- Timeline ---- */
.timeline {
	display: flex;
	flex-direction: column;
	max-width: 780px;
}

.timeline-node {
	display: flex;
	gap: 16px;
}

@media (max-width: 640px) {
	.timeline-node { gap: 12px; }
}

/* Track: dot + line */
.node-track {
	display: flex;
	flex-direction: column;
	align-items: center;
	flex-shrink: 0;
	width: 40px;
}

.node-dot {
	width: 40px;
	height: 40px;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	background: var(--theme--background-normal);
	color: var(--theme--foreground-subdued);
}

@media (max-width: 640px) {
	.node-track { width: 32px; }
	.node-dot { width: 32px; height: 32px; }
	.node-dot .v-icon { --v-icon-size: 18px; }
}

.node-dot.action-dot {
	background: var(--theme--primary);
	color: var(--theme--primary-foreground, #fff);
}

.node-dot.dot-latest {
	background: var(--theme--primary-background);
	color: var(--theme--primary);
}

.node-dot.empty-dot {
	background: transparent;
	border: 2px dashed var(--theme--border-color);
	color: var(--theme--foreground-subdued);
}

.node-line {
	width: 2px;
	flex: 1;
	background: var(--theme--border-color);
}

/* ---- Action node ---- */
.action-body {
	padding: 6px 0 24px;
}

.action-buttons-row {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}

@media (max-width: 480px) {
	.action-buttons-row { flex-direction: column; }
	.action-buttons-row .v-button { width: 100%; }
}

/* ---- Empty node ---- */
.empty-body {
	padding: 8px 0 24px;
}

.empty-body h3 {
	margin: 0 0 2px;
	font-size: 15px;
	color: var(--theme--foreground);
}

/* ---- Backup node ---- */
.backup-body {
	flex: 1;
	min-width: 0;
	padding: 8px 0 24px;
}

.backup-header {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 6px;
	margin-bottom: 4px;
}

.backup-title {
	font-weight: 600;
	font-size: 15px;
	color: var(--theme--foreground);
}

.badges {
	display: flex;
	gap: 4px;
	flex-wrap: wrap;
}

.badge {
	display: inline-block;
	padding: 1px 8px;
	border-radius: 10px;
	font-size: 11px;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.02em;
	white-space: nowrap;
}

.badge.primary {
	background: var(--theme--primary-background);
	color: var(--theme--primary);
}
.badge.warning {
	background: var(--theme--warning-background);
	color: var(--theme--warning);
}
.badge.info {
	background: var(--theme--primary-background);
	color: var(--theme--primary);
	opacity: 0.7;
}
.badge.muted {
	background: var(--theme--background-normal);
	color: var(--theme--foreground-subdued);
}

.backup-meta {
	display: flex;
	flex-wrap: wrap;
	gap: 12px;
	font-size: 13px;
	color: var(--theme--foreground-subdued);
	margin-bottom: 2px;
}

.meta-item {
	display: inline-flex;
	align-items: center;
	gap: 4px;
}

.meta-item .v-icon {
	color: var(--theme--foreground-subdued);
	opacity: 0.5;
}

.backup-filename {
	font-family: var(--theme--fonts--monospace--font-family, monospace);
	font-size: 12px;
	color: var(--theme--foreground-subdued);
	opacity: 0.45;
	margin-bottom: 8px;
	word-break: break-all;
}

.backup-actions {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
}

@media (min-width: 641px) {
	.backup-actions {
		opacity: 0;
		transition: opacity 0.15s;
	}
	.backup-node:hover .backup-actions {
		opacity: 1;
	}
}

/* ---- Dialogs ---- */
.dialog-hint {
	margin-bottom: 12px;
	color: var(--theme--foreground-subdued);
}

.restore-target {
	display: flex;
	align-items: center;
	gap: 12px;
	margin-top: 16px;
	padding: 12px 16px;
	background: var(--theme--background-normal);
	border-radius: var(--theme--border-radius);
}

.restore-target-icon {
	width: 40px;
	height: 40px;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	background: var(--theme--warning-background);
	color: var(--theme--warning);
	flex-shrink: 0;
}

.subdued {
	color: var(--theme--foreground-subdued);
	font-size: 13px;
}

code {
	background: var(--theme--background-normal);
	padding: 2px 6px;
	border-radius: 4px;
	font-size: 0.875em;
}
</style>
