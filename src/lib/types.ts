import type { LucideIcon } from 'lucide-react';

export type Unit = {
  id: string;
  name: string;
};

export type Machine = {
  id: string;
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
};

export type ScheduledProcess = {
  id: string; // unique id for the scheduled instance
  orderId: string;
  processId: string;
  machineId: string;
  startDate: Date;
  durationDays: number;
};
