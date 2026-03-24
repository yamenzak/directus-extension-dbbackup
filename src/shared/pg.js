import { spawn, execSync } from 'child_process';

export function checkPgTools() {
	let pgDump = false;
	let pgRestore = false;

	try {
		execSync('which pg_dump', { stdio: 'ignore' });
		pgDump = true;
	} catch {}

	try {
		execSync('which pg_restore', { stdio: 'ignore' });
		pgRestore = true;
	} catch {}

	return { pg_dump: pgDump, pg_restore: pgRestore };
}

export function runPgDump(env) {
	return new Promise((resolve, reject) => {
		const args = [
			'-Fc',
			'--no-owner',
			'--no-privileges',
			'-h', env.DB_HOST,
			'-p', String(env.DB_PORT || 5432),
			'-U', env.DB_USER,
			'-d', env.DB_DATABASE,
		];

		const child = spawn('pg_dump', args, {
			env: { ...process.env, PGPASSWORD: env.DB_PASSWORD },
			stdio: ['ignore', 'pipe', 'pipe'],
		});

		const chunks = [];
		let stderr = '';

		child.stdout.on('data', (chunk) => chunks.push(chunk));
		child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

		child.on('close', (code) => {
			if (code === 0) {
				resolve(Buffer.concat(chunks));
			} else {
				reject(new Error(`pg_dump exited with code ${code}: ${stderr}`));
			}
		});

		child.on('error', (err) => {
			reject(new Error(`Failed to spawn pg_dump: ${err.message}`));
		});
	});
}

export function runPgRestore(inputStream, env) {
	return new Promise((resolve, reject) => {
		const args = [
			'--clean',
			'--if-exists',
			'--single-transaction',
			'--no-owner',
			'--no-privileges',
			'-h', env.DB_HOST,
			'-p', String(env.DB_PORT || 5432),
			'-U', env.DB_USER,
			'-d', env.DB_DATABASE,
		];

		const child = spawn('pg_restore', args, {
			env: { ...process.env, PGPASSWORD: env.DB_PASSWORD },
			stdio: ['pipe', 'pipe', 'pipe'],
		});

		let stderr = '';

		child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

		child.on('close', (code) => {
			if (code === 0 || code === 1) {
				resolve({ success: true, stderr, code });
			} else {
				reject(new Error(`pg_restore exited with code ${code}: ${stderr}`));
			}
		});

		child.on('error', (err) => {
			reject(new Error(`Failed to spawn pg_restore: ${err.message}`));
		});

		inputStream.pipe(child.stdin);

		child.stdin.on('error', () => {});
	});
}
