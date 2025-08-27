const fs = require('fs');
const toml = require('@iarna/toml');
const Character = require('./character.js');

let characters = [];

function loadCharacters() {
    console.log("[Main] Reading character data...");
    fs.readdirSync("data/character").forEach(file => {
        if (file.endsWith(".toml")) {
            const tomlContent = fs.readFileSync("data/character/" + file, "utf8");
            characters.push(new Character(toml.parse(tomlContent).Character));
        }
    });
}

function generateMain() {
    console.log("[Main] Generating main page...");
    let mainTemplate = fs.readFileSync("templates/index.html", "utf8");

    mainTemplate = mainTemplate.replace(/%CHARALIST%/g, characters.map(character => character.mainNav).join(""))
        .replace(/%CHARACTERS%/g, characters.map((chara) => {
            let charaTemplate = fs.readFileSync("templates/character/selector.html", "utf8");
            charaTemplate = charaTemplate.replace(/%NAME%/g, chara.Name.toLowerCase())
                .replace(/%REALNAME%/g, chara.Name)
                .replace(/%ICONPATH%/g, chara.IconPath)
                .replace(/%TYPE%/g, chara.Type);
            return charaTemplate;
        }).join(""))
        .replace("%DATE%", new Date().toDateString())
        .replace("%TIME%", new Date().toLocaleTimeString())
        .replace("%TZ%", new Date().toLocaleTimeString('en-us',{timeZoneName:'short'}).split(' ')[2]);

    fs.writeFileSync("docs/index.html", mainTemplate);
}

function generateCharacter(character) {
    console.log(`[${character.Name}] Generating character page...`);
    if (!fs.existsSync("docs/characters/")) fs.mkdirSync("docs/characters/");
    let rendered = character.render();

    // Navbar can only be built after the main character content is rendered i think
    rendered = rendered.replace("%CHARALIST%", characters.map(character => character.characterNav+"\n").join(""));
    rendered = rendered.replace(character.characterNav, character.characterNavActive);

    // gg
    fs.writeFileSync("docs/characters/" + character.Name.toLowerCase() + ".html", rendered);
}

function main() {
    loadCharacters();

    // Main Page
    generateMain();

    // Character Pages
    characters.forEach(character => {
        generateCharacter(character);
    });

    // todo: System Pages
    console.log("Done!");
}

main();