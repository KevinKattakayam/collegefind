"""Scan tracked release files for common credential patterns; emit locations only."""
import pathlib
import re
import subprocess
import sys

patterns = {
    "database URL": re.compile(r"""postgres(?:ql)?://[^\s"'<>/@:]+:[^\s"'<>/@]+@[^\s"'<>/]+"""),
    "database token": re.compile(r"\bnpg_[A-Za-z0-9]{10,}"),
    "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----"),
    "provider token": re.compile(r"\b(?:ghp_|github_pat_|sk_live_)[A-Za-z0-9_]{16,}|\bAKIA[0-9A-Z]{16}\b"),
}
placeholder = re.compile(r"postgres(?:ql)?://(?:postgres:postgres|cf:cf|user:password)@(?:localhost|127\.0\.0\.1|host)(?::(?:\d+|\$CF_PORT))?$")
assignment = re.compile(
    r"""^\s*(?:export\s+)?(?:NEXTAUTH_SECRET|UPSTASH_REDIS_REST_TOKEN|ADMIN_SEED_TOKEN)\s*[:=]\s*["']?([A-Za-z0-9._~+/=-]{20,})"""
)
documented_fixtures = {
    (".env.example", "replace-me-with-at-least-32-random-characters"),
    (".github/workflows/ci.yml", "ci-secret-value-that-is-at-least-32-chars"),
    ("docs/UPGRADE_STATUS.md", "local-fixture-secret-at-least-32-characters"),
}
fail = False
for name in subprocess.check_output(["git", "ls-files", "-z"]).decode().split("\0"):
    if not name or name == "scripts/check-release-secrets.py":
        continue
    path = pathlib.Path(name)
    if not path.is_file() or path.is_symlink():
        continue
    for number, line in enumerate(path.read_text(errors="replace").splitlines(), 1):
        match = assignment.match(line)
        if match and (name, match.group(1)) not in documented_fixtures:
            print(f"{name}:{number}: possible secret assignment")
            fail = True
        for label, pattern in patterns.items():
            if any(not (label == "database URL" and placeholder.fullmatch(match.group()))
                   for match in pattern.finditer(line)):
                print(f"{name}:{number}: possible {label}")
                fail = True
sys.exit(int(fail))
