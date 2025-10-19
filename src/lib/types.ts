
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
  setupTime: number; // in minutes
  durationDays?: number;
  earliestStartDate?: Date;
  latestStartDate?: Date;
};

export type Tna = {
  processes: TnaProcess[];
  minRunDays?: Record<string, number>;
};

export type RampUpEntry = {
  day: number;
  efficiency: number; // As a percentage, e.g., 85 for 85%
};

export type SewingOperation = {
  operation: string;
  machine: string;
  operators: number;
  sam: number;
  grade: 'A' | 'B' | 'C' | 'D';
};

export type Order = {
  id: string; // e.g. 'ZAR4531-Shirt-Blue'
  ocn: string; // e.g. 'ZAR4531'
  buyer: string; // e.g. 'Zara'
  style: string; // e.g. 'Shirt'
  color: string; // e.g. 'Blue'
  quantity: number;
  processIds: string[];
  dueDate?: Date;
  tna?: Tna;
  displayColor?: string;
  leadTime?: number;
  budgetedEfficiency?: number;
  sewingRampUpScheme?: RampUpEntry[];
  orderType: 'Firm PO' | 'Forecasted';
  modelNo?: number;
  projectionQty?: number;
  frcQty?: number;
  confirmedPoQty?: number;
  cutOrderQty?: number;
  producedQty?: number;
  shippedQty?: number;
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
  batchNumber?: number;
  isAutoScheduled?: boolean;
  totalBatches?: number;
  latestStartDate?: Date;
  latestEndDate?: Date;
};

export type UnplannedBatch = {
  orderId: string;
  processId: string;
  quantity: number;
  batchNumber: number;
  totalBatches: number;
  latestStartDate: Date;
};
