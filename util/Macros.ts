export class Macro {
    name: string = "";
    params: number = 1;

    constructor(name: string, params: number) {
        this.name = name;
        this.params = params;
    }

    // creates a regex that matches the macro definition
    regex(): RegExp {
        const pattern = "((?:[^\\\\)]|\\\\.)*)"; // param capture pattern
        const params = Array(this.params).fill(pattern).join(",");
        return new RegExp(`%${this.name}\\(${params}\\)`, "g");
    };

    parse(args: string[]): string[] {
        const parsed: string[] = [];
        const str = args.slice(0, this.params).join(",");

        let current = "", escaped = false;
        for (const char of str) {
            if (escaped) {
                current += char;
                escaped = false;
            } else if (char === "\\") {
                escaped = true;
            } else if (char === ",") {
                parsed.push(current);
                current = "";
            } else {
                current += char;
            }
        }

        parsed.push(current);
        return parsed;
    };

    // sends the parsed args to an array in the callback fn, returns the string result
    execute(input: string, callback: (args: string[]) => string) {
        if (!input) return "";
        return input.replace(this.regex(), (_, ...args) => {
            return callback(this.parse(args));
        });
    }
}

// macro util, colors an input string with multiple colors
export function multicolor(rawInput: string, buttonsArg: string, sep: string) {
    const buttons = buttonsArg.split("");
    const inputs = rawInput.split(sep);

    for (let i = 0; i < buttons.length; i++) {
        inputs[i] = `<em button=${buttons[i].toLowerCase()}>${inputs[i]}</em>`;
    }

    return inputs.join(`<em button=or>${sep}</em>`);
}