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

// Checks if there was a change between the old and new version
function compareVersions(older, newer) { // true if change, false if ok
    let existing = fs.readFileSync(older, "utf8");
    let updateLine = existing.split("\n").find(line =>
        line.startsWith("      <p>This page was last updated on ")
    );
    let updateString = (updateLine.split(",")[0].split("on")[1].trim() + "," + updateLine.split(",")[1]).split(".")[0]

    // Compare by replacing the update date in the template and comparing contents
    let result = newer.replace("%DATE%, ", updateString).replace("%TIME% ", "").replace("(%TZ%)", "");
    return result !== existing;
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
        }).join(""));

        if (compareVersions("docs/index.html", mainTemplate)) {
            mainTemplate = mainTemplate.replace("%DATE%", new Date().toDateString())
            .replace("%TIME%", new Date().toLocaleTimeString())
            .replace("%TZ%", new Date().toLocaleTimeString('en-us',{timeZoneName:'short'}).split(' ')[2]);

            fs.writeFileSync("docs/index.html", mainTemplate);
        } else {
            console.log("[Main] No changes detected, skipping main page generation.");
        }
}

function generateCharacter(character) {
    console.log(`[${character.Name}] Generating character page...`);
    if (!fs.existsSync("docs/characters/")) fs.mkdirSync("docs/characters/");
    let rendered = character.render();

    // Navbar can only be built after the main character content is rendered i think
    rendered = rendered.replace("%CHARALIST%", characters.map(character => character.characterNav+"\n").join(""));
    rendered = rendered.replace(character.characterNav, character.characterNavActive);

    // Compare the contents
    if (compareVersions("docs/characters/" + character.Name.toLowerCase() + ".html", rendered)) {
        rendered = rendered.replace("%DATE%", new Date().toDateString())
        .replace("%TIME%", new Date().toLocaleTimeString())
        .replace("%TZ%", new Date().toLocaleTimeString('en-us',{timeZoneName:'short'}).split(' ')[2]);

        // gg
        fs.writeFileSync("docs/characters/" + character.Name.toLowerCase() + ".html", rendered);
    } else {
        console.log(`[${character.Name}] No changes detected, skipping character page generation.`);
    }
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