import type { LucideIcon } from 'lucide-react';

export type Unit = {
  id: string;
  name: string;
};

export type Machine = {
  id:string;
  name: string;
  processIds: string[];
  unitId: string;
  isMoveable: boolean;
};

export type Process = {
  id: string;
  name: string;
  sam: number; // Standard Allowed Minutes
  icon: LucideIcon;
  color?: string;
  singleRunOutput: number;
};

export type TnaProcess = {
  processId: string;
  startDate: string | Date; // Original T&A date, can be kept for reference
  endDate: string | Date;   // Original T&A date, can be kept for reference
  setupTime: number; // in minutes
  latestStartDate?: Date;
  plannedStartDate?: Date;
  plannedEndDate?: Date;
};

export type Tna = {
  ckDate: string | Date;
  processes: TnaProcess[];
};

export type RampUpEntry = {
  day: number;
  efficiency: number; // As a percentage, e.g., 85 for 85%
};

export type Order = {
  id: string; // e.g. 'ZAR4531-Shirt-Blue'
  ocn: string; // e.g. 'ZAR4531'
  buyer: string; // e.g. 'Zara'
  style: string; // e.g. 'Shirt'
  color: string; // e.g. 'Blue'
  quantity: number;
  processIds: string[];
  dueDate: Date;
  tna?: Tna;
  displayColor?: string;
  leadTime?: number;
  budgetedEfficiency?: number;
  sewingRampUpScheme?: RampUpEntry[];
};

export type ScheduledProcess = {
  id: string; // unique id for the scheduled instance
  orderId: string;
  processId: string;
  machineId: string;
  startDateTime: Date;
  endDateTime: Date;
  durationMinutes: number;
  quantity: number;
  isSplit?: boolean;
  parentId?: string;
};
