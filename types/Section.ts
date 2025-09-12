import type { Move } from "./Move.ts";

export interface Section {
    Type: string;
    Description: string;
}

export interface SummarySection extends Section {
    Type: "Summary";
}

export interface TextSection extends Section {
    Type: "Text";
    Name: string;
    ID?: string;
}

export interface MoveSection extends Section, Move {
    Type: "Move";
}

export type SectionType = Section | SummarySection | TextSection | MoveSection;