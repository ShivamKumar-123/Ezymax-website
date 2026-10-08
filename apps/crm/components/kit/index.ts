// The Client Area's component kit: everything from @ezymex/ui, with the pieces that carry the Client Area's own
// visual language (pastel frosted cards, accent-filled segmented controls, ink money buttons, KPI accent bars)
// replaced by the versions in this folder. Local exports take precedence over the star re-export.
export * from "@ezymex/ui";
export { Button, buttonVariants, IconButton, Chip, StatusChip, Card, CardHeader, IconTile } from "./primitives";
export type { ButtonProps, ButtonVariant, ButtonSize, ChipTone, TileTone } from "./primitives";
export { Segmented, Tabs, Stepper } from "./navigation";
export { PageHeader, KpiCard, ChangeChip } from "./data";
export { Avatar, Gauge, Money } from "./visual";
