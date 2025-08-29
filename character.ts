import * as fs from "fs";

interface FrameData {
    Version: string;
    Damage: string;
    Guard: string;
    Startup: string;
    Active: string;
    Recovery: string;
    OnBlock: string;
    Invuln: string[];
    SpecialFrames: number[];
    SpecialNote: string;
}

interface Normal {
    Input: string;
    Button: string;
    AirOK: boolean;
    HoldOK: boolean;
    Condition: string;
    Images: string[];
    ImageNotes: string[];
    Hitboxes: string[];
    HitboxNotes: string[];
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
    Specials: Special[];
    Supers: Super[];
    // ------------ //

    characterNav: string;
    characterNavActive: string;
    mainNav: string;

    constructor(data: any) {
        this.Name = data.Name;
        this.Description = data.Description;
        this.IconPath = data.IconPath;
        this.PortraitPath = data.PortraitPath;
        this.Type = data.Type;
        this.Reversals = data.Reversals;

        this.Mechanics = data.Mechanics;
        this.Normals = data.Normals;
        this.Specials = data.Specials;
        this.Supers = data.Supers;

        // this can probably be done better but i don't care for now
        // for use in navigation bar on character pages
        this.characterNav = `<li><a href="./${this.Name.toLowerCase()}.html">${this.Name}</a></li>`
        this.characterNavActive = `<li class=active><a>${this.Name}</a></li>`

        // main page navigation bar
        this.mainNav = `<li><a href="characters/${this.Name.toLowerCase()}.html">${this.Name}</a></li>`
    }

    // safely converts a string to a valid HTML ID
    safeID(input: string): string {
        return input.replace(/ /g, "-").replace(/[^a-zA-Z0-9-.]/g, "");
    }

    // resolve button links and references (todo: external links)
    resolveReferences(input: string): string {
        // specific move reference
        // converts instances of %ref(NAME,INPUT,BTN) to <a href="#NAME" class=ref button="BTN" title="NAME">INPUT</a>
        let result = input.replace(/%ref\(([^,]+),([^,]+),([^)]+)\)/g, (_, name, input, button) => {
            return `<a href="#${this.safeID(name)}" class=ref button="${button.toLowerCase()}" title="${name}">${input}</a>`;
        });

        // weak button reference
        // converts instances of %btn(BTN, TEXT) to <em class=btnbutton="BTN">TEXT</em>
        result = result.replace(/%btn\(([^,]+),([^)]+)\)/g, (_, button, text) => {
            return `<em class=btn button="${button.toLowerCase()}">${text}</em>`;
        });

        return result;
    }

    // adds Hold or Air OK to qualifying moves
    renderExtras(move: Move): string {
        if (move.HoldOK && move.AirOK) {
            return " (Hold, Air OK)";
        } else if (move.HoldOK) {
            return " (Hold OK)";
        } else if (move.AirOK) {
            return " (Air OK)";
        }

        return "";
    }

    // utility for moves with multiple inputs (ex 236P/K/S)
    renderInputString(inputs: string[], buttons: string[]): string {
        let inputStr = inputs[0];
        for (let i = 1; i < buttons.length; i++) {
            if (buttons.length !== inputs.length) return ""; // what are u doing ????
            inputStr+=`<em button=or>/</em><em button=${buttons[i]}>${inputs[i]}</em>`;
        }
        return inputStr;
    }

    // constructs the table for displaying frame data
    renderFrameData(data: FrameData[]): string {
        if (!data) return "";
        // create the header and body
        let frameDataTable = "<th>Damage</th><th>Guard</th><th>Startup</th><th>Active</th><th>Recovery</th><th>On Block</th><th>Invuln</th></tr></thead>\n<tbody>";

        // if the first item has the version field, the rest must have it too (otherwise you are DUUUUMB !!!)
        frameDataTable = "<div class=frame-table><table><thead><tr>" + (data[0].Version ? "<th>Version</th>" : "") + frameDataTable;
        frameDataTable += data.map((d) => {
            let dataRow = "<tr>"
            if (d.Version) dataRow += `<td>${d.Version || ""}</td>`;
            dataRow += `<td>${d.Damage || ""}</td>`;
            dataRow += `<td>${d.Guard || ""}</td>`;
            dataRow += `<td>${d.Startup || ""}</td>`;
            dataRow += `<td>${d.Active || ""}</td>`;
            dataRow += `<td>${d.Recovery || ""}</td>`;
            dataRow += `<td>${d.OnBlock || ""}</td>`;
            dataRow += `<td>${d.Invuln?.join("<br>") || ""}</td>`;
            dataRow += "</tr>";
            return dataRow;
        }).join("");

        return frameDataTable + "</tbody>\n</table></div>";
    }

    // additional headers for character specific mechanics
    renderMechanics(mechanics: Mechanic[]): string {
        if (!mechanics) return "";
        const mechanicsHeader = "<h2 id=mechanics><a href=\"#mechanics\">Unique Mechanics</a></h2>\n"
        return mechanicsHeader + mechanics.map((mechanic) => {
            console.log(`[${this.Name}] Generating documentation for mechanic: ${mechanic.Name}`);

            return mechanicTemplate.replace(/%MECHANIC%/g, mechanic.Name)
                .replace(/%ID%/g, this.safeID(mechanic.Name))
                .replace(/%MECHANIC_DESCRIPTION%/g, this.resolveReferences(mechanic.Description));
        }).join("");
    }

    // creates the image gallery
    renderImages(images: string[], notes: string[], name: string): string {
        if (!images) return "";
        let imageStr = "";
        for (let i = 0; i < images.length; i++) {
            if (!fs.existsSync("docs/" + images[i])) {
                console.warn("\x1b[33m%s\x1b[0m", `[${this.Name}] Could not find requested image: ${images[i]}`);
            }

            if (!images[i]) {
                imageStr += `<img src="" alt="${name} Sprite ${i>0?i+1:''}" title="${images[i]}">\n`
            } else {
                imageStr += `<img src="../${images[i]}" alt="${name} Sprite ${i>0?i+1:''}" title="${images[i]}">\n`
            }

            if (notes?.[i]) imageStr += `<span class=image-note>${this.resolveReferences(notes[i])}</span>`
        }
        return imageStr;
    }

    // command normals (might be renamed if normal moves are also displayed)
    renderNormals(normals: Normal[]): string {
        if (!normals) return "";
        return normals.map((normal) => {
            console.log(`[${this.Name}] Generating documentation for command normal: ${normal.Input}`);

            return normalTemplate.replace(/%INPUT%/g, normal.Input)
                .replace(/%EXTRA%/g, this.renderExtras(normal))
                .replace(/%CONDITION%/g, normal.Condition ? ` <em button=x>${normal.Condition}</em>` : "")
                .replace(/%BUTTON%/g, normal.Button)
                .replace(/%IMAGE%/g, this.renderImages(normal.Images, normal.ImageNotes, normal.Input))
                .replace(/%HITBOX%/g, this.renderImages(normal.Hitboxes, normal.HitboxNotes, normal.Input))
                .replace(/%FRAMEDATA%/g, this.renderFrameData(normal.Data))
                .replace(/%DESCRIPTION%/g, this.resolveReferences(normal.Description));
        }).join("");
    }

    // special moves (attacks that have a name or more complex inputs)
    renderSpecials(specials: Special[]): string {
        if (!specials) return "";
        return specials.map((special) => {
            console.log(`[${this.Name}] Generating documentation for move: ${special.Name}`);

            return specialTemplate.replace(/%NAME%/g, special.Name)
                .replace(/%ID%/g, this.safeID(special.Name))
                .replace(/%EXTRA%/g, this.renderExtras(special))
                .replace(/%BUTTON%/g, special.Buttons[0])
                .replace(/%INPUT%/g, this.renderInputString(special.Inputs, special.Buttons))
                .replace(/%CONDITION%/g, special.Condition ? `<em button=x>${special.Condition}</em>` : "")
                .replace(/%IMAGE%/g, this.renderImages(special.Images, special.ImageNotes, special.Name))
                .replace(/%HITBOX%/g, this.renderImages(special.Hitboxes, special.HitboxNotes, special.Name))
                .replace(/%FRAMEDATA%/g, this.renderFrameData(special.Data))
                .replace(/%DESCRIPTION%/g, this.resolveReferences(special.Description));
        }).join("");
    }

    // supers (just a wrapper for renderSpecials, format is identical)
    renderSupers(supers: Super[]): string {
        return this.renderSpecials(supers);
    }

    // reversals field of the info table
    renderReversals(): string {
        if (!this.Reversals) return "<em button=x>None</em>";
        return this.Reversals.map(rev => this.resolveReferences(rev)).join("<br>");
    }

    // semi-final page generation before populating navbar and update time
    render(): string {
        let rendered = characterTemplate.replace(/%NAME%/g, this.Name)
        .replace(/%DESCRIPTION%/g, this.resolveReferences(this.Description))
        .replace(/%PORTRAITPATH%/g, "../" + this.PortraitPath)
        .replace(/%ICONPATH%/g, "../" + this.IconPath)
        .replace(/%TYPE%/g, this.Type)
        .replace(/%REVERSALS%/g, this.renderReversals())
        .replace(/%MECHANICS%/g, this.renderMechanics(this.Mechanics))
        .replace(/%COMMAND_NORMALS%/g, this.renderNormals(this.Normals))
        .replace(/%SPECIALS%/g, this.renderSpecials(this.Specials))
        .replace(/%SUPERS%/g, this.renderSupers(this.Supers));

        // Add navigation items
        rendered = rendered
        .replace(/%NAV_MECHANICS%/g, this.Mechanics?.map((mechanic) => `<li><a href="#${this.safeID(mechanic.Name)}">${mechanic.Name}</a></li>\n`).join("") || "")
        .replace(/%NAV_COMMAND_NORMALS%/g, this.Normals?.map((normal) => `<li><a href="#${this.safeID(normal.Input)}">${normal.Input}</a></li>\n`).join("") || "")
        .replace(/%NAV_SPECIALS%/g, this.Specials?.map((special) => `<li><a href="#${this.safeID(special.Name)}">${special.Name}</a></li>\n`).join("") || "")
        .replace(/%NAV_SUPERS%/g, this.Supers?.map((sup) => `<li><a href="#${this.safeID(sup.Name)}">${sup.Name}</a></li>\n`).join("") || "");

        // Remove nav and section headers if their children are empty
        if (!this.Mechanics) {
            rendered = rendered.replace("<li class=header><a href=\"#mechanics\">Unique Mechanics</a></li>", "");
        }
        if (!this.Normals) {
            rendered = rendered.replace("<li class=header><a href=\"#command-normals\">Command Normals</a></li>", "")
                .replace("<h2 id=command-normals><a href=\"#command-normals\">Command Normals</a></h2>", "");
        }
        if (!this.Specials) {
            rendered = rendered.replace("<li class=header><a href=\"#specials\">Special Attacks</a></li>", "")
                .replace("<h2 id=specials><a href=\"#specials\">Special Attacks</a></h2>", "");
        }
        if (!this.Supers) {
            rendered = rendered.replace("<li class=header><a href=\"#supers\">Supers</a></li>", "")
                .replace("<h2 id=supers><a href=\"#supers\">Supers</a></h2>", "");
        }

        return rendered;
    }
}