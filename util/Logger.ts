export class Logger {
    private readonly red = "\x1b[31m";
    private readonly yellow = "\x1b[33m";
    private readonly green = "\x1b[32m";
    private readonly clear = "\x1b[0m";

    public name: string;

    public warnEnabled = true;
    public errorEnabled = true;
    public warnCount = 0;
    public errorCount = 0;

    constructor(name?: string) {
        this.name = name ? `[${name}] ` : " ";
    }

    public log(message: any, ...params: any[]): void {
        console.log(this.name + message, ...params);
    }

    public ok(message: any, ...params: any[]): void {
        console.log(this.green + this.name + message, ...params, this.clear);
    }

    public warn(message: any, ...params: any[]): void {
        if (!this.warnEnabled) return;
        this.warnCount++;
        console.log(this.yellow + this.name + message, ...params, this.clear);
    }

    public error(message: any, ...params: any[]): void {
        if (!this.errorEnabled) return;
        this.errorCount++;
        console.log(this.red + this.name + message, ...params, this.clear);
    }
}