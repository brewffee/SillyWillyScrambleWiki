import * as TOML from "@iarna/toml";
import fs from "node:fs";
import path from "node:path";

import { logger, templateDir } from "../index.ts";

// todo: move functions to appropriate files

export const loadToml = (path: string, validator: (data: TOML.JsonMap) => boolean): TOML.JsonMap | undefined => {
    let data: TOML.JsonMap;
    try {
        const content = fs.readFileSync(path, "utf8");
        if (!content) {
            logger.error("\x1b[31m%s\x1b[0m", `[Main] Could not read TOML file: ${path}`);
            return;
        }

        data = TOML.parse(content);
        if (!validator(data)) {
            logger.error("\x1b[31m%s\x1b[0m", `[Main] Invalid data structure in TOML file: ${path}`);
            return;
        }

        return data;
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

// Checks if there was a change between the old and new version
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

export const appendLast = (arr: string[], str: string): string[] => {
  return [
    ...arr.slice(0, arr.length - 1),
    arr[arr.length - 1] + str,
  ];
};

// safely converts a string to a valid HTML ID
export const safeID = (input: string): string => {
    return input.replace(/ /g, "-").replace(/[^a-zA-Z0-9-.]/g, "");
};