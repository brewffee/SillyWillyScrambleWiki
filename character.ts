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

    // section order and unique data
    sections: string[] = [];
    sectionData: { [key: string]: any } = {}; // todo: me when i use any type because im lazee

    characterNav: string;
    characterNavActive: string;
    mainNav: string;

    tableOfContents: string;

    constructor(data: any) {
        // key order now hinges on toml
        for (const key of Object.keys(data) as (keyof Character)[]) {
            const ignored: (keyof Character)[] = ["Name", "Description", "IconPath", "PortraitPath", "Type", "Reversals"];
            if (ignored.includes(key)) continue;

            // preserves section order
            const standard: (keyof Character)[] = ["Mechanics", "Normals", "Specials", "Supers"];
            this.sections.push(key);

            if (standard.includes(key as keyof Character)) {
                this[key] = data[key];
            } else {
                this.sectionData[key] = data[key];
            }

        }

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
    renderInputString(inputs: string[] | undefined, buttons: string[] | undefined): string {
        if (!buttons || !inputs) return inputs?.[0] ?? "";
        let inputStr = inputs[0];
        for (let i = 1; i < buttons.length; i++) {
            if (buttons.length !== inputs.length) return ""; // what are u doing ????
            inputStr += `<em button=or>/</em><em button=${buttons[i]}>${inputs[i]}</em>`;
        }
        return inputStr;
    }

    renderFrameData(data: FrameData[]): string {
        if (!data) return "";
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
    // todo: if there are no hitboxes, the button should be removed here
    //   in other words, automatically add the hitbox button inside this func
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

        return "<div class=mechanics>" + mechanicsHeader + mechanics.map((mechanic) => {
            console.log(`[${this.Name}] Generating documentation for mechanic: ${mechanic.Name}`);
            this.addNavigable(mechanic.Name);

            return mechanicTemplate.replace(/%MECHANIC%/g, mechanic.Name)
                .replace(/%ID%/g, safeID(mechanic.ID ?? mechanic.Name))
                .replace(/%MECHANIC_DESCRIPTION%/g, this.resolveReferences(mechanic.Description));
        }).join("") + "</div>";
    }

    renderCommandNormals(normals: Normal[]): string {
        if (!normals) return "";
        const normalsHeader = "<h2 id=Command-Normals><a href=#Command-Normals>Command Normals</a></h2>\n";
        this.addNavigable("Command Normals", true);

        return "<div class=command-normals>" + normalsHeader + normals.map((normal) => {
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
        }).join("") + "</div>";
    }

    // special moves (attacks that have a name or more complex inputs)
    renderSpecials(specials: Special[]): string {
        if (!specials) return "";
        const specialsHeader = "<h2 id=Special-Attacks><a href=#Special-Attacks>Special Attacks</a></h2>\n";
        this.addNavigable("Special Attacks", true);

        return "<div class=specials>" + specialsHeader + specials.map((special) => {
            console.log(`[${this.Name}] Generating documentation for special move: ${special.Name}`);
            this.addNavigable(special.ID ?? special.Name);

            return specialTemplate.replace(/%NAME%/g, special.Name)
                .replace(/%ID%/g, safeID(special.ID ?? special.Name))
                .replace(/%EXTRA%/g, this.renderExtras(special))
                .replace(/%BUTTON%/g, special.Buttons ? special.Buttons[0] : "")
                .replace(/%INPUT%/g, this.renderInputString(special.Inputs, special.Buttons))
                .replace(/%CONDITION%/g, special.Condition ? ` <em button=x>${this.resolveReferences(special.Condition)}</em>` : "")
                .replace(/%IMAGE%/g, this.renderImages(special.Images, special.Name, special.ImageNotes))
                .replace(/%HITBOX%/g, this.renderImages(special.Hitboxes, special.Name, special.HitboxNotes))
                .replace(/%FRAMEDATA%/g, this.renderFrameData(special.Data))
                .replace(/%DESCRIPTION%/g, this.resolveReferences(special.Description));
        }).join("") + "</div>";
    }

    // supers
    renderSupers(supers: Super[]): string {
        if (!supers) return "";
        const supersHeader = "<h2 id=Supers><a href=#Supers>Supers</a></h2>\n";
        this.addNavigable("Supers", true);

        return "<div class=supers>" + supersHeader + supers.map((sup) => {
            console.log(`[${this.Name}] Generating documentation for super: ${sup.Name}`);
            this.addNavigable(sup.ID ?? sup.Name);

            return specialTemplate.replace(/%NAME%/g, sup.Name)
                .replace(/%ID%/g, safeID(sup.ID ?? sup.Name))
                .replace(/%EXTRA%/g, this.renderExtras(sup))
                .replace(/%BUTTON%/g, sup.Buttons ? sup.Buttons[0] : "")
                .replace(/%INPUT%/g, this.renderInputString(sup.Inputs, sup.Buttons))
                .replace(/%CONDITION%/g, sup.Condition ? `<em button=x>${this.resolveReferences(sup.Condition)}</em>` : "")
                .replace(/%IMAGE%/g, this.renderImages(sup.Images, sup.Name, sup.ImageNotes))
                .replace(/%HITBOX%/g, this.renderImages(sup.Hitboxes, sup.Name, sup.HitboxNotes))
                .replace(/%FRAMEDATA%/g, this.renderFrameData(sup.Data))
                .replace(/%DESCRIPTION%/g, this.resolveReferences(sup.Description));
        }).join("") + "</div>";
    }

    // rendering a custom section
    renderSection(data: any[], name: string): string {
        if (!data) return "";

        const sectionHeader = `<h2 id=${safeID(name)}><a href=#${safeID(name)}>${name}</a></h2>`;
        this.addNavigable(name, true);

        return "<div class=custom>" + sectionHeader + data.map((item) => {
            switch (item["Type"]) {
                case "Description":
                    return `<p>${this.resolveReferences(item["Description"])}</p>`;
                case "Move":
                    this.addNavigable(item["ID"] ?? item["Name"]);
                    return specialTemplate.replace(/%NAME%/g, item["Name"])
                        .replace(/%ID%/g, safeID(item["ID"] ?? item["Name"]))
                        .replace(/%EXTRA%/g, this.renderExtras(item))
                        .replace(/%BUTTON%/g, item["Buttons"]?.[0] ?? "")
                        .replace(/%INPUT%/g, this.renderInputString(item["Inputs"], item["Buttons"]?.[0] ?? ""))
                        .replace(/%CONDITION%/g, item["Condition"] ? `<em button=x>${this.resolveReferences(item["Condition"])}</em>` : "")
                        .replace(/%IMAGE%/g, this.renderImages(item["Images"], item["Name"], item["ImageNotes"]))
                        .replace(/%HITBOX%/g, this.renderImages(item["Hitboxes"], item["Name"], item["HitboxNotes"]))
                        .replace(/%FRAMEDATA%/g, this.renderFrameData(item["Data"]))
                        .replace(/%DESCRIPTION%/g, this.resolveReferences(item["Description"]));

            }
        }).join("") + "</div>";
    }

    // semi-final page generation before populating navbar and update time
    render(): string {
        return characterTemplate.replace(/%NAME%/g, this.Name)
            .replace(/%DESCRIPTION%/g, this.resolveReferences(this.Description))
            .replace(/%PORTRAITPATH%/g, `../images/${this.Name.toLowerCase()}/${this.PortraitPath}`)
            .replace(/%ICONPATH%/g, `../images/${this.Name.toLowerCase()}/${this.IconPath}`)
            .replace(/%TYPE%/g, this.Type)
            .replace(/%REVERSALS%/g, this.renderReversals())
            .replace(/%BODY%/g, this.sections.map((section) => {
                switch (section) {
                    case "Mechanics":   return this.renderMechanics(this.Mechanics);
                    case "Normals":     return this.renderCommandNormals(this.Normals);
                    case "Specials":    return this.renderSpecials(this.Specials);
                    case "Supers":      return this.renderSupers(this.Supers);
                    default:            return this.renderSection(this.sectionData[section], section);
                }
            }).join(""))
            .replace(/%TABLE_OF_CONTENTS%/g, this.tableOfContents)
            .replace("%CHARALIST%", characters.map((character) =>
                character === this ? character.characterNavActive : character.characterNav
            ).join(""));
    }
}