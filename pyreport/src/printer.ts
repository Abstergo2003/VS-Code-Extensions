import { normalizeListString } from "./helper";

export const symbols = ["alpha", "Alpha","beta", "Beta","gamma", "Gamma","delta", "Delta", "epsilon", "Epsilon", "zeta", "Zeta", "eta", "Eta", "theta", "Theta","iota", "Iota" ,"kappa", "Kappa", "lambda", "Lambda", "mu", "Mu", "nu", "Nu", "xi", "Xi", "omicron", "Omicron", "pi", "Pi", "rho", "Rho", "sigma", "Sigma", "varsigma", "tau", "Tau", "upsilon", "Upsilon", "phi", "Phi", "varphi", "chi", "Chi", "psi", "Psi", "omega", "Omega"];


export function printExpression(v: any, key: string) {
    let parts = v.expression.split(" ");
    let parsedExpression = "";
    for (let i = 0; i < parts.length; i++) {
        let part = parts[i];
        for (let i = 0; i < symbols.length; i++) {
            if (part.includes(symbols[i])) {
                part = "\\" + part;
            }
        }
        parsedExpression += parts[i].replace("_", "_{");
        if (parts[i].indexOf("_") !== -1) {
            parsedExpression += "} ";
        }
    }
    let parsedName = key;
    if (key.indexOf("_") !== -1) {
        parsedName = `${key.replace("_", "_{")}} `;
        for (let i = 0; i < symbols.length; i++) {
            if (key.includes(symbols[i])) {
                parsedName = "\\" + parsedName;
            }
        }
    }
    if (parsedExpression === v.replaced) {
        return `$ ${parsedName} = ${v.value} $ \n\n`;
    } else {
        return `$ ${parsedName} = ${parsedExpression} = ${v.replaced} = ${v.value} $ \n\n`;
    }
}

export function printTable(v: any, key: string) {
    let string = `
*${key}* \n
| Item | Expression | Replaced | Value |
|---|---|---|---|\n`;

    let values: any[] = [];
    try { 
        values = JSON.parse(v.value); 
    } catch { 
        try { values = JSON.parse(normalizeListString(v.value)); } catch { values = [v.value]; }
    }

    let expressions: any[] = [];
    try {
        expressions = JSON.parse(normalizeListString(v.expression));
    } catch {
        expressions = [v.expression];
    }

    let replaced: any[] = [];
    try {
        replaced = JSON.parse(normalizeListString(v.replaced));
    } catch {
        replaced = [v.replaced];
    }

    let names: any[] = [];
    try {
        names = JSON.parse(v.tableItems);
    } catch {
        names = [];
    }
    
    const len = names.length;
    
    for (let i = 0; i < len; i++) {
        string += `| ${names[i]} | ${expressions[i] || ''} | ${replaced[i] || ''} | ${values[i] !== undefined ? values[i] : ''} | \n`;
    }
    return string + "\n\n";
}

export function printMatrixes(v: any, key: string) {
    let output = `$$ ${key}`;
    if (v.expression) {
        output += ` = ${v.expression.replaceAll("@", "*")}`;
    }
    const cleanReplaced = v.replaced ? v.replaced.replace(/\s/g, '') : '';
    const cleanExpr = v.expression ? v.expression.replace(/\s/g, '') : '';
    const cleanLatexVal = v.latexValue ? v.latexValue.replace(/\s/g, '') : '';

    if (v.replaced && cleanReplaced !== cleanExpr && cleanReplaced !== cleanLatexVal) {
        output += ` = ${v.replaced}`;
    }
    if (v.latexValue && cleanLatexVal !== cleanExpr && cleanLatexVal !== cleanReplaced) {
        output += ` = ${v.latexValue}`;
    }
    output += ` $$\n`;
    return output;
}