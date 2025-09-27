// adds content to the last element of a string array
export const appendLast = (arr: string[], str: string) => [
    ...arr.slice(0, -1), arr.at(-1)! + str,
];

// safely converts a string to a valid HTML ID
export const safeID = (input: string): string => {
    return input.replace(/[^a-zA-Z0-9-.]/g, "").trim().replace(/ /g, "-");
};

// is this string contained by something?
export const isContained = (text: string, host: string): boolean => {
    const end = { "[": "]", "(": ")", "{": "}" }[host] || host;
    return text.startsWith(host) && text.endsWith(end);
};