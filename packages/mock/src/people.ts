import { seeded } from "./rng";

export interface Person {
  id: string;
  name: string;
  email: string;
  country: string; // ISO-2 lower for flag-icons
  countryName: string;
  photo: string; // /assets/people/...
}

const RAW: [string, string, string, string][] = [
  ["Arjun Mehta", "in", "India", "men-32"],
  ["Fatima Al-Sayed", "ae", "United Arab Emirates", "women-44"],
  ["Lucas Ferreira", "br", "Brazil", "men-22"],
  ["Nguyen Thu Ha", "vn", "Vietnam", "women-65"],
  ["Priya Nair", "in", "India", "women-68"],
  ["Omar Haddad", "sa", "Saudi Arabia", "men-52"],
  ["Sofia Rossi", "it", "Italy", "women-12"],
  ["Daniel Okafor", "ng", "Nigeria", "men-75"],
  ["Mei Lin", "sg", "Singapore", "women-29"],
  ["James Carter", "gb", "United Kingdom", "men-11"],
  ["Aisha Rahman", "my", "Malaysia", "women-22"],
  ["Carlos Mendoza", "mx", "Mexico", "men-44"],
  ["Elena Petrova", "cy", "Cyprus", "women-32"],
  ["Rahul Verma", "in", "India", "men-65"],
  ["Yuki Tanaka", "jp", "Japan", "women-75"],
  ["Hassan Karimi", "tr", "Türkiye", "men-81"],
  ["Ana Souza", "br", "Brazil", "women-81"],
  ["Kwame Mensah", "gh", "Ghana", "men-86"],
  ["Zara Sheikh", "pk", "Pakistan", "women-86"],
  ["Thomas Müller", "de", "Germany", "men-12"],
  ["Laila Farouk", "eg", "Egypt", "women-11"],
  ["Vikram Iyer", "in", "India", "men-29"],
  ["Isabella Cruz", "ph", "Philippines", "women-52"],
  ["Ethan Brooks", "za", "South Africa", "men-68"],
];

export const PEOPLE: Person[] = RAW.map(([name, country, countryName, photo], i) => ({
  id: `u_${1000 + i}`,
  name,
  email: `${name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/\.$/, "")}@mail.com`,
  country,
  countryName,
  photo: `/assets/people/${photo}.jpg`,
}));

export function person(i: number): Person {
  return PEOPLE[((i % PEOPLE.length) + PEOPLE.length) % PEOPLE.length]!;
}

export function randomPeople(seed: number, n: number): Person[] {
  const r = seeded(seed);
  const pool = [...PEOPLE];
  const out: Person[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(r.int(0, pool.length - 1), 1)[0]!);
  return out;
}
