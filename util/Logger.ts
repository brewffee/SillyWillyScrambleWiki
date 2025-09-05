export class Logger {
    public red = "\x1b[31m";
    public yellow = "\x1b[33m";
    public clear: string = "\x1b[0m";

    public name: string;

    constructor(name?: string) {
        this.name = name ? `[${name}] ` : " ";
    }

    public log(message: any, ...params: any[]): void {
        console.log(this.name + message, ...params);
    }

    public warn(message: any, ...params: any[]): void {
        console.log(this.yellow, this.name + message, ...params, this.clear);
    }

    public error(message: any, ...params: any[]): void {
        console.log(this.red, this.name + message, ...params, this.clear);
    }
}