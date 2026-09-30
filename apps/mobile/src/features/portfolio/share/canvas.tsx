// The share card's Skia canvas. Native: Skia is built in, so the drawing module is used as it is.
// Web (canvas.web.tsx): the same component, loaded after CanvasKit.
export { ShareCardCanvas, CARD_W, CARD_H } from "./art";
export type { CardText, ShareCardHandle } from "./art";
