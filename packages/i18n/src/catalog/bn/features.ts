import type { NsMessages } from "../../core";

// Product modules a broker can switch off: what a client sees in their place.
const features: NsMessages<"features"> = {
  "options.offTitle": "অপশন ট্রেডিং উপলভ্য নয়",
  "options.offText": "এই মুহূর্তে আপনার অ্যাকাউন্টে অপশন দেওয়া হচ্ছে না। ট্রেডিং চালিয়ে যেতে একটি CFD অ্যাকাউন্টে যান।",
};

export default features;
