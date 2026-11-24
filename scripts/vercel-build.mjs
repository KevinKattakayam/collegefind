// Schema deployment is a separate, owner-approved operation. Builds are read-only.
import { execFileSync } from 'node:child_process';

execFileSync('npm', ['exec', '--', 'prisma', 'generate'], { stdio: 'inherit' });
execFileSync('npm', ['exec', '--', 'next', 'build', '--webpack'], { stdio: 'inherit' });
