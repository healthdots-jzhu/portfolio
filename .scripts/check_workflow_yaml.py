import sys, yaml, pathlib

files = [".github/workflows/1-deploy-infra.yml", ".github/workflows/2-backend-build-and-push.yml"]
ok = True
for f in files:
    p = pathlib.Path(f)
    if not p.exists():
        print(f"MISSING: {f}")
        ok = False
        continue
    try:
        with p.open('r', encoding='utf-8') as fh:
            yaml.safe_load(fh)
        print(f"OK: {f}")
    except Exception as e:
        print(f"ERROR: {f}: {e}")
        ok = False
if not ok:
    sys.exit(1)
print('All YAML files parsed successfully.')
