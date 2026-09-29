// Prop notification and email links point at the Client Area's /prop/mine (?id=): the challenge, or Prop home.
import { Redirect, useLocalSearchParams } from "expo-router";

export default function PropMine() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <Redirect href={id && /^\d{1,12}$/.test(id) ? `/prop/${id}` : "/prop"} />;
}
