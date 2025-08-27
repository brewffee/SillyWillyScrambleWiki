const fs = require('fs');
const toml = require('@iarna/toml');
const Character = require('./character.js');

let characters = [];

function main() {
    fs.readdirSync("data/character").forEach(file => {
        if (file.endsWith(".toml")) {
            const tomlContent = fs.readFileSync("data/character/" + file, "utf8");
            characters.push(new Character(toml.parse(tomlContent).Character));
        }
    });

    // Main Page
    console.log("[Main] Generating main page...");
    let template = fs.readFileSync("templates/index.html", "utf8");
    template = template.replace(/%CHARALIST%/g, characters.map(character => character.mainNav).join(""));
    let characterSelector = characters.map(character => {
        let template = fs.readFileSync("templates/charselector.html", "utf8");
        template = template
            .replace(/%NAME%/g, character.Name.toLowerCase())
            .replace(/%REALNAME%/g, character.Name)
            .replace(/%ICONPATH%/g, character.IconPath)
            .replace(/%TYPE%/g, character.Type);
        return template;
    });

    template = template.replace(/%CHARACTERS%/g, characterSelector.join(""))
        .replace("%DATE%", new Date().toDateString())
        .replace("%TIME%", new Date().toLocaleTimeString())
        .replace("%TZ%", new Date().toLocaleTimeString('en-us',{timeZoneName:'short'}).split(' ')[2]);

    fs.writeFileSync("docs/index.html", template);

    // Character Pages
    characters.forEach(character => {
        console.log(`[${character.Name}] Generating character page...`);
        if (!fs.existsSync("docs/characters/")) fs.mkdirSync("docs/characters/");
        let rendered = character.render();

        // Navbar can only be built after the main character content is rendered i think
        rendered = rendered.replace("%CHARALIST%", characters.map(character => character.characterNav+"\n").join(""));
        rendered = rendered.replace(character.characterNav, character.characterNavActive);

        // gg
        fs.writeFileSync("docs/characters/" + character.Name.toLowerCase() + ".html", rendered);
    });

    // todo: System Pages


    console.log("Done!");
}

main();