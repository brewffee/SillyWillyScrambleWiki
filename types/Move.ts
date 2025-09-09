import type { FrameData } from "./FrameData.ts";

export interface Normal {
    ID?: string;
    Input: string;
    Button: string;
    AirOK?: boolean;
    HoldOK?: boolean;
    Condition?: string;
    Images: string[];
    ImageNotes?: string[];
    Hitboxes: string[];
    HitboxNotes?: string[];
    Description: string;

    Data: FrameData[];
}

export interface Special extends Omit<Normal, "Input" | "Button"> {
    Name: string;
    Inputs: string[];
    Buttons: string[];
}

export type Super = Special;
export type Move = Normal | Special | Super;

// this isn't really a 'move', but it's kinda relevant ?
export interface Mechanic {
    Name: string;
    Description: string;
    ID?: string;
}
