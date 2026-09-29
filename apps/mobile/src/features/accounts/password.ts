// Password generation for the "Generate" buttons (open account, change password).
import { getRandomBytes } from "expo-crypto";

/** A strong password the rule accepts (the engine's own generator: 12 characters, a digit in every fourth place,
 *  no look-alike characters), from the platform's secure random source. */
export function generatePassword(): string {
  const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const DIGIT = "23456789";
  const bytes = getRandomBytes(12);
  let out = "";
  bytes.forEach((b, i) => {
    out += i % 4 === 3 ? DIGIT[b % DIGIT.length] : ALPHA[b % ALPHA.length];
  });
  return out;
}
