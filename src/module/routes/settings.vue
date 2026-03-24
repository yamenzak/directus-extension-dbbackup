<template>
	<private-view title="Settings">
		<template #title-outer:prepend>
			<v-button class="header-icon" rounded disabled icon secondary>
				<v-icon name="settings" />
			</v-button>
		</template>

		<template #headline>
			<v-breadcrumb :items="[
				{ name: 'DB Backups', to: '/dbbackup' },
				{ name: 'Settings', to: '/dbbackup/settings' },
			]" />
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

		<template v-if="!accessDenied" #actions>
			<v-button @click="saveSettings" :loading="saving" :disabled="!hasChanges">
				<v-icon name="check" left />
				Save
			</v-button>
		</template>

		<!-- Access denied for non-admins -->
		<div v-if="accessDenied" class="access-denied">
			<v-icon name="lock" class="access-denied-icon" />
			<h2>Access Denied</h2>
			<p>Only administrators can manage database backups.</p>
		</div>

		<div v-else class="page-content">
			<v-notice v-if="error" type="danger" class="notice">{{ error }}</v-notice>
			<v-notice v-if="saved" type="success" class="notice">Settings saved.</v-notice>

			<!-- Loading -->
			<div v-if="loading" class="loading-state">
				<v-progress-circular indeterminate />
			</div>

			<template v-else>
				<!-- System Health -->
				<div class="section-card">
					<div class="section-card-header">
						<div class="section-icon health">
							<v-icon name="monitor_heart" />
						</div>
						<div>
							<h2 class="section-title">System Health</h2>
							<p class="section-sub">Required tools and current status</p>
						</div>
					</div>

					<div class="health-grid">
						<div class="health-item">
							<div class="health-row">
								<div :class="['health-dot', status.pg_dump_available ? 'ok' : 'err']"></div>
								<span class="health-name">pg_dump</span>
							</div>
							<span :class="['health-status', status.pg_dump_available ? 'ok' : 'err']">
								{{ status.pg_dump_available ? 'Installed' : 'Missing' }}
							</span>
						</div>
						<div class="health-item">
							<div class="health-row">
								<div :class="['health-dot', status.pg_restore_available ? 'ok' : 'err']"></div>
								<span class="health-name">pg_restore</span>
							</div>
							<span :class="['health-status', status.pg_restore_available ? 'ok' : 'err']">
								{{ status.pg_restore_available ? 'Installed' : 'Missing' }}
							</span>
						</div>
						<div class="health-item">
							<div class="health-row">
								<div :class="['health-dot', status.last_backup_at ? 'ok' : 'warn']"></div>
								<span class="health-name">Last Backup</span>
							</div>
							<span class="health-value">{{ lastBackupDisplay }}</span>
						</div>
						<div class="health-item">
							<div class="health-row">
								<div :class="['health-dot', storageDriver ? 'ok' : 'warn']"></div>
								<span class="health-name">Storage</span>
							</div>
							<span class="health-value">{{ storageDriver }}</span>
						</div>
					</div>

					<v-notice v-if="!status.pg_dump_available || !status.pg_restore_available" type="warning" class="section-notice">
						<div>
							Add <code>apk add postgresql16-client</code> to your Dockerfile to enable backups.
						</div>
					</v-notice>
				</div>

				<!-- Schedule -->
				<div class="section-card">
					<div class="section-card-header">
						<div class="section-icon schedule">
							<v-icon name="event_repeat" />
						</div>
						<div>
							<h2 class="section-title">Automatic Backups</h2>
							<p class="section-sub">Schedule recurring database backups</p>
						</div>
					</div>

					<div class="setting-row">
						<div class="setting-info">
							<div class="setting-label">Backup Interval</div>
							<div class="setting-description">
								How often to create an automatic backup. Set to 0 to disable.
							</div>
						</div>
						<div class="setting-control">
							<v-input
								v-model="form.interval_hours"
								type="number"
								:min="0"
								:step="1"
								placeholder="0"
							>
								<template #append>
									<span class="input-suffix">hours</span>
								</template>
							</v-input>
						</div>
					</div>

					<div class="setting-divider"></div>

					<div class="setting-row">
						<div class="setting-info">
							<div class="setting-label">Retention</div>
							<div class="setting-description">
								Maximum backups to keep. Oldest are automatically deleted when this limit is exceeded.
							</div>
						</div>
						<div class="setting-control">
							<v-input
								v-model="form.retention_count"
								type="number"
								:min="1"
								:step="1"
								placeholder="10"
							>
								<template #append>
									<span class="input-suffix">backups</span>
								</template>
							</v-input>
						</div>
					</div>

					<!-- Live preview -->
					<div class="schedule-preview">
						<v-icon :name="form.interval_hours > 0 ? 'check_circle' : 'pause_circle'" class="preview-icon" />
						<span v-if="form.interval_hours > 0">
							A backup runs every <strong>{{ form.interval_hours }} hour{{ form.interval_hours > 1 ? 's' : '' }}</strong>,
							keeping the last <strong>{{ form.retention_count || 10 }}</strong>.
							That's roughly <strong>{{ coverageDays }}</strong> of history.
						</span>
						<span v-else>Automatic backups are disabled. Only manual backups will be kept.</span>
					</div>
				</div>

				<!-- Danger Zone -->
				<div class="section-card danger-zone">
					<div class="section-card-header">
						<div class="section-icon danger">
							<v-icon name="warning" />
						</div>
						<div>
							<h2 class="section-title">Danger Zone</h2>
							<p class="section-sub">Destructive actions</p>
						</div>
					</div>

					<div class="setting-row">
						<div class="setting-info">
							<div class="setting-label">Delete All Backups</div>
							<div class="setting-description">
								Remove all backup files from storage. This cannot be undone.
							</div>
						</div>
						<div class="setting-control">
							<v-button kind="danger" secondary @click="showDeleteAllDialog = true" :loading="deletingAll">
								<v-icon name="delete_sweep" left />
								Delete All
							</v-button>
						</div>
					</div>
				</div>
			</template>
		</div>

		<!-- Delete All dialog -->
		<v-dialog v-model="showDeleteAllDialog" @esc="showDeleteAllDialog = false">
			<v-card>
				<v-card-title>Delete All Backups</v-card-title>
				<v-card-text>
					<v-notice type="danger">
						<div>
							<strong>This will permanently delete every backup from storage.</strong>
							You will not be able to restore any previous state after this.
						</div>
					</v-notice>
				</v-card-text>
				<v-card-actions>
					<v-button secondary @click="showDeleteAllDialog = false">Cancel</v-button>
					<v-button kind="danger" @click="deleteAllBackups" :loading="deletingAll">
						<v-icon name="delete_forever" left />
						Delete Everything
					</v-button>
				</v-card-actions>
			</v-card>
		</v-dialog>
	</private-view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useApi } from '@directus/extensions-sdk';

const api = useApi();
const BASE = '/dbbackup';

const status = ref({
	pg_dump_available: false,
	pg_restore_available: false,
	last_backup_at: null,
});

const form = ref({
	interval_hours: 0,
	retention_count: 10,
});

const accessDenied = ref(false);
const originalForm = ref({});
const loading = ref(true);
const saving = ref(false);
const saved = ref(false);
const error = ref(null);
const deletingAll = ref(false);
const showDeleteAllDialog = ref(false);

const hasChanges = computed(() => {
	return form.value.interval_hours !== originalForm.value.interval_hours
		|| form.value.retention_count !== originalForm.value.retention_count;
});

const lastBackupDisplay = computed(() => {
	if (!status.value.last_backup_at) return 'Never';
	const d = new Date(status.value.last_backup_at);
	const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
	if (seconds < 60) return 'Just now';
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
});

const storageDriver = computed(() => {
	return 'Configured';
});

const coverageDays = computed(() => {
	const hours = parseInt(form.value.interval_hours) || 0;
	const count = parseInt(form.value.retention_count) || 10;
	if (hours <= 0) return '0 days';
	const totalHours = hours * count;
	if (totalHours < 24) return `${totalHours} hours`;
	const days = Math.round(totalHours / 24 * 10) / 10;
	if (days === 1) return '1 day';
	return `${days} days`;
});

async function fetchData() {
	loading.value = true;
	try {
		const [statusRes, settingsRes] = await Promise.all([
			api.get(`${BASE}/status`),
			api.get(`${BASE}/settings`),
		]);
		status.value = statusRes.data.data;
		form.value = {
			interval_hours: settingsRes.data.data.interval_hours ?? 0,
			retention_count: settingsRes.data.data.retention_count ?? 10,
		};
		originalForm.value = { ...form.value };
	} catch (err) {
		error.value = 'Failed to load settings: ' + (err.response?.data?.errors?.[0]?.message || err.message);
	} finally {
		loading.value = false;
	}
}

async function saveSettings() {
	error.value = null;
	saved.value = false;
	saving.value = true;
	try {
		const payload = {
			interval_hours: parseInt(form.value.interval_hours, 10) || 0,
			retention_count: parseInt(form.value.retention_count, 10) || 10,
		};
		const { data } = await api.patch(`${BASE}/settings`, payload);
		form.value = {
			interval_hours: data.data.interval_hours,
			retention_count: data.data.retention_count,
		};
		originalForm.value = { ...form.value };
		saved.value = true;
		setTimeout(() => { saved.value = false; }, 3000);
	} catch (err) {
		error.value = 'Save failed: ' + (err.response?.data?.errors?.[0]?.message || err.message);
	} finally {
		saving.value = false;
	}
}

async function deleteAllBackups() {
	error.value = null;
	deletingAll.value = true;
	try {
		const { data } = await api.get(`${BASE}/backups`);
		const backups = data.data || [];
		for (const backup of backups) {
			await api.delete(`${BASE}/backup/${backup.id}`);
		}
		showDeleteAllDialog.value = false;
		saved.value = false;
		error.value = null;
		alert(`Deleted ${backups.length} backup(s).`);
	} catch (err) {
		error.value = 'Delete failed: ' + (err.response?.data?.errors?.[0]?.message || err.message);
	} finally {
		deletingAll.value = false;
	}
}

onMounted(async () => {
	try {
		await api.get(`${BASE}/status`);
	} catch (err) {
		if (err.response?.status === 403) {
			accessDenied.value = true;
			loading.value = false;
			return;
		}
	}

	fetchData();
});
</script>

<style scoped>
.page-content {
	padding: var(--content-padding);
	padding-top: 0;
	max-width: 780px;
}

.notice { margin-bottom: 16px; }

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

.loading-state {
	display: flex;
	justify-content: center;
	padding: 60px 0;
}

/* ---- Section Cards ---- */
.section-card {
	background: var(--theme--background);
	border: 1px solid var(--theme--border-color);
	border-radius: var(--theme--border-radius);
	padding: 24px;
	margin-bottom: 20px;
}

.section-card.danger-zone {
	border-color: var(--theme--danger);
	border-style: dashed;
}

.section-card-header {
	display: flex;
	align-items: center;
	gap: 16px;
	margin-bottom: 24px;
}

@media (max-width: 480px) {
	.section-card { padding: 16px; }
	.section-card-header { gap: 12px; margin-bottom: 20px; }
}

.section-icon {
	width: 44px;
	height: 44px;
	border-radius: 12px;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.section-icon.health {
	background: var(--theme--success-background);
	color: var(--theme--success);
}

.section-icon.schedule {
	background: var(--theme--primary-background);
	color: var(--theme--primary);
}

.section-icon.danger {
	background: var(--theme--danger-background);
	color: var(--theme--danger);
}

.section-title {
	font-size: 16px;
	font-weight: 700;
	color: var(--theme--foreground);
	margin: 0;
	line-height: 1.3;
}

.section-sub {
	font-size: 13px;
	color: var(--theme--foreground-subdued);
	margin: 0;
}

.section-notice {
	margin-top: 16px;
}

/* ---- Health Grid ---- */
.health-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 12px;
}

@media (max-width: 480px) {
	.health-grid { grid-template-columns: 1fr; }
}

.health-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 12px 16px;
	background: var(--theme--background-normal);
	border-radius: var(--theme--border-radius);
}

.health-row {
	display: flex;
	align-items: center;
	gap: 10px;
}

.health-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	flex-shrink: 0;
}

.health-dot.ok { background: var(--theme--success); }
.health-dot.err { background: var(--theme--danger); }
.health-dot.warn { background: var(--theme--warning); }

.health-name {
	font-weight: 600;
	font-size: 14px;
	color: var(--theme--foreground);
}

.health-status {
	font-size: 13px;
	font-weight: 600;
}

.health-status.ok { color: var(--theme--success); }
.health-status.err { color: var(--theme--danger); }

.health-value {
	font-size: 13px;
	color: var(--theme--foreground-subdued);
}

/* ---- Setting Rows ---- */
.setting-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 24px;
}

@media (max-width: 640px) {
	.setting-row {
		flex-direction: column;
		align-items: stretch;
		gap: 12px;
	}
}

.setting-info {
	flex: 1;
	min-width: 0;
}

.setting-label {
	font-weight: 600;
	font-size: 14px;
	color: var(--theme--foreground);
	margin-bottom: 2px;
}

.setting-description {
	font-size: 13px;
	color: var(--theme--foreground-subdued);
	line-height: 1.4;
}

.setting-control {
	flex-shrink: 0;
	width: 180px;
}

@media (max-width: 640px) {
	.setting-control { width: 100%; }
}

.input-suffix {
	font-size: 13px;
	color: var(--theme--foreground-subdued);
	padding-right: 4px;
}

.setting-divider {
	height: 1px;
	background: var(--theme--border-color);
	margin: 20px 0;
}

/* ---- Schedule Preview ---- */
.schedule-preview {
	display: flex;
	align-items: flex-start;
	gap: 10px;
	margin-top: 20px;
	padding: 14px 16px;
	background: var(--theme--background-normal);
	border-radius: var(--theme--border-radius);
	font-size: 13px;
	color: var(--theme--foreground-subdued);
	line-height: 1.5;
}

.preview-icon {
	flex-shrink: 0;
	margin-top: 1px;
	color: var(--theme--foreground-subdued);
	opacity: 0.5;
}

.schedule-preview strong {
	color: var(--theme--foreground);
}

code {
	background: var(--theme--background-normal);
	padding: 2px 6px;
	border-radius: 4px;
	font-size: 0.875em;
}
</style>
