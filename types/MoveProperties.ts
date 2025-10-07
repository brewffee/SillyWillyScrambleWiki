export interface MoveProperties {
    [key: string]: string | string[] | undefined;

    Version?: string;
    Attributes: string[];
    ProjectileLevel?: string;
    Properties: string[];
    Proration: string;
    CounterType: string;
    ChipRatio: string;
    OnHit: string;
}

export const MovePropertiesDefaults: MoveProperties = {
    Version: undefined,
    Attributes: [],
    ProjectileLevel: undefined,
    Properties: [],
    Proration: "",
    CounterType: "",
    ChipRatio: "",
    OnHit: "",
};
