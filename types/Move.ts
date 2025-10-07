import type { FrameData } from "./FrameData.ts";
import type { MoveProperties } from "./MoveProperties.ts";

export interface Move {
    Name: string;
    ID?: string;
    Inputs?: string[];
    Buttons?: string[];
    Separator?: string;
    AirOK?: boolean;
    HoldOK?: boolean;
    Condition?: string;
    Images: string[];
    ImageNotes?: string[];
    Hitboxes: string[];
    HitboxNotes?: string[];
    Description: string;
    Advanced: string;

    SpecialFrames?: string[];
    SpecialNote?: string;

    Properties?: MoveProperties[];
    Data: FrameData[];
}

// this isn't really a 'move', but it's kinda relevant ?
export interface Mechanic {
    Name: string;
    Description: string;
    ID?: string;
}
