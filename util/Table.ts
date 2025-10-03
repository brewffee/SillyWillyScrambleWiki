import { ReferenceContext, resolveReferences } from "./Macros.ts";

export type TableData = { [key: string]: string | string[] | undefined }[];

export class TableProvider {
    ctx: ReferenceContext = {};

   constructor(ctx: ReferenceContext) {
       this.ctx = ctx;
   }

    create(data: TableData, orientation?: "horizontal" | "vertical"): string {
        return new Table(data, orientation).context(this.ctx).render();
    }
}

export class Table {
    headers: string[];
    data: TableData;
    orientation: "horizontal" | "vertical";
    ctx: ReferenceContext = {};

    constructor(data: TableData, orientation?: "horizontal" | "vertical") {
        this.headers = Object.keys(data[0]);
        this.data = data;
        this.orientation = orientation || "horizontal";
    }

    context(data: ReferenceContext): Table {
        this.ctx = data;
        return this;
    }

    render(): string {
        if (!this.data) return "";
        let table = `<table orientation="${this.orientation}">\n`;

        switch (this.orientation) {
            case "horizontal":
                // thead and tbody for header and body
                table += `<thead>\n<tr>\n${this.headers.map((header) => `<th>${resolveReferences(header, this.ctx)}</th>`).join("\n")}\n</tr>\n</thead>`;

                // tbody
                return table + "<tbody>\n" + this.data.map((item) => {

                    return "<tr>\n" + this.headers.map((key) => {
                        const value = item[key] ?? "";

                        if (Array.isArray(value)) {
                            return `<td>${value.map((i) => resolveReferences(i, this.ctx)).join(",<br>")}</td>`;
                        } else {
                            return `<td>${resolveReferences(value, this.ctx)}</td>`;
                        }
                    }).join("\n") + "\n</tr>\n";

                }).join("") + "</tbody>\n</table>";
            case "vertical":
                // single tbody with th and td
                return table + "<tbody>\n" + this.data.map((item) => {

                    return this.headers.map((key) => {
                        const value = item[key] ?? "";

                        if (Array.isArray(value)) {
                            return `<tr><th>${key}</th><td>${value.map((i) => resolveReferences(i, this.ctx)).join(",<br>")}</td></tr>`;
                        } else {
                            return `<tr><th>${key}</th><td>${resolveReferences(value, this.ctx)}</td></tr>`;
                        }
                    }).join("\n");

                }).join("\n") + "\n</tbody>\n</table>";
            default:
                if (this.ctx.logger) this.ctx.logger.error(`Unknown table orientation: ${this.orientation}`);
                return "";
        }
    }
}