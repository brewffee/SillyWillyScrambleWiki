import * as fs from "fs";

import { Logger } from "./util/Logger.ts";
import { compareVersions, isHidden } from "./util/util.ts";
import * as util from "./util/util.ts";

import { Character } from "./character.ts";
import { Page } from "./page.ts";

export const characterDir = "data/character/";
export const systemPageDir = "data/system/";
export const exportDir = "docs/";
export const templateDir = "templates/";

const mainTemplate = util.loadTemplate("index");
const selectorTemplate = util.loadTemplate("character", "selector");

export const characters: Character[] = [];
export const systemPages: Page[] = [];
export const missingResources: string[] = [];
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
        if (data) characters.push(new Character(data));
    });
}

// parses all system pages
function loadSystemPages(): void {
    logger.log("Reading system page data...");
    if (!fs.existsSync(systemPageDir)) {
        logger.error("System page data directory is missing or invalid!");
        return;
    }

    fs.readdirSync(systemPageDir).forEach((file) => {
        if (!file.endsWith(".toml")) return;

        const data = util.loadToml(systemPageDir + file, (data) => !!data["System"]);
        if (data) systemPages.push(new Page(data));
    });
}

// updates the main page
function generateMain(): void {
    logger.log("Generating main page...");
    if (!mainTemplate) {
        logger.error("No template available! Exiting...");
        return process.exit(1);
    }

    const shownCharacters = characters.filter((chara) => !isHidden(chara));

    let rendered = mainTemplate;
    rendered = rendered.replace("%CHARALIST%", shownCharacters.map((chara) => chara.mainNav).join(""))
        .replace(/%CHARACTERS%/g, shownCharacters.map((chara) => {
            return selectorTemplate?.replace(/%NAME%/g, chara.Name.toLowerCase())
                .replace(/%REALNAME%/g, chara.Name)
                .replace(/%ICONPATH%/g, `images/${chara.Name.toLowerCase()}/${chara.IconPath}`)
                .replace(/%TYPE%/g, chara.Type || "") || "";
        }).join(""))
        .replace("%SYSTEM%", systemPages.map((page) =>
            `<a class="syspage" href="system/${page.Name.toLowerCase()}.html">${page.Name}</a>`
        ).join(""));

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
    if (rendered) fs.writeFileSync(`${exportDir}characters/${character.Name.toLowerCase()}.html`, rendered);

    // todo: safety on ALL file operations please, files can be mean like that
}

// updates or creates a system page
function generateSystemPage(page: Page): void {
    if (!fs.existsSync(`${exportDir}system/`)) fs.mkdirSync(`${exportDir}system/`);

    const rendered = page.render();
    if (rendered) fs.writeFileSync(`${exportDir}system/${page.Name.toLowerCase()}.html`, rendered);

}

function main() {
    loadCharacters();
    loadSystemPages();

    // Main Page
    generateMain();

    // Character Pages
    characters.forEach(character => {
        generateCharacter(character);
    });

    // System Pages
    systemPages.forEach(page => {
        generateSystemPage(page);
    });

    // Missing resources
    missingResources.forEach((res, i) => {
        logger.warn(`Missing resource "${res}".`);
        if (i == missingResources.length - 1) {
            logger.warn(`Encountered ${i+1} missing resources while generating pages.`);
        }
    });

    logger.ok("Done!");
}

main();