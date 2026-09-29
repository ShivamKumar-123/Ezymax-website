// Skia gauges, chart and certificate art. Native: Skia is built in, so the drawing module is used as it is.
// Web (gauges.web.tsx): the same components, loaded after CanvasKit.
export { Ring, Bar, EquityChart, CertificateCanvas, CERT_W, CERT_H } from "./skia/parts";
export type { RingProps, BarProps, EquityChartProps, ChartLine, CertArtData, CertificateCanvasHandle } from "./skia/parts";
