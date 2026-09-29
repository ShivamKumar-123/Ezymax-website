// "Open in Trade": the prop account becomes the app's active trading account (the Trade tab opens its engine
// session and quotes on it) and the Trade tab comes forward. Prop accounts are the client's own live accounts in
// the plan's engine group, so the Trade tab trades them like any other; the engine enforces the account state.
import { router } from "expo-router";
import { setActiveLogin } from "@/session/activeAccount";

export function openInTrade(login: number) {
  setActiveLogin(login);
  router.navigate("/trade");
}
