import * as fs from "fs";
import { Character } from "./character.ts";
import * as util from "./util/util.ts";
import {Logger} from "./util/Logger.ts";

const characterDir = "data/character/";
const exportDir = "docs/";
export const templateDir = "templates/";

const mainTemplate = util.loadTemplate("index");
const selectorTemplate = util.loadTemplate("character", "selector");

export const characters: Character[] = [];
export const logger = new Logger("Main");

// todo: files are looking a little large, might see re-organization

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

// Checks if there was a change between the old and new version
function compareVersions(older: string, newer: string): boolean { // true if change, false if ok
    try {
        if (!fs.existsSync(older)) return true;
        const searchString = "      <p>This page was last updated on ";
        const existing = fs.readFileSync(older, "utf8");
        const updateLine = existing.split("\n").find((line) =>
            line.startsWith(searchString)
        );

        if (!updateLine) {
            logger.error("Could not find update line in existing file. Is the template file correct?");
            return true;
        }

        // compare the contents using the old update time
        const updateString = (updateLine.split(",")[0].split(searchString)[1].trim() + "," + updateLine.split(",")[1]).split(".")[0];
        const result = newer.replace("%DATE%, ", updateString).replace("%TIME% ", "").replace("(%TZ%)", "");

        return result !== existing;
    } catch (error) {
        logger.error("Error comparing versions:", error);
        return true; // not my problem :P
    }
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
    // todo: the character should be responsible for its own logger
    const charaLog = new Logger(character.Name);
    charaLog.log(`Generating character page...`);
    // todo: validate directories at initialization please and thank you
    if (!fs.existsSync(`${exportDir}characters/`)) fs.mkdirSync(`${exportDir}characters/`);
    let rendered = character.render();

    // Compare the contents
    // todo: this can also be done in render if we isolate compareVersions
    if (!compareVersions(`${exportDir}characters/${character.Name.toLowerCase()}.html`, rendered)) {
        return charaLog.log(`No changes detected, skipping character page generation.`);
    }

    // ggz
    rendered = rendered.replace("%DATE%", new Date().toDateString())
        .replace("%TIME%", new Date().toLocaleTimeString())
        .replace("%TZ%", new Date().toLocaleTimeString("en-us", { timeZoneName: "short" }).split(" ")[2]);

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