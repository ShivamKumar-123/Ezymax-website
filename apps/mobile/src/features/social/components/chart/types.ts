export type ChartProps = {
  /** y values, oldest first */
  values: number[];
  height: number;
  /** line colour (money colours: green when the range is up, red when down) */
  color: string;
  /** optional horizontal reference line (e.g. the starting value) */
  baseline?: number;
  /** called with the index under the finger while scrubbing, null when the finger lifts */
  onScrub?: (index: number | null) => void;
  accessibilityLabel?: string;
};
