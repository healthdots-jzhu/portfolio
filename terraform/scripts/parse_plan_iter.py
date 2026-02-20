#!/usr/bin/env python3
import json,sys,os
p='plan.json'
if len(sys.argv)>1:
    p=sys.argv[1]
if not os.path.exists(p):
    print('ERROR: plan file not found:', p, file=sys.stderr)
    sys.exit(2)
try:
    d=json.load(open(p,'rb'))
except Exception as e:
    print('ERROR: failed to read/parse JSON:', e, file=sys.stderr)
    sys.exit(2)

instances=[]
stack=[d.get('planned_values',{})]
while stack:
    obj = stack.pop()
    if isinstance(obj, dict):
        # handle resources
        res = obj.get('resources')
        if isinstance(res, list):
            for r in res:
                try:
                    if r.get('type') == 'aws_instance':
                        instances.append({
                            'address': r.get('address'),
                            'ami': (r.get('values') or {}).get('ami'),
                            'instance_type': (r.get('values') or {}).get('instance_type')
                        })
                except Exception:
                    pass
        # push children
        for v in obj.values():
            if isinstance(v, (dict,list)):
                stack.append(v)
    elif isinstance(obj, list):
        for i in obj:
            if isinstance(i, (dict,list)):
                stack.append(i)

locals_obj = d.get('configuration', {}).get('root_module', {}).get('locals', {})
variables_obj = d.get('variables', {})

out = {'instances': instances, 'locals': locals_obj, 'variables': variables_obj}
print(json.dumps(out, indent=2))
