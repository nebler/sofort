import json,sys
import suite
try:
 (suite.BASE.parent/'cgroup.subtree_control').write_text('+memory +cpu')
 suite.BASE.mkdir();(suite.BASE/'cgroup.subtree_control').write_text('+memory +cpu')
 result=suite.parking();print('PARKING_REPORT '+json.dumps(result,separators=(',',':')),flush=True)
 sys.exit(0 if result['pass'] else 1)
finally:
 for v in list(suite.LIVE):v.close()
 if suite.BASE.exists():suite.BASE.rmdir()
