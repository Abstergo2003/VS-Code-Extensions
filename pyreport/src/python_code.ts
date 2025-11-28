export const pythonCode = `
import json
import sys
import types

def _pyreport_extract_variables():
    ignore_set = {
        'In', 'Out', 'get_ipython', 'exit', 'quit', 'open', 'json', 'sys', 'types', 
        '_pyreport_extract_variables', 'excluded_names', 'all_globals', 'variables_data'
    }

    result = {}
    
    # Snapshot globals to prevent iteration errors
    for name, val in list(globals().items()):
        if not name.startswith('_') and name not in ignore_set and not isinstance(val, types.ModuleType):
            try:
                # Get string representation
                if hasattr(val, 'tolist'):
                    val_str = str(val.tolist())
                else:
                    val_str = str(val)
                
                result[name] = {"value": val_str, "type": type(val).__name__}
            except:
                result[name] = {"value": "<Error>", "type": "Unknown"}
    return result

print("<<VAR_START>>" + json.dumps(_pyreport_extract_variables()) + "<<VAR_END>>")
del _pyreport_extract_variables
`;