GLOBAL_TEMPLATES = {};

async function importTemplates(path = "templates/main.html", pathReplace = null) {
    const response = await fetch(path);
    let text = await response.text();
    if (pathReplace != null) {
        text = text.replaceAll("server.uri", pathReplace);
    }
    let parser = new DOMParser();
    let templatesDOM = await parser.parseFromString(text, "text/html");
    let templatesElements = await templatesDOM.querySelectorAll("template");
    await templatesElements.forEach(tem => {
        const element = tem.innerHTML;
        let div = document.createElement('div');
        div.id = tem.id;
        div.innerHTML = element;

        GLOBAL_TEMPLATES[tem.id] = div.innerHTML;
    });
    return true;
}
function listTemplates() {
    const keys = Object.keys(GLOBAL_TEMPLATES);
    keys.forEach(key => {
        console.log(`%c ${key}:`, 'font-weight: bold');
        let div = document.createElement('div');
        div.innerHTML = GLOBAL_TEMPLATES[key];
        console.log(div);
    });
}

function getElement(tem, options={}, id) {
    let element = tem;
    let ID = id ?? new Date().getTime();
    let keys = Object.keys(options);
    keys.forEach(key => {
        element = element.replace(`\@@\{${key}\}`, options[key]);
    });
    try {
        element = element.replaceAll("@@{TID}", id);
    } catch {

    }
    let index = element.indexOf("@@");
    if (index != -1) {
        let name = "";
        index += 3;
        do {
            name += element[index];
            index++;
        } while (element[index] != "}") 
        console.error(`There is missing data argument: "${name}"`);
        return "";
    }
    
    let helpingDIV = document.createElement('div');
    helpingDIV.innerHTML = element;
    let div = document.createElement('div');
    div.id = ID;
    let children = helpingDIV.children;

    const scripts = helpingDIV.querySelectorAll('script');
    scripts.forEach(script => {
        const newScript = document.createElement('script');
        if (script.src) {
            // If script has a src, copy the src attribute
            newScript.src = script.src;
        } else {
            // If script is inline, copy the content
            newScript.textContent = script.textContent;
        }
        div.appendChild(newScript); // Append script to shadow DOM
        script.remove(); // Remove script from temporary div to avoid duplicate execution
    });
    // for some stupid reason when appendChild is called element is poped from HTML Collection so i just do not modify "i" and always get first element
    for (let i = 0; i< children.length; i++) {
        const temp = children[i]
            if (temp.tagName != "STYLE") {
                div.appendChild(temp);
            }
        };
    return div;
}
function getIsolatedElement(tem, options={}, id) {
    let element = tem;
    let ID = id ?? new Date().getTime();
    console.log(element);
    let keys = Object.keys(options);
    keys.forEach(key => {
        element = element.replace(`\@@\{${key}\}`, options[key]);
    });
    try {
        element = element.replaceAll("@@{TID}", id);
    } catch {

    }
    let index = element.indexOf("@@");
    if (index != -1) {
        let name = "";
        index += 3;
        do {
            name += element[index];
            index++;
        } while (element[index] != "}") 
        console.error(`There is missing data argument: "${name}"`);
        return "";
    }
    
    let helpingDIV = document.createElement('div');
    helpingDIV.innerHTML = element;
    let div = document.createElement('div');
    div.id = ID;
    let shadowRoot = div.attachShadow({mode: "open"});
    let children = helpingDIV.children;

    const scripts = helpingDIV.querySelectorAll('script');
    scripts.forEach(script => {
        const newScript = document.createElement('script');
        if (script.src) {
            // If script has a src, copy the src attribute
            newScript.src = script.src;
        } else {
            // If script is inline, copy the content
            newScript.textContent = script.textContent;
        }
        shadowRoot.appendChild(newScript); // Append script to shadow DOM
        script.remove(); // Remove script from temporary div to avoid duplicate execution
    });
    // for some stupid reason when appendChild is called element is poped from HTML Collection so i just do not modify "i" and always get first element
    for (let i = 0; i< children.length; i) {
        shadowRoot.appendChild(children[i]);
    }
    return div;
}
const delay = (delayInms) => {
    return new Promise(resolve => setTimeout(resolve, delayInms));
};