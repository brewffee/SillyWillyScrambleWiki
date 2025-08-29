import * as fs from "fs";
import { parse } from "@iarna/toml";
import { Character } from "./character.ts";

const mainTemplate = fs.readFileSync("templates/index.html", "utf8");
const selectorTemplate = fs.readFileSync("templates/character/selector.html", "utf8");

const characterDir = "data/character/";
const exportDir = "docs/";

export const characters: Character[] = [];

// todo: files are looking a little large, might see re-organization

// parses all character data
function loadCharacters(): void {
    console.log("[Main] Reading character data...");
    if (!fs.existsSync(characterDir)) {
        console.error("\x1b[31m%s\x1b[0m", "[Main] Character data directory is missing or invalid!");
        return;
    }

    fs.readdirSync(characterDir).forEach((file) => {
        if (file.endsWith(".toml")) {
            try {
                const tomlContent = fs.readFileSync(characterDir + file, "utf8");
                if (!tomlContent) {
                    console.error("\x1b[31m%s\x1b[0m", `[Main] Could not read character file: ${file}`);
                    return;
                }

                const data = parse(tomlContent);
                if (!data.Character) {
                    console.error("\x1b[31m%s\x1b[0m", `[Main] Invalid data structure in character file: ${file}`);
                    return;
                }

                characters.push(new Character(data.Character));
            } catch (error) {
                console.error("\x1b[31m%s\x1b[0m", `[Main] Error parsing character file ${file}:`, error);
            }
        }
    });
}

// Checks if there was a change between the old and new version
function compareVersions(older: string, newer: string): boolean { // true if change, false if ok
    try {
        if (!fs.existsSync(older)) return true;
        const existing = fs.readFileSync(older, "utf8");
        const updateLine = existing.split("\n").find((line) =>
            line.startsWith("      <p>This page was last updated on ")
        );

        if (!updateLine) {
            console.error("\x1b[31m%s\x1b[0m", "[Main] Could not find update line in existing file. Is the template file correct?");
            return true;
        }

        // compare the contents using the old update time
        const updateString = (updateLine.split(",")[0].split("on")[1].trim() + "," + updateLine.split(",")[1]).split(".")[0]
        const result = newer.replace("%DATE%, ", updateString).replace("%TIME% ", "").replace("(%TZ%)", "");

        return result !== existing;
    } catch (error) {
        console.error("\x1b[31m%s\x1b[0m", "[Main] Error comparing versions:", error);
        return true; // not my problem :P
    }
}

// updates the main page
function generateMain(): void {
    console.log("[Main] Generating main page...");
    let rendered = mainTemplate;

    rendered = rendered.replace("%CHARALIST%", characters.map((character) => character.mainNav).join(""))
        .replace(/%CHARACTERS%/g, characters.map((chara) => {
            return selectorTemplate.replace(/%NAME%/g, chara.Name.toLowerCase())
                .replace(/%REALNAME%/g, chara.Name)
                .replace(/%ICONPATH%/g, `images/${chara.Name.toLowerCase()}/${chara.IconPath}`)
                .replace(/%TYPE%/g, chara.Type);
        }).join(""));

    if (compareVersions(exportDir + "index.html", rendered)) {
        rendered = rendered.replace("%DATE%", new Date().toDateString())
            .replace("%TIME%", new Date().toLocaleTimeString())
            .replace("%TZ%", new Date().toLocaleTimeString("en-us", { timeZoneName: "short" }).split(" ")[2]);

        fs.writeFileSync(exportDir + "index.html", rendered);
    } else {
        console.log("[Main] No changes detected, skipping main page generation.");
    }
}

// updates or creates a character page
function generateCharacter(character: Character): void {
    console.log(`[${character.Name}] Generating character page...`);
    if (!fs.existsSync(`${exportDir}characters/`)) fs.mkdirSync(exportDir + "characters/");
    let rendered = character.render();

    // Compare the contents
    if (compareVersions(`${exportDir}characters/${character.Name.toLowerCase()}.html`, rendered)) {
        rendered = rendered.replace("%DATE%", new Date().toDateString())
            .replace("%TIME%", new Date().toLocaleTimeString())
            .replace("%TZ%", new Date().toLocaleTimeString("en-us", { timeZoneName: "short" }).split(" ")[2]);

        // gg
        fs.writeFileSync(`${exportDir}characters/${character.Name.toLowerCase()}.html`, rendered);
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