import * as fs from "fs";

import { Macro, multicolor } from "./util/Macros.ts";
import { compareVersions, safeID } from "./util/util.ts";
import { FrameDataDefaults, type FrameData } from "./types/FrameData.ts";
import type { Mechanic, Move } from "./types/Move.ts";
import { characters, exportDir } from "./index.ts";
import type { MoveSection, SectionType, TextSection } from "./types/Section.ts";
import { Logger } from "./util/Logger.ts";

const characterTemplate = fs.readFileSync("templates/character/page.html", "utf8");
const moveTemplate = fs.readFileSync("templates/character/move.html", "utf8");

// todo: a lot of functionality is now based on a standard page component system
//    this class should instead extend a base Page class as we'll need these
//    components for other pages soon
// noinspection HtmlUnknownAnchorTarget
export class Character {
    private static readonly OVERVIEW_FIELDS: (keyof Character)[] = [
        "Name", "Description", "IconPath", "PortraitPath", "Type", "Stage", "Reversals"
    ];
    private static readonly STANDARD_SECTIONS: (keyof Character)[] = ["Mechanics", "Normals", "Specials", "Supers"];
    // TOML fields //
    Name: string;
    Description?: string;
    IconPath?: string;
    PortraitPath?: string;
    Type?: string;
    Stage?: string;
    Reversals?: string[];

    Mechanics?: Mechanic[];
    Normals?: Move[];
    Specials?: Move[];
    Supers?: Move[];
    // ------------ //

    logger: Logger;

    // section order and unique data
    sections: string[] = [];
    sectionData: { [key: string]: SectionType[] } = {};

    characterNav: string;
    characterNavActive: string;
    mainNav: string;

    tableOfContents: string = `<li><a href="#Overview">Overview</a></li>`;

    constructor(data: any) {
        this.Name = data.Name;
        this.Description = data.Description;
        this.IconPath = data.IconPath;
        this.PortraitPath = data.PortraitPath;
        this.Type = data.Type;
        this.Stage = data.Stage;
        this.Reversals = data.Reversals || [];

        // determine the section order based on how things appear in toml
        for (const [key, value] of Object.entries(data) as [keyof Character, any][]) {
            if (Character.OVERVIEW_FIELDS.includes(key as keyof Character)) continue;

            this.sections.push(key);
            if (Character.STANDARD_SECTIONS.includes(key as keyof Character)) {
                this[key] = value;
            } else {
                this.sectionData[key] = value;
            }
        }

        this.logger = new Logger(data.Name);

        // this can probably be done better but i don't care for now
        // for use in navigation bar on character pages
        this.characterNav = `<li><a href="./${data.Name.toLowerCase()}.html">${data.Name}</a></li>`;
        this.characterNavActive = `<li class=active><a>${data.Name}</a></li>`;

        // main page navigation bar
        this.mainNav = `<li><a href="characters/${data.Name.toLowerCase()}.html">${data.Name}</a></li>`;
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
    // todo: move elsewhere + ad optional arcs and merge macros
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

        // multi button colored text
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

    // reversals field of the info table7
    renderReversals(): string {
        if (!this.Reversals) return "<em button=x>None</em>";
        return this.Reversals.map((rev) => this.resolveReferences(rev)).join("<br>");
    }

    // adds Hold or Air OK to qualifying moves
    renderExtras(move: Move): string {
        const extras: string[] = [];
        if (move.HoldOK) extras.push("Hold");
        if (move.AirOK) extras.push("Air");

        return extras.length > 0 ? `(${extras.join(", ")} OK)` : "";
    }

    // creates an input string with appropriate coloring
    renderInputString(inputs?: string[], buttons?: string[], sep: string = "/", clean: boolean = false): string {
        if (!inputs) return inputs?.[0] ?? "";

        return inputs.flatMap((input, index, arr) => {
            let separator;
            if (index < arr.length - 1 && sep) separator = clean ? sep : `<em button=or>${sep}</em>`;

            return [ clean ? input : `<em button=${buttons?.[index] ?? "x"}>${input}</em>`, separator ];
        }).join("");
    }

    renderFrameData(data: FrameData[]): string {
        if (!data) return "";
        // as specified in FrameDataDefaults, only Version can be left unspecified. all other fields must remain
        const filled: FrameData[] = data.map((frame) => {
            const res: FrameData = { ...FrameDataDefaults, ...frame };
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

    // rendering a section
    // todo: sections aren't a character-specific feature, will be moved to a different
    //   class once finalized
    renderSection(data: SectionType[], name: string): string {
        if (!data) return "";

        const sectionHeader = `<h2 id=${safeID(name)}><a href=#${safeID(name)}>${name}</a></h2>`;
        this.addNavigable(name, true);

        return "<div class=section>" + sectionHeader + data.map((i) => {
            this.logger.log(`Generating documentation for custom item: ${i["Name" as keyof SectionType] ?? name}`);

            switch (i.Type) {
                case "Summary":
                    return `<span class=section-text>${this.resolveReferences(i.Description)}</span>`;
                case "Text": {
                    const item = i as TextSection;
                    const id = item.ID ?? item.Name;
                    this.addNavigable(id);

                    return `<a href=#${safeID(id)}><h3 id=${safeID(id)} class=move-name>${item.Name}</h3></a>\n` +
                        `<span class=section-text>${this.resolveReferences(i.Description)}</span>`;
                }
                case "Move": {
                    const item = i as MoveSection;
                    const name = item.Name ?? this.renderInputString(item.Inputs, item.Buttons, item.Separator) ?? "";
                    const id = item.ID ?? item.Name ??this.renderInputString(item.Inputs, item.Buttons, item.Separator, true) ?? "";
                    this.addNavigable(id);

                    return moveTemplate.replace(/%NAME%/g, name)
                        .replace(/%ID%/g, safeID(id))
                        .replace(/%EXTRA%/g, this.renderExtras(item))
                        .replace(/%INPUT%/g, this.renderInputString(item.Inputs, item.Buttons, item.Separator))
                        .replace(/%BUTTON%/g, item.Buttons?.[0] ?? "")
                        .replace(/%CONDITION%/g, item.Condition ? `<em button=x>${this.resolveReferences(item.Condition)}</em>` : "")
                        .replace(/%IMAGE%/g, this.renderImages(item.Images, id, item.ImageNotes))
                        .replace(/%HITBOX%/g, this.renderImages(item.Hitboxes, id, item.HitboxNotes))
                        .replace(/%FRAMEDATA%/g, this.renderFrameData(item.Data))
                        .replace(/%DESCRIPTION%/g, this.resolveReferences(item.Description));
                }
                default:
                    this.logger.error(`Unknown section type: ${i.Type}`);
                    return "";
            }
        }).join("") + "</div>";
    }

    // semi-final page generation before populating navbar and update time
    render(): string {
        this.logger.log("Generating character page...");

        const rendered = characterTemplate.replace(/%NAME%/g, this.Name)
            .replace(/%DESCRIPTION%/g, this.resolveReferences(this.Description || ""))
            .replace(/%PORTRAITPATH%/g, `../images/${this.Name.toLowerCase()}/${this.PortraitPath}`)
            .replace(/%ICONPATH%/g, `../images/${this.Name.toLowerCase()}/${this.IconPath}`)
            .replace(/%TYPE%/g, this.Type || "")
            .replace(/%STAGE%/g, this.Stage || "")
            .replace(/%REVERSALS%/g, this.renderReversals())
            .replace(/%BODY%/g, this.sections.map((section) => {
                switch (section) {
                    case "Mechanics":   return this.renderSection(this.Mechanics as TextSection[], "Mechanics");
                    case "Normals":     return this.renderSection(this.Normals as MoveSection[], "Command Normals");
                    case "Specials":    return this.renderSection(this.Specials as MoveSection[], "Special Attacks");
                    case "Supers":      return this.renderSection(this.Supers as MoveSection[], "Supers");
                    default:            return this.renderSection(this.sectionData[section], section);
                }
            }).join(""))
            .replace(/%TABLE_OF_CONTENTS%/g, this.tableOfContents)
            .replace("%CHARALIST%", characters.map((character) =>
                character === this ? character.characterNavActive : character.characterNav
            ).join(""));

        // pages should only update if there are changes in content
        if (!compareVersions(`${exportDir}characters/${this.Name.toLowerCase()}.html`, rendered)) {
            this.logger.log("No changes detected, skipping character page generation.");
            return "";
        }

        return rendered.replace("%DATE%", new Date().toDateString())
            .replace("%TIME%", new Date().toLocaleTimeString())
            .replace("%TZ%", new Date().toLocaleTimeString("en-us", { timeZoneName: "short" }).split(" ")[2]);
    }
}