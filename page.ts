import type { MoveSection, SectionType, TextSection } from "./types/Section.ts";
import { compareVersions, isHidden, TOMLContent } from "./util/util.ts";
import { Logger } from "./util/Logger.ts";
import { ReferenceContext, resolveReferences } from "./util/Macros.ts";
import { safeID } from "./util/String.ts";
import { renderInputString } from "./util/Input.ts";
import fs from "fs";
import type { Move } from "./types/Move.ts";
import { FrameData, FrameDataDefaults } from "./types/FrameData.ts";
import { MoveProperties, MovePropertiesDefaults } from "./types/MoveProperties.ts";
import { TableProvider } from "./components/Table.ts";
import { characters, exportDir } from "./index.ts";

const moveTemplate = fs.readFileSync("templates/character/move.html", "utf8");
const pageTemplate = fs.readFileSync("templates/system/page.html", "utf8");

export class Page {
    private static readonly OVERVIEW_FIELDS: (keyof Page)[] = [
        "Name", "Description"
    ];

    // TOML Fields //
    Name: string;
    Description: string;
    // ------------ //

    logger: Logger;
    ctx: ReferenceContext;
    tableProvider: TableProvider;

    sections: string[] = [];
    sectionData: { [key: string]: SectionType[] } = {};

    pageNav: string;
    pageNavActive: string;
    mainNav: string;

    tableOfContents: string = "";

    constructor(toml: TOMLContent) {
        const data = toml.parsed["System"] as any;

        this.Name = data.Name;
        this.Description = data.Description || "";

        for (const [key, value] of Object.entries(data) as [keyof Page, any][]) {
            if (Page.OVERVIEW_FIELDS.includes(key as keyof Page)) continue;

            this.sections.push(key);
            this.sectionData[key] = value;
        }

        this.logger = new Logger(data.Name);
        this.ctx = { logger: this.logger, name: this.Name };
        this.tableProvider = new TableProvider(this.ctx);

        this.pageNav = `<li><a href="./${data.Name.toLowerCase()}.html">${data.Name}</a></li>`;
        this.pageNavActive = `<li class=active><a>${data.Name}</a></li>`;

        this.mainNav = `<li><a href="system/${data.Name.toLowerCase()}.html">${data.Name}</a></li>`;
    }

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

    // todo: this functionality should be able to be recreated easily by modifying Table()
    renderFrameData(data?: FrameData[]): string {
        if (!data) return "";
        // as specified in FrameDataDefaults, only Version can be left unspecified. all other fields must remain
        const filled: FrameData[] = data.map((frame) => {
            const res: FrameData = { ...FrameDataDefaults, ...frame };
            if (res.Version === undefined) delete res.Version;
            return res;
        });

        return this.tableProvider.create(filled);
    }

    renderAdvancedData(name: string, data?: MoveProperties[], content?: string): string {
        if (!data && !content) return "";

        let table = "";
        if (data) {
            const filled: MoveProperties[] = data.map((move) => {
                const res: MoveProperties = { ...MovePropertiesDefaults, ...move };
                if (res.Version === undefined) delete res.Version;
                if (res.ProjectileLevel === undefined) delete res.ProjectileLevel;
                return res;
            });

            table = `<div class="table-container">${this.tableProvider.create(filled)}</div>`;
        }

        return `<div class="advanced-toggle">
          <input id="${safeID(name)}-advanced-toggle" class="advanced-checkbox" type="checkbox" hidden>
          <label for="${safeID(name)}-advanced-toggle" class="advanced-btn">[Show/Hide More Information]</label>
        </div>
        <div class="advanced">
            ${table}
            <span>${content}</span>
        </div>`;
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

        let title = data[0].Name || name;

        let sectionHeader = `<h2 id=${safeID(title)}><a href=#${safeID(title)}>${title}</a></h2>`;
        if (name == this.Name) sectionHeader = "";

        this.addNavigable(title, true);

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
                        .replace(/%DESCRIPTION%/g, resolveReferences(item.Description, this.ctx))
                        .replace(/%PROPERTIES%/g, this.renderAdvancedData(id, item.Properties, resolveReferences(item.Advanced || "", this.ctx)));
                }
                default:
                    this.logger.error(`Unknown section type: ${i.Type}`);
                    return "";
            }
        }).join("") + "</div>";
    }

    render(): string {
        this.logger.log("Generating system page...");
        const shownCharacters = characters.filter((chara) => !isHidden(chara));

        const rendered = pageTemplate.replace(/%NAME%/g, this.Name)
            .replace(/%DESCRIPTION%/g, resolveReferences(this.Description || "", this.ctx))
            .replace(/%BODY%/g, this.sections.map((section) =>
                this.renderSection(this.sectionData[section], section)
            ).join(""))
            .replace(/%TABLE_OF_CONTENTS%/g, this.tableOfContents)
            .replace("%CHARALIST%", shownCharacters.map((chara) =>
                `<li><a href="../characters/${chara.Name.toLowerCase()}.html">${chara.Name}</a></li>`
            ).join(""));

        // pages should only update if there are changes in content
        if (!compareVersions(`${exportDir}system/${this.Name.toLowerCase()}.html`, rendered)) {
            this.logger.log("No changes detected, skipping character page generation.");
            return "";
        }

        return rendered.replace("%DATE%", new Date().toDateString())
            .replace("%TIME%", new Date().toLocaleTimeString())
            .replace("%TZ%", new Date().toLocaleTimeString("en-us", { timeZoneName: "short" }).split(" ")[2]);
    }
}