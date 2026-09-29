// Web preview only: there is no keychain in a browser; sessionStorage keeps the token for the tab.
const ss = (): Storage | null => (typeof sessionStorage === "undefined" ? null : sessionStorage);

export const secure = {
  get: async (key: string) => ss()?.getItem(`kalks.secure.${key}`) ?? null,
  set: async (key: string, value: string) => ss()?.setItem(`kalks.secure.${key}`, value),
  remove: async (key: string) => ss()?.removeItem(`kalks.secure.${key}`),
};
