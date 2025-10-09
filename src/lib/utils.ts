import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { getDay } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function addBusinessDays(startDate: Date, days: number): Date {
  let currentDate = new Date(startDate);
  let daysAdded = 0;
  const increment = days > 0 ? 1 : -1;

  // We start counting from the day after, so we iterate up to days.
  while (daysAdded < Math.abs(days)) {
    currentDate.setDate(currentDate.getDate() + increment);
    const dayOfWeek = getDay(currentDate);
    if (dayOfWeek !== 0) { // Not a Sunday
      daysAdded++;
    }
  }
  return currentDate;
}
