// creates an input string with appropriate coloring
// todo: we might encounter some weird strings like "236S~P/K", sep should become an array
export const renderInputString = (inputs?: string[] | string, buttons?: string[] | string, sep: string = "/", clean: boolean = false): string => {
    if (!inputs) return "";

    if (typeof inputs === "string") inputs = inputs.split(sep);
    if (typeof buttons === "string") {
        if (!["generic", "or", "taunt"].includes(buttons)) buttons = buttons.split("");
        else buttons = [buttons];
    }

    return inputs.flatMap((input, index, arr) => {
        let separator;
        if (index < arr.length - 1 && sep) separator = clean ? sep : `<em button=or>${sep}</em>`;

        return [ clean ? input : `<em button=${buttons?.[index] ?? "x"}>${input}</em>`, separator ];
    }).join("");
};

// automatically determines the colors and inputs for an input string or entire combo
export const autoResolveInput = (input: string): { part: string, color?: string }[] => {
    const buttons = ["P", "K", "S", "H", "X"];
    const separators = ["/", "~", ">", "▷", "+", " "];
    const terms = ["dl", "delay", "whiff", "land", "jc", "dc", "CH", "aa", "ias", "tk", "ws", "wb"];

    // escapes our stuff otherwise regex explodes and everything breaks
    const regTerms = [...separators, ...terms].map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

    const result: { part: string, color?: string }[] = [];
    let bracket = -1;       // bracket index
    const pieces = input.split(new RegExp(`(${regTerms})`, "i")).filter(piece => piece !== "");

    // [ "236S" "~" "P" ]
    for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i];

        // btn check, will false positive on some terms
        if (buttons.some(button => piece.includes(button))) {
            const parts: typeof result = [];
            let cur = "", button: string | undefined = undefined;

            // char of each peuce, bracket check will fail with negative edges that don't have a separator !!
            for (let j = 0, char = piece[j]; j < piece.length; j++, char = piece[j]) {
                if (char === "[") bracket = j;
                if (char === "]") bracket = -1;

                if (!buttons.includes(char)) {
                    cur += char; continue;
                }

                if (!button) {
                    button = char;
                    cur += char;
                    continue;
                }

                // input isn't surrounded by brackets
                if (bracket === -1) {
                    parts.push({ part: cur, color: button });
                    cur = char;
                    button = char;
                }
                // instead of resetting cur, we just act like we already pushed the prev input
                else {
                    const difference = j - bracket;
                    parts.push({ part: cur.slice(0, cur.length - difference), color: button });
                    cur = piece.slice(j - difference, j + 1);  // +1 to include current char
                    button = char;
                }
            }

            for (const term of terms) {
                // this might be overbearing but it will work for a good while
                if (piece.toLowerCase().includes(term.toLowerCase())) {
                    button = undefined;
                }
            }
            // catch our dings gaster
            result.push(...parts.concat({ part: cur, color: button }));
        } else if (piece) {
            result.push({ part: piece });
        }
    }

    // merges any inputs whose color match, mostly used for all the whitespace that could be present in a combo
    return result.reduce<typeof result>((res, current) => {
        const last = res[res.length - 1];

        if (last && (last.color === current.color)) {
            last.part += current.part;
        } else {
            res.push({ ...current });
        }

        return res;
    }, []);
};