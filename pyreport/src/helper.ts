import { printExpression, printMatrixes, printTable } from "./printer";

export function normalizeListString(input: string): string {
    let content = input.trim();
    let jsonAttempt = content.replace(/'/g, '"')
                             .replace(/\bNone\b/g, 'null')
                             .replace(/\bTrue\b/g, 'true')
                             .replace(/\bFalse\b/g, 'false')
                             .replace(/\(/g, '[')
                             .replace(/\)/g, ']');
    try {
        JSON.parse(jsonAttempt);
        return jsonAttempt; 
    } catch (e) {}

    if (content.startsWith('[') && content.endsWith(']')) {
        content = content.substring(1, content.length - 1);
    }

    const parts: string[] = [];
    let bracketDepth = 0;
    let currentPart = '';

    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        if (char === '[' || char === '(') {bracketDepth++;}
        else if (char === ']' || char === ')') {bracketDepth--;}
        
        if (char === ',' && bracketDepth === 0) {
            parts.push(currentPart.trim());
            currentPart = '';
        } else {
            currentPart += char;
        }
    }
    if (currentPart.trim()) {parts.push(currentPart.trim());}

    const cleaned = parts.map(p => {
        let item = p.trim();
        if ((item.startsWith("'") && item.endsWith("'")) || 
            (item.startsWith('"') && item.endsWith('"'))) {
            item = item.substring(1, item.length - 1);
        }
        return item;
    });

    return JSON.stringify(cleaned);
}

export function createFinalReport(variables: any, data: any) {
    let raport = "";

    // 1. Map variables to their location (cell_line) for fast lookup
    const varMap = new Map<string, string[]>();
    Object.keys(variables).forEach(key => {
        const v = variables[key];
        if (v.cell !== undefined && v.line !== undefined) {
            const id = `${v.cell}_${v.line}`;
            if (!varMap.has(id)) { varMap.set(id, []); }
            varMap.get(id)?.push(key);
        }
    });

    // 2. Iterate through every cell in the notebook
    data.cells.forEach((cell: any, cellIndex: number) => {
        // A. Markdown Cells: Add content directly
        if (cell.cell_type === 'markdown') {
            const src = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
            raport += src + "\n\n";
        } 
        // B. Code Cells: Process line by line
        else if (cell.cell_type === 'code') {
            const lines = Array.isArray(cell.source) ? cell.source : cell.source.split('\n');
            
            lines.forEach((line: string, lineIndex: number) => {
                const trimmed = line.trim();
                
                // Check for Markdown Injection Tag "# md:"
                if (trimmed.startsWith('# md:')) {
                    raport += trimmed.substring(5).trim() + "\n\n";
                    return; // Done with this line
                }

                // Check if this line defines any variables
                const id = `${cellIndex}_${lineIndex}`;
                if (varMap.has(id)) {
                    const varsOnLine = varMap.get(id) || [];
                    varsOnLine.forEach(key => {
                        const v = variables[key];
                        // Generate the appropriate report block
                        if (v.type === "table") {raport += printTable(v, key);}
                        else if (v.type === "matrix") {raport += printMatrixes(v, key);}
                        else {raport += printExpression(v, key);}
                    });
                }
                
                // Note: Standard code lines that are NOT "# md:" and NOT variables are skipped (hidden)
            });
        }
    });

    return raport;
}

export function extractExpressions(variables: any, data: any) {
    const keys = Object.keys(variables);

    for (let i = 0; i < data.cells.length; i++) {
        let cell = data.cells[i];
        if (cell.cell_type === "code") {
            const lines = Array.isArray(cell.source) ? cell.source : cell.source.split('\n');

            lines.forEach((line: string, lineIdx: number) => {
                for (let key of keys) {
                    if (variables[key].type === "function") { continue; }
                    
                    // Regex matches "key =" at start of line
                    const regex = new RegExp(`^\\s*${key}\\s*=(?!=)\\s*(.*)`);
                    const match = regex.exec(line);

                    if (match) {
                        let expression = match[1];
                        if (expression.includes('#')) {
                            expression = expression.split('#')[0];
                        }
                        expression = expression.trim();

                        if (expression.startsWith('(') && expression.endsWith(')')) {
                            let depth = 0;
                            let isWrapped = true;
                            for (let j = 0; j < expression.length; j++) {
                                if (expression[j] === '(') {depth++;}
                                else if (expression[j] === ')') {depth--;}
                                if (depth === 0 && j < expression.length - 1) {
                                    isWrapped = false;
                                    break;
                                }
                            }
                            if (isWrapped) {
                                expression = expression.substring(1, expression.length - 1).trim();
                            }
                        }

                        variables[key].cell = i; 
                        variables[key].line = lineIdx; // Save line index for report order
                        variables[key].expression = expression;
                    }
                }
            });
        }
    }
    return variables;
}

export function detectMatrixes(variables: any) {
    const keys = Object.keys(variables);
    for (let key of keys) {
        try {
            let vari = JSON.parse(JSON.stringify(variables[key]));
            let normalizedValueString = normalizeListString(vari.value);
            let parsedValue = JSON.parse(normalizedValueString);

            if (isMatrix(parsedValue)) {
                variables[key].type = "matrix";
                variables[key].latexValue = arrayToLatex(parsedValue);
            }

            if (variables[key].expression) {
                let cleanExpr = variables[key].expression.trim();
                cleanExpr = cleanExpr.replace(/^numpy\.array\s*\(|^np\.array\s*\(|^array\s*\(/, '');
                if (cleanExpr.endsWith(')')) {
                    // Simple heuristic check
                }
                
                if (cleanExpr.trim().startsWith('[')) {
                    if (cleanExpr.endsWith(')')) {
                         cleanExpr = cleanExpr.substring(0, cleanExpr.length - 1);
                    }

                    let normalizedExpr = normalizeListString(cleanExpr);
                    try {
                        let rows = JSON.parse(normalizedExpr); 
                        if (Array.isArray(rows) && rows.length > 0) {
                            let firstRow = JSON.parse(normalizeListString(rows[0]));
                            if (Array.isArray(firstRow)) {
                                let matrixData = rows.map((r: string) => JSON.parse(normalizeListString(r)));
                                variables[key].expression = arrayToLatex(matrixData);
                                variables[key].type = "matrix";
                            }
                        }
                    } catch(e) {}
                }
            }

        } catch (e) {}
    }
    return variables;
}

export function substituteValues(variables: any) {
    const keys = Object.keys(variables);

    for (let targetKey of keys) {
        const targetVar = variables[targetKey];
        if (targetVar.type === "function" || !targetVar.expression) { continue; }

        let currentString = targetVar.expression;

        for (let sourceKey of keys) {
            if (targetKey === sourceKey) { continue; }
            
            if (variables[sourceKey].type === 'matrix' && variables[sourceKey].latexValue) {
                 const regex = new RegExp(`\\b${sourceKey}\\b`, "g");
                 currentString = currentString.replace(regex, variables[sourceKey].latexValue);
            }
            else if (variables[sourceKey].value) {
                const sourceVal = parseFloat(variables[sourceKey].value);
                if (!isNaN(sourceVal) && isFinite(sourceVal)) {
                    const regex = new RegExp(`\\b${sourceKey}\\b`, "g");
                    currentString = currentString.replace(regex, sourceVal.toFixed(4));
                }
            }
        }
        
        currentString = currentString.replace(/@/g, '\\cdot');
        targetVar.replaced = currentString;

        if (targetVar.type !== 'list' && targetVar.type !== 'dict' && targetVar.type !== 'str' && targetVar.type !== 'table' && targetVar.type !== 'matrix') {
             const valNum = parseFloat(targetVar.value);
             if (!isNaN(valNum) && isFinite(valNum)) {
                 targetVar.value = valNum.toFixed(4);
             }
        }
    }
    return variables;
}

export function parseTableString(input: string) {
    const regex = /PyReport:table\[(.*?)\]\[(.*?)\]/;
    const match = regex.exec(input);
    if (match) {
        const items = JSON.parse(normalizeListString(`[${match[2]}]`));
        return {
            tableName: match[1].trim(),
            items: items
        };
    }
    return null;
}

export function isMatrix<T = any>(input: unknown): input is T[][] {
  if (!Array.isArray(input)) {return false;}
  if (input.length === 0) {return false;}
  const firstRow = input[0];
  if (!Array.isArray(firstRow)) {return false;}
  const expectedWidth = firstRow.length;
  return input.every((row) => Array.isArray(row) && row.length === expectedWidth);
}

export function arrayToLatex(arr: any[][]) {
    let latex = "\\begin{pmatrix} \n";
    for (let i = 0; i < arr.length; i++) {
        for (let j = 0; j < arr[i].length; j++) {
            latex += ` ${arr[i][j]}`;
            if (j !== arr[i].length - 1) { latex += " & "; }
        }
        latex += " \\\\ \n";
    }
    latex += `\\end{pmatrix}`;
    return latex;
}

export function findTableCommands(variables: any, data: any) {
    const keys = Object.keys(variables);
    for (let key of keys) {
        try {
            if (variables[key].cell !== undefined) {
                const cellIndex = variables[key].cell;
                const cellSource = data.cells[cellIndex].source;
                const lines = Array.isArray(cellSource) ? cellSource : cellSource.split('\n');

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const regex = new RegExp(`^\\s*${key}\\s*=(?!=)`);
                    
                    if (regex.test(line)) {
                        if (i > 0) {
                            const prevLine = lines[i - 1];
                            const tableData = parseTableString(prevLine);
                            if (tableData) {
                                variables[key].tableName = tableData.tableName;
                                variables[key].tableItems = JSON.stringify(tableData.items);
                                variables[key].type = "table";
                            }
                        }
                        break;
                    }
                }
            }
        } catch (e) {
            console.error(`Error finding table command for ${key}:`, e);
        }
    }
    return variables;
}

