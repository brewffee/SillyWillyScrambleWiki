import * as fs from "fs";
import * as util from "./util/util.ts";

import { Character } from "./character.ts";
import { Logger } from "./util/Logger.ts";
import { compareVersions } from "./util/util.ts";

export const characterDir = "data/character/";
export const exportDir = "docs/";
export const templateDir = "templates/";

const mainTemplate = util.loadTemplate("index");
const selectorTemplate = util.loadTemplate("character", "selector");

export const characters: Character[] = [];
export const logger = new Logger("Main");

// parses all character data
function loadCharacters(): void {
    logger.log("Reading character data...");
    if (!fs.existsSync(characterDir)) {
        logger.error("Character data directory is missing or invalid!");
        return;
    }

    fs.readdirSync(characterDir).forEach((file) => {
        if (!file.endsWith(".toml")) return;

        const data = util.loadToml(characterDir + file, (data) => !!data["Character"]);
        if (data) characters.push(new Character(data["Character"]));
    });
}

// updates the main page
function generateMain(): void {
    logger.log("Generating main page...");
    if (!mainTemplate) {
        logger.error("No template available! Exiting...");
        return process.exit(1);
    }

    let rendered = mainTemplate;
    rendered = rendered.replace("%CHARALIST%", characters.map((character) => character.mainNav).join(""))
        .replace(/%CHARACTERS%/g, characters.map((chara) => {
            return selectorTemplate?.replace(/%NAME%/g, chara.Name.toLowerCase())
                .replace(/%REALNAME%/g, chara.Name)
                .replace(/%ICONPATH%/g, `images/${chara.Name.toLowerCase()}/${chara.IconPath}`)
                .replace(/%TYPE%/g, chara.Type) || "";
        }).join(""));

    if (compareVersions(exportDir + "index.html", rendered)) {
        rendered = rendered.replace("%DATE%", new Date().toDateString())
            .replace("%TIME%", new Date().toLocaleTimeString())
            .replace("%TZ%", new Date().toLocaleTimeString("en-us", { timeZoneName: "short" }).split(" ")[2]);

        fs.writeFileSync(exportDir + "index.html", rendered);
    } else {
        logger.log("No changes detected, skipping main page generation.");
    }
}

// updates or creates a character page
function generateCharacter(character: Character): void {
    // todo: validate directories at initialization please and thank you
    if (!fs.existsSync(`${exportDir}characters/`)) fs.mkdirSync(`${exportDir}characters/`);

    const rendered = character.render();
    if (!rendered) return;

    // todo: safety on ALL file operations please, files can be mean like that
    fs.writeFileSync(`${exportDir}characters/${character.Name.toLowerCase()}.html`, rendered);
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
    logger.log("Done!");
}

main();