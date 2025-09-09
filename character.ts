import * as fs from "fs";

import { Macro, multicolor } from "./util/Macros.ts";
import { safeID } from "./util/util.ts";
import { FrameDataDefaults, type FrameData } from "./types/FrameData.ts";
import type { Mechanic, Move, Normal, Special, Super } from "./types/Move.ts";
import { characters } from "./index.ts";

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

    // adds an item to the table of contents (NOT THE MAIN NAVIGATION PANEL !!!)
    addNavigable(item: string, header: boolean = false, displayName: string = item): void {
        if (header) {
            this.tableOfContents += `<li class=header><a href="#${safeID(item)}">${displayName}</a></li>\n`;
        } else {
            this.tableOfContents += `<li><a href="#${safeID(item)}">${displayName}</a></li>\n`;
        }
    }

    // resolve macros into HTML elements
    resolveReferences(input: string): string {
        // reference to move
        // converts `%ref(NAME,INPUT,BTN)` to `<a href="#NAME" class=ref button="BTN" title="NAME">INPUT</a>`
        let result = new Macro("ref", 3).execute(input, ([name, input, btn]) => {
            return `<a href="#${safeID(name)}" class=ref button="${btn.toLowerCase()}" title="${name}">${input}</a>`;
        });

        // multicolored reference
        // colors the initial move with BTN1, colors the separator SEP black, and the rest with BTN<N>
        // converts `%mref(NAME,INPUT,BTN1BTN2...,SEP)` to `<a href="#NAME" class=ref button="BTN" title="NAME">INPUT</a>`
        result = new Macro("mref", 4).execute(result, ([name, input, btns, sep]) => {
            const inputStr = multicolor(input, btns, sep);
            return `<a href="#${safeID(name)}" class=ref button="${btns[0].toLowerCase()}" title="${name}">${inputStr}</a>`;
        });

        // button colored text
        // converts `%btn(BTN,TEXT)` to `<em class=btn button="BTN">TEXT</em>`
        result = new Macro("btn", 2).execute(result, ([btn, text]) => {
            return `<em class=btn button="${btn.toLowerCase()}">${text}</em>`;
        });

        // multi button culored text
        // converts `%mbtn(TEXT,BTN1BTN2...,SEP)` to `<em class=btn button="BTN">TEXT</em>`
        result = new Macro("mbtn", 3).execute(result, ([raw, buttons, sep]) => {
            const text = multicolor(raw, buttons, sep);
            return `<em class=btn button="${buttons[0].toLowerCase()}">${text}</em>`;
        });

        // site link reference
        // converts `%link(URL,ALT,TEXT)` to `<a href="URL" title="ALT">TEXT</a>`
        result = new Macro("link", 3).execute(result, ([url, alt, text]) => {
            if (!fs.existsSync(`docs/${url}`)) {
                console.warn("\x1b[33m%s\x1b[0m", `[${this.Name}] Could not find requested link target: ${url}`);
            }

            return `<a href="../${url}" title="${alt}">${text}</a>`;
        });

        // character image embed
        // converts `%img(PATH,ALT,NOTE)` to `<div class=embed><img src="../images/CHARACTER/PATH" alt="ALT"><p>NOTE</p></div>`
        result = new Macro("img", 3).execute(result, ([path, alt, note]) => {
            if (!fs.existsSync(`docs/images/${this.Name.toLowerCase()}/${path}`)) {
                console.warn("\x1b[33m%s\x1b[0m", `[${this.Name}] Could not embed requested image: ${path}`);
            }

            return `<div class=embed><img src="../images/${this.Name.toLowerCase()}/${path}" alt="${alt}" title="${path}"><p>${note}</p></div>`;
        });

        // note definition tooltip
        // converts `%note(TEXT,DISPLAY)` to `<span class=note title="TEXT">DISPLAY</span>`
        result = new Macro("note", 2).execute(result, ([text, display]) => {
            return `<span class=note title="${text}">${display}</span>`;
        });

        // external url
        // converts `%url(URL,ALT,TEXT)` to `<a href="URL" title="ALT" target="_blank" rel="noreferrer">TEXT</a>`
        result = new Macro("url", 3).execute(result, ([url, alt, text]) => {
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
                .replace(/%ID%/g, safeID(mechanic.ID ?? mechanic.Name))
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
                .replace(/%ID%/g, safeID(normal.ID ?? normal.Input))
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
                .replace(/%ID%/g, safeID(special.ID ?? special.Name))
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
                .replace(/%ID%/g, safeID(sup.ID ?? sup.Name))
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