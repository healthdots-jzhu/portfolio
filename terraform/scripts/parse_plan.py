import json
import sys

p = 'plan.json'
try:
    d = json.load(open(p))
except Exception as e:
    print('ERROR: failed to read plan.json:', e, file=sys.stderr)
    sys.exit(2)

instances = []

def walk(obj):
    if isinstance(obj, dict):
        # resources list
        if 'resources' in obj and isinstance(obj['resources'], list):
            for r in obj['resources']:
                if r.get('type') == 'aws_instance':
                    instances.append({
                        'address': r.get('address'),
                        'ami': r.get('values', {}).get('ami'),
                        'instance_type': r.get('values', {}).get('instance_type')
                    })
        # also traverse all values
        for v in obj.values():
            walk(v)
    elif isinstance(obj, list):
        for i in obj:
            walk(i)

walk(d.get('planned_values', {}))

locals_obj = d.get('configuration', {}).get('root_module', {}).get('locals', {})
variables_obj = d.get('variables', {})

out = {
    'instances': instances,
    'locals': locals_obj,
    'variables': variables_obj
}

print(json.dumps(out, indent=2))
