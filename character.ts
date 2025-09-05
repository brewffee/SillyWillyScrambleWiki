import * as fs from "fs";
import { characters } from "./index.ts";

interface FrameData {
    Version?: string;
    Damage: string;
    Guard: string;
    Startup: string;
    Active: string;
    Recovery: string;
    OnBlock: string;
    Invuln: string[];
    SpecialFrames?: number[];
    SpecialNote?: string;
}

const FrameDataDefaults: FrameData = {
    Version: undefined,
    Damage: "",
    Guard: "",
    Startup: "",
    Active: "",
    Recovery: "",
    OnBlock: "",
    Invuln: [],
};

interface Normal {
    ID?: string;
    Input: string;
    Button: string;
    AirOK?: boolean;
    HoldOK?: boolean;
    Condition?: string;
    Images: string[];
    ImageNotes?: string[];
    Hitboxes: string[];
    HitboxNotes?: string[];
    Description: string;

    Data: FrameData[];
}

interface Special extends Omit<Normal, "Input" | "Button"> {
    Name: string;
    Inputs: string[];
    Buttons: string[];
}

type Super = Special;
type Move = Normal | Special | Super;

interface Mechanic {
    Name: string;
    Description: string;
    ID?: string;
}

const characterTemplate = fs.readFileSync("templates/character/page.html", "utf8");
const mechanicTemplate = fs.readFileSync("templates/character/mechanic.html", "utf8");
const normalTemplate = fs.readFileSync("templates/character/normal.html", "utf8");
const specialTemplate = fs.readFileSync("templates/character/special.html", "utf8");

//noinspection HtmlUnknownAnchorTarget
export class Character {
    // TOML fields //
    Name: string;
    Description: string;
    IconPath: string;
    PortraitPath: string;
    Type: string;
    Reversals: string[];

    Mechanics: Mechanic[];
    Normals: Normal[];
    CommandNormals: Normal[];
    Specials: Special[];
    Supers: Super[];
    // ------------ //

    characterNav: string;
    characterNavActive: string;
    mainNav: string;

    tableOfContents: string;

    constructor(data: any) {
        this.Name = data.Name;
        this.Description = data.Description;
        this.IconPath = data.IconPath;
        this.PortraitPath = data.PortraitPath;
        this.Type = data.Type;
        this.Reversals = data.Reversals;

        this.Mechanics = data.Mechanics;
        this.Normals = data.Normals;
        this.CommandNormals = data.CommandNormals;
        this.Specials = data.Specials;
        this.Supers = data.Supers;

        // this can probably be done better but i don't care for now
        // for use in navigation bar on character pages
        this.characterNav = `<li><a href="./${this.Name.toLowerCase()}.html">${this.Name}</a></li>`;
        this.characterNavActive = `<li class=active><a>${this.Name}</a></li>`;

        // main page navigation bar
        this.mainNav = `<li><a href="characters/${this.Name.toLowerCase()}.html">${this.Name}</a></li>`;

        this.tableOfContents = `<li><a href="#Overview">Overview</a></li>`;
    }

    // safely converts a string to a valid HTML ID
    safeID(input: string): string {
        return input.replace(/ /g, "-").replace(/[^a-zA-Z0-9-.]/g, "");
    }

    // adds an item to the table of contents (NOT THE MAIN NAVIGATION PANEL !!!)
    addNavigable(item: string, header: boolean = false, displayName: string = item): void {
        if (header) {
            this.tableOfContents += `<li class=header><a href="#${this.safeID(item)}">${displayName}</a></li>`;
        } else {
            this.tableOfContents += `<li><a href="#${this.safeID(item)}">${displayName}</a></li>`;
        }
    }

    // resolve macros into HTML elements
    resolveReferences(input: string): string {
        // todo: this and other utility functions might be moved outside into a separate utils file
        // utility to parse macro arguments while respecting escaped special chars
        function parseArgs(args: string[], amt: number): string[] {
            const parsed: string[] = [];
            const str = args.slice(0, amt).join(",");

            let current = "", escaped = false;
            for (const char of str) {
                if (escaped) {
                    current += char;
                    escaped = false;
                } else if (char === "\\") {
                    escaped = true;
                } else if (char === ",") {
                    parsed.push(current);
                    current = "";
                } else {
                    current += char;
                }
            }

            parsed.push(current);
            return parsed;
        }

        // creates macros for me because man i dont like looking at those regexes
        function macroRegex(name: string, amt: number): RegExp {
            // %name(...) (?:[^\\)]|\\.)*
            const pattern = "((?:[^\\\\)]|\\\\.)*)"; // do you like backslashes ?? i dont
            const params = Array(amt).fill(pattern).join(",");
            return new RegExp(`%${name}\\(${params}\\)`, "g");
        }

        // colors an input string with multiple colors
        function multicolor(rawInput: string, buttonsArg: string, sep: string) {
            const buttons = buttonsArg.split("");
            const inputs = rawInput.split(sep);

            for (let i = 0; i < buttons.length; i++) {
                inputs[i] = `<em button=${buttons[i].toLowerCase()}>${inputs[i]}</em>`;
            }

            return inputs.join(`<em button=or>${sep}</em>`);
        }

        // specific move reference
        // converts instances of %ref(NAME,INPUT,BTN) to <a href="#NAME" class=ref button="BTN" title="NAME">INPUT</a>
        let result = input.replace(macroRegex("ref", 3), (_, ...args) => {
            const [name, inputStr, button] = parseArgs(args, 3);
            return `<a href="#${this.safeID(name)}" class=ref button="${button.toLowerCase()}" title="${name}">${inputStr}</a>`;
        });

        // specific move reference with multi-colored input, useful for followup moves
        // colors the initial move with BTN1, colors the separator SEP black, and the rest with BTN<N>
        // converts instances of %mref(NAME,INPUT,BTN1BTN2,SEP) to <a href="#NAME" class=ref button="BTN" title="NAME">INPUT</a>
        result = result.replace(macroRegex("mref", 4), (_, ...args) => {
            const [name, rawInput, buttons, sep] = parseArgs(args, 4);
            const inputStr = multicolor(rawInput, buttons, sep);

            return `<a href="#${this.safeID(name)}" class=ref button="${buttons[0].toLowerCase()}" title="${name}">${inputStr}</a>`;
        });

        // weak button reference
        // converts instances of %btn(BTN, TEXT) to <em class=btnbutton="BTN">TEXT</em>
        result = result.replace(macroRegex("btn", 2), (_, ...args) => {
            const [button, text] = parseArgs(args, 2);
            return `<em class=btn button="${button.toLowerCase()}">${text}</em>`;
        });

        // weak button reference, similar to mref
        // converts instances of %mbtn(TEXT,BTN1BTN2,SEP) to <em class=btnbutton="BTN">TEXT</em>
        result = result.replace(macroRegex("mbtn", 3), (_, ...args) => {
            const [rawText, buttons, sep] = parseArgs(args, 3);
            const text = multicolor(rawText, buttons, sep);
            return `<em class=btn button="${buttons[0].toLowerCase()}">${text}</em>`;
        });

        // external link reference
        // converts instances of %link(URL, ALT, TEXT) to <a href="URL" title="ALT">TEXT</a>
        result = result.replace(macroRegex("link", 3), (_, ...args) => {
            const [url, alt, text] = parseArgs(args, 3);
            if (!fs.existsSync(`docs/${url}`)) {
                console.warn("\x1b[33m%s\x1b[0m", `[${this.Name}] Could not find requested link target: ${url}`);
            }
            return `<a href="../${url}" title="${alt}">${text}</a>`;
        });

        // image embed
        // converts instances of %img(PATH, ALT, NOTE) to:
        // <div class=embed><img src="../images/CHARACTER/PATH" alt="ALT"><p>NOTE</p></div>
        result = result.replace(macroRegex("img", 3), (_, ...args) => {
            const [path, alt, note] = parseArgs(args, 3);
            if (!fs.existsSync(`docs/images/${this.Name.toLowerCase()}/${path}`)) {
                console.warn("\x1b[33m%s\x1b[0m", `[${this.Name}] Could not embed requested image: ${path}`);
            }
            return `<div class=embed><img src="../images/${this.Name.toLowerCase()}/${path}" alt="${alt}" title="${path}"><p>${note}</p></div>`;
        });

        // note, briefly explains a term
        // converts instances of %note(TEXT, DISPLAY) to <span class=note title="TEXT">DISPLAY</span>
        result = result.replace(macroRegex("note", 2), (_, ...args) => {
            const [text, display] = parseArgs(args, 2);
            return `<span class=note title="${text}">${display}</span>`;
        });

        // url, links to an external source and opens in new tab
        // converts instances of %url(URL, ALT, TEXT) to <a href="URL" title="ALT" target="_blank" rel="noreferrer">TEXT</a>
        result = result.replace(macroRegex("url", 3), (_, ...args) => {
            const [url, alt, text] = parseArgs(args, 3);
            return `<a href="${url}" title="${alt}" target="_blank" rel="noreferrer">${text}</a>`;
        });

        return result;
    }

    // reversals field of the info table
    renderReversals(): string {
        if (!this.Reversals) return "<em button=x>None</em>";
        return this.Reversals.map((rev) => this.resolveReferences(rev)).join("<br>");
    }

    // adds Hold or Air OK to qualifying moves
    renderExtras(move: Move): string {
        const extras: string[] = [];
        if (move.HoldOK) extras.push("Hold");
        if (move.AirOK) extras.push("Air");

        return extras.length > 0 ? ` (${extras.join(", ")} OK)` : "";
    }

    // utility for moves with multiple inputs (ex 236P/K/S)
    renderInputString(inputs: string[], buttons: string[]): string {
        let inputStr = inputs[0];
        for (let i = 1; i < buttons.length; i++) {
            if (buttons.length !== inputs.length) return ""; // what are u doing ????
            inputStr += `<em button=or>/</em><em button=${buttons[i]}>${inputs[i]}</em>`;
        }
        return inputStr;
    }

    renderFrameData(data: FrameData[]): string {
        // ass specified in FrameDataDefaults, only Version can be left unspecified. all other fields must remain
        const filled: FrameData[] = data.map((frame) => {
            const res: FrameData = {...FrameDataDefaults, ...frame};
            if (res.Version === undefined) delete res.Version;
            return res;
        });

        return `<div class=frame-table>${this.renderTable(filled)}</div>`;
    }

    renderTable(data: any[]): string {
        if (!data) return "";
        let table = "<table>\n";

        // thead
        const keys = Object.keys(data[0]);
        table += "<thead><tr>" + keys.map((key) => `<th>${key}</th>`).join("\n") + "</tr></thead>\n";

        // tbody
        table += "<tbody>\n" + data.map((item) => {
            return "<tr>" + keys.map((key) => {
                const value = item[key];
                return Array.isArray(value) ? `<td>${value.join("<br>")}</td>` : `<td>${value}</td>`;
            }).join("\n") + "</tr>\n";
        }).join("") + "</tbody>\n</table>";

        return table;
    }

    // creates the image gallery
    renderImages(images: string[], name: string, notes?: string[]): string {
        if (!images) return "";
        let imageStr = "";
        for (let i = 0; i < images.length; i++) {
            if (!fs.existsSync(`docs/images/${this.Name.toLowerCase()}/${images[i]}`)) {
                console.warn("\x1b[33m%s\x1b[0m", `[${this.Name}] Could not find requested image: ${images[i]}`);
            }

            imageStr += `<img src="../images/${this.Name.toLowerCase()}/${images[i]}" alt="${name} Sprite ${i>0?i+1:''}" title="${images[i]}">\n`;
            if (notes?.[i]) imageStr += `<span class=image-note>${this.resolveReferences(notes[i])}</span>`;
        }
        return imageStr;
    }

    // character specific mechanics
    renderMechanics(mechanics: Mechanic[]): string {
        if (!mechanics) return "";
        const mechanicsHeader = "<h2 id=Mechanics><a href=#Mechanics>Unique Mechanics</a></h2>\n";
        this.addNavigable("Mechanics", true);

        return mechanicsHeader + mechanics.map((mechanic) => {
            console.log(`[${this.Name}] Generating documentation for mechanic: ${mechanic.Name}`);
            this.addNavigable(mechanic.Name);

            return mechanicTemplate.replace(/%MECHANIC%/g, mechanic.Name)
                .replace(/%ID%/g, this.safeID(mechanic.ID ?? mechanic.Name))
                .replace(/%MECHANIC_DESCRIPTION%/g, this.resolveReferences(mechanic.Description));
        }).join("");
    }

    renderCommandNormals(normals: Normal[]): string {
        if (!normals) return "";
        const normalsHeader = "<h2 id=Command-Normals><a href=#Command-Normals>Command Normals</a></h2>\n";
        this.addNavigable("Command Normals", true);

        return normalsHeader + normals.map((normal) => {
            console.log(`[${this.Name}] Generating documentation for command normal: ${normal.Input}`);
            this.addNavigable(normal.ID ?? normal.Input);

            return normalTemplate.replace(/%INPUT%/g, normal.Input)
                .replace(/%ID%/g, this.safeID(normal.ID ?? normal.Input))
                .replace(/%EXTRA%/g, this.renderExtras(normal))
                .replace(/%CONDITION%/g, normal.Condition ? ` <em button=x>${this.resolveReferences(normal.Condition)}</em>` : "")
                .replace(/%BUTTON%/g, normal.Button)
                .replace(/%IMAGE%/g, this.renderImages(normal.Images, normal.Input, normal.ImageNotes))
                .replace(/%HITBOX%/g, this.renderImages(normal.Hitboxes, normal.Input, normal.HitboxNotes))
                .replace(/%FRAMEDATA%/g, this.renderFrameData(normal.Data))
                .replace(/%DESCRIPTION%/g, this.resolveReferences(normal.Description));
        }).join("");
    }

    // special moves (attacks that have a name or more complex inputs)
    renderSpecials(specials: Special[]): string {
        if (!specials) return "";
        const specialsHeader = "<h2 id=Special-Attacks><a href=#Special-Attacks>Special Attacks</a></h2>\n";
        this.addNavigable("Special Attacks", true);

        return specialsHeader + specials.map((special) => {
            console.log(`[${this.Name}] Generating documentation for special move: ${special.Name}`);
            this.addNavigable(special.ID ?? special.Name);

            return specialTemplate.replace(/%NAME%/g, special.Name)
                .replace(/%ID%/g, this.safeID(special.ID ?? special.Name))
                .replace(/%EXTRA%/g, this.renderExtras(special))
                .replace(/%BUTTON%/g, special.Buttons[0])
                .replace(/%INPUT%/g, this.renderInputString(special.Inputs, special.Buttons))
                .replace(/%CONDITION%/g, special.Condition ? ` <em button=x>${this.resolveReferences(special.Condition)}</em>` : "")
                .replace(/%IMAGE%/g, this.renderImages(special.Images, special.Name, special.ImageNotes))
                .replace(/%HITBOX%/g, this.renderImages(special.Hitboxes, special.Name, special.HitboxNotes))
                .replace(/%FRAMEDATA%/g, this.renderFrameData(special.Data))
                .replace(/%DESCRIPTION%/g, this.resolveReferences(special.Description));
        }).join("");
    }

    // supers
    renderSupers(supers: Super[]): string {
        if (!supers) return "";
        const supersHeader = "<h2 id=Supers><a href=#Supers>Supers</a></h2>\n";
        this.addNavigable("Supers", true);

        return supersHeader + supers.map((sup) => {
            console.log(`[${this.Name}] Generating documentation for super: ${sup.Name}`);
            this.addNavigable(sup.ID ?? sup.Name);

            return specialTemplate.replace(/%NAME%/g, sup.Name)
                .replace(/%ID%/g, this.safeID(sup.ID ?? sup.Name))
                .replace(/%EXTRA%/g, this.renderExtras(sup))
                .replace(/%BUTTON%/g, sup.Buttons[0])
                .replace(/%INPUT%/g, this.renderInputString(sup.Inputs, sup.Buttons))
                .replace(/%CONDITION%/g, sup.Condition ? `<em button=x>${this.resolveReferences(sup.Condition)}</em>` : "")
                .replace(/%IMAGE%/g, this.renderImages(sup.Images, sup.Name, sup.ImageNotes))
                .replace(/%HITBOX%/g, this.renderImages(sup.Hitboxes, sup.Name, sup.HitboxNotes))
                .replace(/%FRAMEDATA%/g, this.renderFrameData(sup.Data))
                .replace(/%DESCRIPTION%/g, this.resolveReferences(sup.Description));
        }).join("");
    }

    // semi-final page generation before populating navbar and update time
    render(): string {
        return characterTemplate.replace(/%NAME%/g, this.Name)
            .replace(/%DESCRIPTION%/g, this.resolveReferences(this.Description))
            .replace(/%PORTRAITPATH%/g, `../images/${this.Name.toLowerCase()}/${this.PortraitPath}`)
            .replace(/%ICONPATH%/g, `../images/${this.Name.toLowerCase()}/${this.IconPath}`)
            .replace(/%TYPE%/g, this.Type)
            .replace(/%REVERSALS%/g, this.renderReversals())
            .replace(/%MECHANICS%/g, this.renderMechanics(this.Mechanics))
            .replace(/%COMMAND_NORMALS%/g, this.renderCommandNormals(this.Normals))
            .replace(/%SPECIALS%/g, this.renderSpecials(this.Specials))
            .replace(/%SUPERS%/g, this.renderSupers(this.Supers))
            .replace(/%TABLE_OF_CONTENTS%/g, this.tableOfContents)
            .replace("%CHARALIST%", characters.map((character) =>
                character === this ? character.characterNavActive : character.characterNav
            ).join(""));

    }
}