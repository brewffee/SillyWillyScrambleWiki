import * as TOML from "@iarna/toml";
import * as fs from "fs";
import path from "path";

import { logger, templateDir } from "../index.ts";
import { appendLast } from "./String.ts";
import { Character } from "../character.ts";

// todo: move functions to appropriate files
export interface TOMLContent { parsed: TOML.JsonMap, content: string }
export const loadToml = (path: string, validator: (d: TOML.JsonMap) => boolean): TOMLContent | undefined => {
    let parsed: TOML.JsonMap;
    try {
        const content = fs.readFileSync(path, "utf8");
        if (!content) {
            logger.error("\x1b[31m%s\x1b[0m", `[Main] Could not read TOML file: ${path}`);
            return;
        }

        parsed = TOML.parse(content);
        if (!validator(parsed)) {
            logger.error("\x1b[31m%s\x1b[0m", `[Main] Invalid data structure in TOML file: ${path}`);
            return;
        }

        return { parsed, content };
    } catch (error) {
        logger.error("\x1b[31m%s\x1b[0m", `[Main] Error parsing character file ${path}:`, error);
    }
};

export const loadTemplate = (...paths: string[]): string | undefined => {
    const template = fs.readFileSync(path.join(templateDir, ...appendLast(paths, ".html")), "utf8");
    if (!template) {
        logger.error("\x1b[31m%s\x1b[0m", `[Main] Could not read template file: ${path.join(...paths)}.html`);
        return;
    }

    return template;
};

// (lazy) Checks if there was a change between the old and new version
export const compareVersions = (older: string, newer: string): boolean => { // true if changed, false if not
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
};

export const isHidden = (chara: Character): boolean => {
    return JSON.parse(chara.Hidden || "false");
};
