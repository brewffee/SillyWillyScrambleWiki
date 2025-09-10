import type { Special } from "./Move.ts";

export interface Section {
    Type: string;
    Description: string;
}

export interface DescriptionSection extends Section {
    Type: "Description";
}

export interface MoveSection extends Section, Special {
    Type: "Move";
}

export type SectionType = Section | DescriptionSection | MoveSection