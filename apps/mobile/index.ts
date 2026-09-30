// App entry: the Intl polyfills for Hermes load before anything else, then expo-router starts the app.
import "./src/polyfills/intl";
import "expo-router/entry";
