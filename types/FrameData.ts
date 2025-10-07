export interface FrameData {
    [key: string]: string | string[] | undefined;

    Version?: string;
    Damage: string;
    Guard: string;
    Startup: string;
    Active: string;
    Recovery: string;
    OnBlock: string;
    Invuln: string[];
}

export const FrameDataDefaults: FrameData = {
    Version: undefined,
    Damage: "",
    Guard: "",
    Startup: "",
    Active: "",
    Recovery: "",
    OnBlock: "",
    Invuln: [],
};
