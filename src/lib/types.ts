import type { LucideIcon } from 'lucide-react';

export type Machine = {
  id: string;
  name: string;
};

export type Process = {
  id: string;
  name: string;
  sam: number; // Standard Allowed Minutes
  orderQuantity: number;
  icon: LucideIcon;
};

export type ScheduledProcess = {
  id: string; // unique id for the scheduled instance
  processId: string;
  machineId: string;
  startDate: Date;
  durationDays: number;
};
