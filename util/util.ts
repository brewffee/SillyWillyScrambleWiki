// general util

import * as TOML from "@iarna/toml";
import fs from "node:fs";
import path from "node:path";
import { logger, templateDir } from "../index.ts";

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

// todo: you don't belong here
export const appendLast = (arr: string[], str: string): string[] => {
  return [
    ...arr.slice(0, arr.length - 1),
    arr[arr.length - 1] + str,
  ];
};