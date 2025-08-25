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
        let result = input;

        // specific move reference
        // converts instances of %ref(NAME,INPUT,BTN) to <a href="#NAME" class=ref button="BTN" title="NAME">INPUT</a>
        result = input.replace(/%ref\(([^,]+),([^,]+),([^)]+)\)/g, (match, name, input, button) => {
            return `<a href="#${name}" class=ref button="${button.toLowerCase()}" title="${name}">${input}</a>`;
        });

        // weak button reference
        // converts instances of %btn(BTN, TEXT) to <em class=btnbutton="BTN">TEXT</em>
        result = result.replace(/%btn\(([^,]+),([^)]+)\)/g, (match, button, text) => {
            return `<em class=btn button="${button.toLowerCase()}">${text}</em>`;
        });

        return result;
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
    renderNormals(normals) {
        if (!normals) return '';
        return normals.map((normal) => {
            console.log(`[${this.Name}] Generating documentation for command normal: ${normal.Input}`);
            let normalTemplate = fs.readFileSync('templates/character/normal.html', 'utf8');
            normalTemplate = normalTemplate
            .replace(/%INPUT%/g, normal.Input)
            .replace(/%CONDITION%/g, normal.Condition ? ` <em button=x>${normal.Condition}</em>` : '')
            .replace(/%BUTTON%/g, normal.Button)
            .replace(/%IMAGE%/g, normal.Image)
            .replace(/%DESCRIPTION%/g, this.resolveReferences(normal.Description));

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
            .replace(/%IMAGE%/g, "../" + special.Image)
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
        .replace(/%SUPERS%/g, this.renderSupers(this.Supers));

        // Add navigation items
        template = template
        .replace(/%NAV_MECHANICS%/g, this.Mechanics?.map((mechanic) => `<li><a href="#${mechanic.Name}">${mechanic.Name}</a></li>\n`).join("") || "")
        .replace(/%NAV_COMMAND_NORMALS%/g, this.Normals?.map((normal) => `<li><a href="#${normal.Input}">${normal.Input}</a></li>\n`).join("") || "")
        .replace(/%NAV_SPECIALS%/g, this.Specials?.map((special) => `<li><a href="#${special.Name}">${special.Name}</a></li>\n`).join("") || "")
        .replace(/%NAV_SUPERS%/g, this.Supers?.map((sup) => `<li><a href="#${sup.Name}">${sup.Name}</a></li>\n`).join("") || "");

        // Remove nav headers if their children are empty
        if (!this.Mechanics) template = template.replace("<li class=header><a href=\"#mechanics\">Unique Mechanics</a></li>", "");
        if (!this.Normals) template = template.replace("<li class=header><a href=\"#command-normals\">Command Normals</a></li>", "");
        if (!this.Specials) template = template.replace("<li class=header><a href=\"#specials\">Special Attacks</a></li>", "");
        if (!this.Supers) template = template.replace("<li class=header><a href=\"#supers\">Supers</a></li>", "");

        return template;
    }
}


module.exports = Character;