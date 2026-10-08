import type { NsMessages } from "../../core";

// Product modules a broker can switch off: what a client sees in their place.
const features: NsMessages<"features"> = {
  "options.offTitle": "ஆப்ஷன் வர்த்தகம் கிடைக்கவில்லை",
  "options.offText": "தற்போது உங்கள் கணக்கிற்கு ஆப்ஷன்கள் வழங்கப்படவில்லை. தொடர்ந்து வர்த்தகம் செய்ய CFD கணக்கிற்கு மாறவும்.",
};

export default features;
