import * as fs from "fs";
import * as p from "path";

import { Logger } from "./Logger.ts";
import { autoResolveInput, findByName, renderInputString } from "./Input.ts";
import { isContained, safeID } from "./String.ts";

import { Character } from "../character.ts";
import { characters } from "../index.ts";

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
        //    "[^"]*"|       = double quote string
        //    '[^']*'|       = single quote string
        //    \\([^()]*\\)   = escaped ()
        //  )*
        //  \)               = rparen
        // todo: to nobody's surprise i fucked up quotes, " ' " is an invalid string; this is probably an error inside of parseArgs
        return input.replace(new RegExp(`%${this.name}\\((?:[^()"']|"[^"]*"|'[^']*'|\\([^()]*\\))*\\)`, "g"), (match) => {
            // the other exp is just to take the shiiit out
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
        id: string,                 // What does this reference link to?
        text?: string,              // The raw input string (e.g. "236S") or move name
        btns?: string[] | string,   // The button or buttons to color this text with
        sep?: string                // If there are many buttons, what separates them?
    ];

    execute(input: string, character: Character): string {
        return super.doExecute(input, ([id, text, btns, sep]: typeof RefMacro.Args) => {
            if (!text || !btns) {
                const move = findByName(id, character);

                if (!text && move) text = move.Name || move.ID;
                if (!text && move && "Inputs" in move!) text = move.Inputs?.join(move.Separator);
                if (!btns && move && "Buttons" in move) btns = move.Buttons as string[];
            }

            const inputStr = renderInputString(text, btns, sep);
            return `<a href="#${safeID(id)}" class=ref title="${id}">${inputStr}</a>`;
        });
    }
}

// converts `%refOther(CHARACTER,NAME,CTEXT,MTEXT,BTNS,SEP)` to two <a.ref>s with character and move pages
@MacroFor("refOther")
export class RefOtherMacro extends Macro {
    static Args: [
        character: string,          // Who does this move belong to?
        id: string,                 // What does this reference link to?
        charaText?: string,         // The text to display for the character
        moveText?: string,          // The raw input string (e.g. "236S") or move name
        btns?: string[] | string,   // The button or buttons to color this input with
        sep?: string                // If there are many buttons, what separates them?
    ];

    execute(input: string): string {
        return super.doExecute(input, ([chara, id, ctext, mtext, btns, sep]: typeof RefOtherMacro.Args) => {
            const character = characters.filter(c => c.Name === chara)[0];
            if (!ctext && character) ctext = character.Name;

            if (!mtext || !btns) {
                const move = findByName(id, character);

                if (!mtext && move) mtext = move.Name;
                if (!mtext && move && "Inputs" in move!) mtext = move.Inputs?.join(move.Separator);
                if (!btns && move && "Buttons" in move) btns = move.Buttons as string[];
            }

            const inputStr = renderInputString(mtext, btns, sep);
            return `
                <a class="ref" href="../characters/${chara.toLowerCase()}.html" title="${chara}">${ctext}</a>
                <a class="ref" href="../characters/${chara.toLowerCase()}.html#${safeID(id)}" title="${id}">${inputStr}</a>
            `;
        });
    }
}

// converts `%btn(TEXT,BTN1BTN2...,SEP)` to `<em class=btn button="BTN">TEXT</em>`
@MacroFor("btn")
export class BtnMacro extends Macro {
    static Args: [
        text: string,               // The raw input string (e.g. "236S") or move name
        btns?: string[] | string,   // The button or buttons to color this input with
        sep?: string                // If there are many buttons, what separates them?
    ];

    execute(input: string, character: Character): string {
        return super.doExecute(input, ([text, btns, sep]: typeof BtnMacro.Args) => {
            // if btn wasn't provided, it's probably a move name so we'll just comb through and find something
            if (!btns) {
                const { Normals, Specials, Supers } = character;
                btns = [...Normals || [], ...Specials || [], ...Supers || []].find(move => move.Name === text)?.Buttons;
            }

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

