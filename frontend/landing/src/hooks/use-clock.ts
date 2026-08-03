"use client";

import { useEffect, useState } from "react";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Live local time + date, ticking once a second.
 *
 * Starts on the spec's fixed fallbacks so server and client render the same
 * markup; the real values arrive on the first tick after mount.
 */
export const useClock = () => {
  const [clock, setClock] = useState({
    time: "9:41am",
    date: "12 March, 2025",
  });

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const hours = now.getHours() % 12 || 12;
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const meridiem = now.getHours() < 12 ? "am" : "pm";
      setClock({
        time: `${hours}:${minutes}${meridiem}`,
        date: `${now.getDate()} ${MONTHS[now.getMonth()]}, ${now.getFullYear()}`,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return clock;
};
