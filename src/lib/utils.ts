import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { getDay, set, addDays, addMinutes, subMinutes } from "date-fns";

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

export function subBusinessDays(startDate: Date, days: number): Date {
  let currentDate = new Date(startDate);
  let daysSubtracted = 0;

  while (daysSubtracted < days) {
      currentDate.setDate(currentDate.getDate() - 1);
      const dayOfWeek = getDay(currentDate);
      if (dayOfWeek !== 0) { // Not a Sunday
          daysSubtracted++;
      }
  }
  return currentDate;
}

const WORKING_HOURS_START = 9;
const WORKING_HOURS_END = 17;

export const calculateEndDateTime = (startDateTime: Date, totalDurationMinutes: number): Date => {
  let remainingMinutes = totalDurationMinutes;
  let currentDateTime = new Date(startDateTime);

  if (currentDateTime.getHours() >= WORKING_HOURS_END) {
    currentDateTime = set(addDays(currentDateTime, 1), { hours: WORKING_HOURS_START, minutes: 0, seconds: 0, milliseconds: 0 });
  }
  
  if (currentDateTime.getHours() < WORKING_HOURS_START) {
     currentDateTime = set(currentDateTime, { hours: WORKING_HOURS_START, minutes: 0, seconds: 0, milliseconds: 0 });
  }

  while (remainingMinutes > 0) {
    const dayOfWeek = getDay(currentDateTime);
    if (dayOfWeek === 0) { // Sunday
      currentDateTime = set(addDays(currentDateTime, 1), { hours: WORKING_HOURS_START, minutes: 0 });
      continue;
    }

    const endOfWorkDay = set(currentDateTime, { hours: WORKING_HOURS_END, minutes: 0, seconds: 0, milliseconds: 0 });
    const minutesLeftInDay = (endOfWorkDay.getTime() - currentDateTime.getTime()) / (1000 * 60);

    if (remainingMinutes <= minutesLeftInDay) {
      currentDateTime = addMinutes(currentDateTime, remainingMinutes);
      remainingMinutes = 0;
    } else {
      remainingMinutes -= minutesLeftInDay;
      currentDateTime = set(addDays(currentDateTime, 1), { hours: WORKING_HOURS_START, minutes: 0, seconds: 0, milliseconds: 0 });
    }
  }

  return currentDateTime;
};

export const calculateStartDateTime = (endDateTime: Date, totalDurationMinutes: number): Date => {
  let remainingMinutes = totalDurationMinutes;
  let currentDateTime = new Date(endDateTime);

  while (remainingMinutes > 0) {
    const dayOfWeek = getDay(currentDateTime);
    if (dayOfWeek === 0) {
      currentDateTime = set(addDays(currentDateTime, -1), { hours: WORKING_HOURS_END, minutes: 0 });
      continue;
    }

    const startOfWorkDay = set(currentDateTime, { hours: WORKING_HOURS_START, minutes: 0 });
    const minutesIntoDay = (currentDateTime.getTime() - startOfWorkDay.getTime()) / (1000 * 60);
    
    if (remainingMinutes <= minutesIntoDay) {
      currentDateTime = subMinutes(currentDateTime, remainingMinutes);
      remainingMinutes = 0;
    } else {
      remainingMinutes -= minutesIntoDay;
      currentDateTime = set(addDays(currentDateTime, -1), { hours: WORKING_HOURS_END, minutes: 0 });
    }
  }

  return currentDateTime;
};
