import * as fs from "fs";
import * as p from "path";

import { Logger } from "./Logger.ts";
import { autoResolveInput, renderInputString } from "./Input.ts";
import { isContained, safeID } from "./String.ts";

export class Macro {
    name: string;

    // the default value for name is just so extended constructors don't yell at me for not passing one
    constructor(name: string = "") {
        this.name = name;
    }

    // parses the args content into an array of values
    parseArgs(input: string): any[] {
        const result = [];
        let cur = "";
        let quoted = false;
        let arrDepth = 0, objDepth = 0;

        for (let i = 0, char = input[i]; i < input.length; i++, char = input[i]) {
            if (["\"", "'"].includes(char) && (i === 0 || input[i-1] !== "\\")) {
                quoted = !quoted;
            }

            if (!quoted) {
                if (char === "[") arrDepth++; else if (char === "]") arrDepth--;
                if (char === "{") objDepth++; else if (char === "}") objDepth--;
            }

            if (char === "," && !quoted && !(arrDepth + objDepth)) {
                result.push(cur.trim()); cur = "";
            } else {
                cur += char;
            }
        }

        // if wing is dinging
        if (cur) result.push(cur.trim());
        return result.map(r => {
            if (isContained(r, "\"") || isContained(r, "'")) {
                return r.slice(1, -1).replace(/\\/g, "");
            }

            // tysm json parse <3
            try {
                return JSON.parse(r);
            } catch {
                return r;
            }
        });
    }

    // sends the parsed args to the callback function, returns the string result
    // very recommended to use the macro specific return type for the cb, unless you have a reason not to
    protected doExecute(input: string, callback: (args: any) => string): string {
        if (!input) return "";

        // if you thought the previous regex was bad , this is worse
        //  %$<name>         = macro name
        //  \\(              = lparen
        //  (?:
        //    [^()"']|       = non quote/paren
        //    "[^"]*"|       = double quote strig
        //    '[^']*'|       = single quote string
        //    \\([^()]*\\)   = escaped ()
        //  )*
        //  \)               = rparen
        // todo: to nobody's surprise i fucked up quotes, " ' " is an invalid string; this is probably an error inside of parseArgs
        return input.replace(new RegExp(`%${this.name}\\((?:[^()"']|"[^"]*"|'[^']*'|\\([^()]*\\))*\\)`, "g"), (match) => {
            // the other one is just to taje the shiiit out
            return callback(this.parseArgs(match.replace(new RegExp(`^%${this.name}\\(|\\)$`, "g"), "")));
        });
    }
}

// bless decorators !!!!!!! <3
// basically sets up the name and clears constructor when defining new macros, only need to implement execute
// plus args type manually and that's it ! xP
function MacroFor(name: string) {
    return function <C extends { new (...args: any[]): Macro }>(constructor: C) {
        return class extends constructor {
            name = name;
            constructor(...args: any[]) { super(...args); }
        } as C;
    };
}

// converts `%ref(NAME,TEXT,BTNS,SEP)` to `<a href="#NAME" class=ref title="NAME">INPUT</a>`
@MacroFor("ref")
export class RefMacro extends Macro {
    static Args: [
        name: string,               // What is this a reference to?
        text: string,               // The raw input string (e.g. "236S")
        btns: string[] | string,    // The button or buttons to color this input with
        sep?: string                // If there are many buttons, what separates them?
    ];

    execute(input: string): string {
        return super.doExecute(input, ([name, text, btns, sep]: typeof RefMacro.Args) => {
            const inputStr = renderInputString(text, btns, sep);
            return `<a href="#${safeID(name)}" class=ref title="${name}">${inputStr}</a>`;
        });
    }
}

// todo: reference should automatically gather text btns, etc from the move object that we store on init
// converts `%refOther(CHARACTER,NAME,CHARATEXT,MOVETEXT,BTNS,SEP)` to two <a.ref>s with character and move pages
@MacroFor("refOther")
export class RefOtherMacro extends Macro {
    static Args: [
        character: string,          // Who does this move belong to?
        name: string,               // What is this a reference to?
        charaText: string,          // The text to display for the character
        moveText: string,           // The raw input string (e.g. "236S")
        btns: string[] | string,    // The button or buttons to color this input with
        sep?: string                // If there are many buttons, what separates them?
    ];

    execute(input: string): string {
        return super.doExecute(input, ([chara, name, ctext, mtext, btns, sep]: typeof RefOtherMacro.Args) => {
            const inputStr = renderInputString(mtext, btns, sep);
            return `
                <a class="ref" href="../characters/${chara.toLowerCase()}.html" title="${chara}">${ctext}</a>
                <a class="ref" href="../characters/${chara.toLowerCase()}.html#${safeID(name)}" title="${name}">${inputStr}</a>
            `;
        });
    }
}

// todo: i wonder, can we create a utility to automatically extract buttons? this would be omega useful
// converts `%btn(BTN1BTN2...,TEXT,SEP)` to `<em class=btn button="BTN">TEXT</em>`
@MacroFor("btn")
export class BtnMacro extends Macro {
    static Args: [
        btns: string[] | string,    // The button or buttons to color this input with
        text: string,               // The raw input string (e.g. "236S")
        sep?: string                // If there are many buttons, what separates them?
    ];

    execute(input: string): string {
        return super.doExecute(input, ([btns, text, sep]: typeof BtnMacro.Args) => {
            return renderInputString(text, btns, sep).replace("em", "em class=btn");
        });
    }
}

// automatically renders an input/combo
@MacroFor("auto")
export class AutoMacro extends Macro {
    static Args: [
        input: string,              // The raw input string (e.g. "236S")
    ];

    execute(input: string): string {
        return super.doExecute(input, ([input]: typeof AutoMacro.Args) => {
            return autoResolveInput(input).map(({ part, color }) => {
                if (color) return `<em class=btn button="${color.toLowerCase()}">${part}</em>`;
                return `<em class=btn button="or">${part}</em>`;
            }).join("");
        });
    }
}

// converts `%url(URL,ALT,TEXT,EXTERNAL)` to `<a href="URL" title="ALT">TEXT</a>` or
// `<a href="URL" title="ALT" target="_blank" rel="noreferrer">TEXT</a>`
@MacroFor("url")
export class UrlMacro extends Macro {
    static Args: [
        url: string,                // The URL to link to
        alt: string,                // The alt text for the url
        text: string,               // Display text
        external?: boolean          // Does this link outside the wiki?
    ];

    execute(input: string, logger: Logger): string {
        return super.doExecute(input, ([url, alt, text, external]: typeof UrlMacro.Args) => {
            if (external) return `<a href="${url}" title="${alt}" target="_blank" rel="noreferrer">${text}</a>`;

            if (!fs.existsSync(`docs/${url}`)) logger.warn(`Could not find requested link target: ${url}`);
            return `<a href="../${url}" title="${alt}">${text}</a>`;
        });
    }
}

// converts `%img(PATH,ALT,NOTE)` to `<div class=embed><img src="../images/CHARACTER/PATH" alt="ALT"><p>NOTE</p></div>`
@MacroFor("img")
export class ImgMacro extends Macro {
    static Args: [
        path: string,                // Where the image is located relative to us
        alt: string,                 // Alt text for image
        note?: string                // Any comments?
    ];

    execute(input: string, logger: Logger, name?: string): string {
        return super.doExecute(input, ([path, alt, note]: typeof ImgMacro.Args) => {
            if (name) path = p.join(name.toLowerCase(), path);
            if (!fs.existsSync(p.join("docs", "images", path))) logger.warn(`Could not find requested image: ${path}`);

            return `<div class=embed><img src="${p.join("../", "images", path)}" alt="${alt}" title="${path}"><p>${note}</p></div>`;
        });
    }
}

// converts `%note(TEXT,DISPLAY)` to `<span class=note title="TEXT">DISPLAY</span>`
@MacroFor("note")
export class NoteMacro extends Macro {
    static Args: [
        text: string,                   // Tooltip content
        display: string                 // Text to apply the tooltip to
    ];

    execute(input: string): string {
        return super.doExecute(input, ([text, display]: typeof NoteMacro.Args) => {
            return `<span class=note title="${text}">${display}</span>`;
        });
    }
}

