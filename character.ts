import * as fs from "fs";

import type { FrameData } from "./types/FrameData.ts";
import type { Mechanic, Move } from "./types/Move.ts";
import type { MoveSection, SectionType, TextSection } from "./types/Section.ts";

import { ReferenceContext, resolveReferences } from "./util/Macros.ts";
import { Logger } from "./util/Logger.ts";
import { renderInputString } from "./util/Input.ts";
import { safeID } from "./util/String.ts";
import { compareVersions } from "./util/util.ts";

import { FrameDataDefaults } from "./types/FrameData.ts";
import { characters, exportDir } from "./index.ts";

import { TableProvider } from "./components/Table.ts";

const characterTemplate = fs.readFileSync("templates/character/page.html", "utf8");
const moveTemplate = fs.readFileSync("templates/character/move.html", "utf8");

// todo: a lot of functionality is now based on a standard page component system
//    this class should instead extend a base Page class as we'll need these
//    components for other pages soon
// noinspection HtmlUnknownAnchorTarget
export class Character {
    private static readonly OVERVIEW_FIELDS: (keyof Character)[] = [
        "Name", "Description", "IconPath", "PortraitPath", "Type",
        "Health", "MoveSpeed", "UniqueMovement", "Stage", "Reversals"
    ];
    private static readonly STANDARD_SECTIONS: (keyof Character)[] = ["Mechanics", "Normals", "Specials", "Supers"];
    // TOML fields //
    Name: string;
    Description?: string;
    IconPath?: string;
    PortraitPath?: string;
    Type?: string;
    Health?: string;
    MoveSpeed?: string;
    UniqueMovement?: string[];
    Stage?: string;
    Reversals?: string[];

    Mechanics?: Mechanic[];
    Normals?: Move[];
    Specials?: Move[];
    Supers?: Move[];
    // ------------ //

    logger: Logger;
    ctx: ReferenceContext;
    tableProvider: TableProvider;

    // section order and unique data
    sections: string[] = [];
    sectionData: { [key: string]: SectionType[] } = {};

    characterNav: string;
    characterNavActive: string;
    mainNav: string;

    tableOfContents: string = `<li><a href="#Overview">Overview</a></li>`;

    constructor(data: any) {
        this.Name = data.Name;
        this.Description = data.Description || "";
        this.IconPath = data.IconPath || "";
        this.PortraitPath = data.PortraitPath || "";
        this.Type = data.Type || "";
        this.Health = data.Health;
        this.MoveSpeed = data.MoveSpeed;
        this.UniqueMovement = data.UniqueMovement;
        this.Stage = data.Stage || "";
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
        this.ctx = { chara: this, logger: this.logger, name: this.Name };
        this.tableProvider = new TableProvider(this.ctx);

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

    // adds Hold or Air OK to qualifying moves
    renderExtras(move: Move): string {
        const extras: string[] = [];
        if (move.HoldOK) extras.push("Hold");
        if (move.AirOK) extras.push("Air");

        return extras.length > 0 ? `(${extras.join(", ")} OK)` : "";
    }

    renderFrameData(data: FrameData[]): string {
        if (!data) return "";
        // as specified in FrameDataDefaults, only Version can be left unspecified. all other fields must remain
        const filled: FrameData[] = data.map((frame) => {
            const res: FrameData = { ...FrameDataDefaults, ...frame };
            if (res.Version === undefined) delete res.Version;
            return res;
        });

        return this.tableProvider.create(filled);
    }

    // creates the image gallery
    renderImages(images: string[], name: string, notes?: string[], isHitbox: boolean = false): string {
        if (!images) return "";
        let imageStr = "";
        for (let i = 0; i < images.length; i++) {
            if (!fs.existsSync(`docs/images/${this.Name.toLowerCase()}/${images[i]}`)) {
                console.warn("\x1b[33m%s\x1b[0m", `[${this.Name}] Could not find requested image: ${images[i]}`);
            }

            imageStr += `<img src="../images/${this.Name.toLowerCase()}/${images[i]}" alt="${name} ${isHitbox?'Hitbox':'Sprite'} ${i>0?i+1:''}" title="${images[i]}">\n`;
            if (notes?.[i]) imageStr += `<span class=image-note>${resolveReferences(notes[i], this.ctx)}</span>`;
        }

        imageStr = `<div class=${isHitbox?'hitbox':'image'}-container>${imageStr}</div>`;
        if (isHitbox) {
            imageStr += `<div class=hitbox-toggle>
            <input type=checkbox id="${safeID(name)}-hitbox-toggle" class=hitbox-checkbox hidden>
            <label for="${safeID(name)}-hitbox-toggle" class=hitbox-btn>Hitbox</label>
          </div>`;
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
                    return `<span class=section-text>${resolveReferences(i.Description, this.ctx)}</span>`;
                case "Text": {
                    const item = i as TextSection;
                    const id = item.ID ?? item.Name;
                    this.addNavigable(id, false, item.Name);

                    return `<a href=#${safeID(id)}><h3 id=${safeID(id)} class=move-name>${item.Name}</h3></a>\n` +
                        `<span class=section-text>${resolveReferences(i.Description, this.ctx)}</span>`;
                }
                case "Move": {
                    const item = i as MoveSection;
                    const inputString = renderInputString(item.Inputs, item.Buttons, item.Separator);
                    const rawInputString = renderInputString(item.Inputs, item.Buttons, item.Separator, true);

                    const name = item.Name ?? inputString ?? "";
                    const rawName = item.Name ?? rawInputString ?? "";
                    const id = item.ID ?? item.Name ?? rawInputString ?? "";
                    this.addNavigable(id, false, rawName);

                    return moveTemplate.replace(/%NAME%/g, name)
                        .replace(/%ID%/g, safeID(id))
                        .replace(/%EXTRA%/g, this.renderExtras(item))
                        .replace(/%INPUT%/g, inputString)
                        .replace(/%BUTTON%/g, item.Buttons?.[0] ?? "")
                        .replace(/%CONDITION%/g, item.Condition ? resolveReferences(item.Condition, this.ctx) : "")
                        .replace(/%IMAGE%/g, this.renderImages(item.Images, id, item.ImageNotes))
                        .replace(/%HITBOX%/g, this.renderImages(item.Hitboxes, id, item.HitboxNotes, true))
                        .replace(/%FRAMEDATA%/g, this.renderFrameData(item.Data))
                        .replace(/%DESCRIPTION%/g, resolveReferences(item.Description, this.ctx));
                }
                default:
                    this.logger.error(`Unknown section type: ${i.Type}`);
                    return "";
            }
        }).join("") + "</div>";
    }

    // todo: in replacement lists, add the amount of whitespace before the placeholder ( i like neatness !! )
    // semi-final page generation before populating navbar and update time
    render(): string {
        this.logger.log("Generating character page...");

        const rendered = characterTemplate.replace(/%NAME%/g, this.Name)
            .replace(/%DESCRIPTION%/g, resolveReferences(this.Description || "", this.ctx))
            .replace(/%PORTRAITPATH%/g, `../images/${this.Name.toLowerCase()}/${this.PortraitPath}`)
            .replace(/%ICONPATH%/g, `../images/${this.Name.toLowerCase()}/${this.IconPath}`)
            .replace(/%INFO%/g, this.tableProvider.create([{
                "Type":             this.Type               || "<em button=x>-</em>",
                "Health":           this.Health             || "<em button=x>-</em>",
                "Movement Speed":   this.MoveSpeed          || "<em button=x>-</em>",
                "Unique Movement":  this.UniqueMovement     || "<em button=x>-</em>",
                "Stage":            this.Stage              || "<em button=x>-</em>",
                "Reversals":        this.Reversals          || "<em button=x>None</em>",
            }], "vertical"))
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