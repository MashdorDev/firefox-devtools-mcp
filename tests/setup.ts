// Vitest setup file
// This file runs before all tests

import { beforeAll, afterAll } from 'vitest';
import { execSync, execFileSync } from 'child_process';

const isWindows = process.platform === 'win32';

// Track if we're in cleanup mode
let isCleaningUp = false;

// Processes that existed before the tests started, such as a Firefox the
// developer launched with --marionette for the MCP server. Cleanup leaves them
// alone and only kills what the test run started.
const preexistingPids = new Set<number>([
  ...findProcessIds('firefox', '--marionette'),
  ...findProcessIds('geckodriver'),
]);

beforeAll(() => {
  // Setup code runs before all tests
});

afterAll(() => {
  // Global cleanup: kill any remaining Firefox/geckodriver processes
  cleanup();
});

/**
 * Cleanup function to kill leftover test Firefox and geckodriver processes
 * This ensures no zombie processes are left after test runs
 */
function cleanup() {
  if (isCleaningUp) {
    return; // Prevent recursive cleanup
  }
  isCleaningUp = true;

  if (isWindows) {
    cleanupWindows();
  } else {
    cleanupUnix();
  }
  isCleaningUp = false;
}

function cleanupUnix() {
  try {
    // Find Firefox processes started with --marionette (test instances)
    const firefoxPids = findProcessIds('firefox', '--marionette').filter(
      (pid) => !preexistingPids.has(pid)
    );

    // Kill children of each Firefox test process, then kill the parent
    for (const pid of firefoxPids) {
      try {
        execSync(`pkill -9 -P ${pid} 2>/dev/null || true`, { stdio: 'ignore' });
      } catch {
        // Ignore errors - child processes might already be dead
      }
      try {
        execSync(`kill -9 ${pid} 2>/dev/null || true`, { stdio: 'ignore' });
      } catch {
        // Ignore errors - process might already be dead
      }
    }

    for (const pid of findProcessIds('geckodriver')) {
      if (!preexistingPids.has(pid)) {
        execSync(`kill -9 ${pid} 2>/dev/null || true`, { stdio: 'ignore' });
      }
    }

    console.log('✅ Global cleanup: All test Firefox processes terminated');
  } catch {
    // Ignore errors - processes might already be dead
  }
}

/**
 * Retrieve all process ids matching the provided name and optional command
 * line pattern.
 */
function findProcessIds(name: string, commandLinePattern?: string): number[] {
  try {
    if (isWindows) {
      return findWindowsProcessIds(`${name}.exe`, commandLinePattern);
    }
    const pattern = commandLinePattern ? `${name}.*${commandLinePattern}` : name;
    return execSync(`pgrep -f "${pattern}" || true`, { encoding: 'utf-8' })
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^\d+$/.test(line))
      .map(Number);
  } catch {
    return [];
  }
}

/**
 * Windows only. Retrieve all process ids matching the provided name and
 * optional command line pattern.
 */
function findWindowsProcessIds(imageName: string, commandLinePattern?: string): number[] {
  const filter = commandLinePattern
    ? `Name='${imageName}' AND CommandLine LIKE '%${commandLinePattern}%'`
    : `Name='${imageName}'`;
  const script =
    `Get-CimInstance Win32_Process -Filter "${filter}" | ` +
    'Select-Object -ExpandProperty ProcessId';
  const output = execFileSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }
  );
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d+$/.test(line))
    .map(Number);
}

function cleanupWindows() {
  try {
    const firefoxPids = findProcessIds('firefox', '--marionette').filter(
      (pid) => !preexistingPids.has(pid)
    );
    for (const pid of firefoxPids) {
      try {
        // /T kills the whole process tree, replacing the Unix child-kill step
        execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
      } catch {
        // Ignore errors - process might already be dead
      }
    }

    for (const pid of findProcessIds('geckodriver')) {
      if (preexistingPids.has(pid)) {
        continue;
      }
      try {
        execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
      } catch {
        // Ignore errors - process might already be dead
      }
    }

    if (firefoxPids.length > 0) {
      console.log('✅ Global cleanup: All test Firefox processes terminated');
    }
  } catch {
    // Ignore errors - processes might already be dead
  }
}

// Handle process termination signals
process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT received, cleaning up Firefox processes...');
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received, cleaning up Firefox processes...');
  cleanup();
  process.exit(0);
});

// Handle unhandled errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  cleanup();
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled rejection:', reason);
  cleanup();
  process.exit(1);
});
