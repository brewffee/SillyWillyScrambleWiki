const fs = require('fs');

class Character {
    constructor(data) {
        this.Name = data.Name;
        this.Description = data.Description;
        this.Type = data.Type;
        this.IconPath = data.IconPath;
        this.PortraitPath = data.PortraitPath;

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

    // resolve button links and references (todo: external links)
    resolveReferences(input) {
        // specific move reference
        // converts instances of %ref(NAME,INPUT,BTN) to <a href="#NAME" class=ref button="BTN" title="NAME">INPUT</a>
        let result = input.replace(/%ref\(([^,]+),([^,]+),([^)]+)\)/g, (match, name, input, button) => {
            return `<a href="#${name}" class=ref button="${button.toLowerCase()}" title="${name}">${input}</a>`;
        });

        // weak button reference
        // converts instances of %btn(BTN, TEXT) to <em class=btnbutton="BTN">TEXT</em>
        result = result.replace(/%btn\(([^,]+),([^)]+)\)/g, (match, button, text) => {
            return `<em class=btn button="${button.toLowerCase()}">${text}</em>`;
        });

        return result;
    }

    renderFrameData(data) {
        if (!data) return '';
        // create the header and body
        let frameDataTable = "<th>Damage</th><th>Guard</th><th>Startup</th><th>Active</th><th>Recovery</th><th>On Block</th><th>Invuln</th></tr></thead>\n<tbody>";

        // if the first item has the version field, the rest must have it too (otherwise you are DUUUUMB !!!)
        frameDataTable = "<table><thead><tr>" + (data[0].Version ? "<th>Version</th>" : "") + frameDataTable;
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
        }).join('');

        return frameDataTable + "</tbody>\n</table>";
    }

    renderMechanics(mechanics) {
        if (!mechanics) return '';
        const mechanicsHeader = "<h2 id=mechanics><a href=\"#mechanics\">Unique Mechanics</a></h2>\n"
        return mechanicsHeader + mechanics.map((mechanic) => {
            console.log(`[${this.Name}] Generating documentation for mechanic: ${mechanic.Name}`);
            let mechanicTemplate = fs.readFileSync('templates/character/mechanic.html', 'utf8');
            mechanicTemplate = mechanicTemplate
            .replace(/%MECHANIC%/g, mechanic.Name)
            .replace(/%MECHANIC_DESCRIPTION%/g, this.resolveReferences(mechanic.Description));
            return mechanicTemplate;
        }).join('');
    }

    renderImages(move, name) {
        if (!move.Images) return '';
        let imageStr = "";
        for (let i = 0; i < move.Images.length; i++) {
            if (!move.Images[i]) {
                imageStr += `<img alt="${name} Sprite">\n`
            } else {
                imageStr += `<img src="../${move.Images[i]}" alt="${name} Sprite">\n`
            }

            if (move.ImageNotes?.[i]) {
                imageStr += `<span class=image-note>${move.ImageNotes[i]}</span>`
            }
        }
        return imageStr;
    }

    renderNormals(normals) {
        if (!normals) return '';
        return normals.map((normal) => {
            console.log(`[${this.Name}] Generating documentation for command normal: ${normal.Input}`);
            let normalTemplate = fs.readFileSync('templates/character/normal.html', 'utf8');
            normalTemplate = normalTemplate
            .replace(/%INPUT%/g, normal.Input)
            .replace(/%CONDITION%/g, normal.Condition ? ` <em button=x>${normal.Condition}</em>` : '')
            .replace(/%BUTTON%/g, normal.Button)
            .replace(/%IMAGE%/g, this.renderImages(normal, normal.Input))
            .replace(/%FRAMEDATA%/g, this.renderFrameData(normal.Data))
            .replace(/%DESCRIPTION%/g, this.resolveReferences(normal.Description));

            // add Hold or Air OK to the end of the move name if it has those properties
            if (normal.HoldOK === true && normal.AirOK === true) {
                normalTemplate = normalTemplate.replace(/%EXTRA%/g, ' (Hold, Air OK)');
            } else if (normal.HoldOK === true) {
                normalTemplate = normalTemplate.replace(/%EXTRA%/g, ' (Hold OK)');
            } else if (normal.AirOK === true) {
                normalTemplate = normalTemplate.replace(/%EXTRA%/g, ' (Air OK)');
            } else {
                normalTemplate = normalTemplate.replace(/%EXTRA%/g, '');
            }

            return normalTemplate;
        }).join('');
    }
    renderSpecials(specials) {
        if (!specials) return '';
        return specials.map((special) => {
            console.log(`[${this.Name}] Generating documentation for move: ${special.Name}`);

            let specialTemplate = fs.readFileSync('templates/character/special.html', 'utf8');
            specialTemplate = specialTemplate
            .replace(/%NAME%/g, special.Name)
            .replace(/%CONDITION%/g, special.Condition ? `<em button=x>${special.Condition}</em>` : '')
            .replace(/%IMAGE%/g, this.renderImages(special, special.Name))
            .replace(/%FRAMEDATA%/g, this.renderFrameData(special.Data))
            .replace(/%DESCRIPTION%/g, this.resolveReferences(special.Description));

            // More advanced configuration for this part
            specialTemplate = specialTemplate.replace(/%BUTTON%/g, special.Buttons[0]);

            let inputStr = "";
            if (special.AirOnly === true) inputStr += "j.";
            inputStr += special.Inputs[0];

            for (let i = 1; i < special.Buttons.length; i++) {
                if (special.Buttons.length !== special.Inputs.length) return; // what are u doing ????
                // add <em button=x>/</em> <em button=%BUTTON%>%INPUT%</em> for each input
                inputStr+=`<em button=or>/</em><em button=${special.Buttons[i]}>${special.Inputs[i]}</em>`;
            }
            specialTemplate = specialTemplate.replace(/%INPUT%/g, inputStr);

            if (special.HoldOK === true && special.AirOK === true) {
                specialTemplate = specialTemplate.replace(/%EXTRA%/g, ' (Hold, Air OK)');
            } else if (special.HoldOK === true) {
                specialTemplate = specialTemplate.replace(/%EXTRA%/g, ' (Hold OK)');
            } else if (special.AirOK === true) {
                specialTemplate = specialTemplate.replace(/%EXTRA%/g, ' (Air OK)');
            } else {
                specialTemplate = specialTemplate.replace(/%EXTRA%/g, '');
            }

            return specialTemplate;
        }).join('');
    }
    renderSupers(supers) {
        // the format for supers is identical to specials
        return this.renderSpecials(supers);
    }

    render() {
        let template = fs.readFileSync("templates/character/page.html", "utf8");
        template = template
        .replace(/%NAME%/g, this.Name)
        .replace(/%DESCRIPTION%/g, this.resolveReferences(this.Description))
        .replace(/%TYPE%/g, this.Type)
        .replace(/%PORTRAITPATH%/g, "../" + this.PortraitPath)
        .replace(/%ICONPATH%/g, "../" + this.IconPath)
        .replace(/%MECHANICS%/g, this.renderMechanics(this.Mechanics))
        .replace(/%COMMAND_NORMALS%/g, this.renderNormals(this.Normals))
        .replace(/%SPECIALS%/g, this.renderSpecials(this.Specials))
        .replace(/%SUPERS%/g, this.renderSupers(this.Supers))
        .replace("%DATE%", new Date().toDateString())
        .replace("%TIME%", new Date().toLocaleTimeString())
        .replace("%TZ%", new Date().toLocaleTimeString('en-us',{timeZoneName:'short'}).split(' ')[2]);

        // Add navigation items
        template = template
        .replace(/%NAV_MECHANICS%/g, this.Mechanics?.map((mechanic) => `<li><a href="#${mechanic.Name}">${mechanic.Name}</a></li>\n`).join("") || "")
        .replace(/%NAV_COMMAND_NORMALS%/g, this.Normals?.map((normal) => `<li><a href="#${normal.Input}">${normal.Input}</a></li>\n`).join("") || "")
        .replace(/%NAV_SPECIALS%/g, this.Specials?.map((special) => `<li><a href="#${special.Name}">${special.Name}</a></li>\n`).join("") || "")
        .replace(/%NAV_SUPERS%/g, this.Supers?.map((sup) => `<li><a href="#${sup.Name}">${sup.Name}</a></li>\n`).join("") || "");

        // Remove nav and section headers if their children are empty
        if (!this.Mechanics) template = template.replace("<li class=header><a href=\"#mechanics\">Unique Mechanics</a></li>", "");
        if (!this.Normals) {
            template = template.replace("<li class=header><a href=\"#command-normals\">Command Normals</a></li>", "");
            template = template.replace("<h2 id=command-normals><a href=\"#command-normals\">Command Normals</a></h2>", "");
        }
        if (!this.Specials) {
            template = template.replace("<li class=header><a href=\"#specials\">Special Attacks</a></li>", "");
            template = template.replace("<h2 id=specials><a href=\"#specials\">Special Attacks</a></h2>", "");
        }
        if (!this.Supers) {
            template = template.replace("<li class=header><a href=\"#supers\">Supers</a></li>", "");
            template = template.replace("<h2 id=supers><a href=\"#supers\">Supers</a></h2>", "");
        }

        return template;
    }
}


module.exports = Character;