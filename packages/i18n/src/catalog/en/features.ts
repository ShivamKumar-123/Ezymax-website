// Keys for this namespace. English is the source; translations live in ../<lang>/features.ts.
// Product modules a broker can switch off (gateway tenant config, apps/crm/lib/modules.ts): what a client sees in
// their place when a page or tab can't simply disappear.
const features = {
  // Ezymex Trader and the mobile app: the active account trades options, but the broker switched FX Options off
  "options.offTitle": "Options trading isn't available",
  "options.offText": "Options aren't offered on your account right now. Switch to a CFD account to keep trading.",
};

export default features;
