import * as TOML from "@iarna/toml";
import * as fs from "fs";
import path from "path";

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

// appends a string to the last element of an array
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

// creates an input string with appropriate coloring
// todo: we might encounter some weird strings like "236S~P/K", sep should become an array
export const renderInputString = (inputs?: string[] | string, buttons?: string[] | string, sep: string = "/", clean: boolean = false): string => {
    if (!inputs) return inputs?.[0] ?? "";
    if (typeof inputs === "string") inputs = [inputs];
    if (typeof buttons === "string") buttons = [buttons];

    return inputs.flatMap((input, index, arr) => {
        let separator;
        if (index < arr.length - 1 && sep) separator = clean ? sep : `<em button=or>${sep}</em>`;

        return [ clean ? input : `<em button=${buttons?.[index] ?? "x"}>${input}</em>`, separator ];
    }).join("");
};

// is this string contained by something?
export const isContained = (text: string, host: string): boolean => {
    let end = host;

    switch (host) {
        case "[": end = "]"; break;
        case "(": end = ")"; break;
        case "{" : end = "}"; break;
    }

    return text.startsWith(host) && text.endsWith(end);
};
