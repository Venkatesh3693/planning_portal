

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

export type ForecastDetail = {
  noPo: number;
  openPos: number;
  grn: number;
  total: number;
};

export type Size = '2XS' | 'XS' | 'S' | 'M' | 'L' | 'XL' | '2XL' | '3XL' | '4XL' | '5XL';

export type SizeBreakdown = {
  [key in Size]?: number;
} & { total: number };

export type PoDetail = {
  poNumber: string;
  ehd: Date;
  chd: Date;
  destination: string;
  quantities: SizeBreakdown;
  productionStatus: 'not-started' | 'in-progress' | 'completed';
  inspectionStatus: 'not-started' | 'in-progress' | 'completed';
  shippingStatus: 'not-shipped' | 'shipped-late' | 'shipped-on-time';
};

export type DemandDetail = {
  destination: string;
  selectionQty: number;
  po: number;
  fc: number;
  poPlusFc: number;
};

export type FcComposition = {
  po: number;
  fc: number;
};

export type FcSnapshot = {
  snapshotWeek: number;
  forecasts: Record<string, Record<Size | 'total', FcComposition>>;
};

export type StatusDetail = {
  quantities: SizeBreakdown;
  componentCount: number;
};

export type ProjectionDetail = {
  projectionNumber: string;
  projectionDate: Date;
  receiptDate: Date;
  frcQty: number;
  total: StatusDetail;
  grn: StatusDetail;
  openPo: StatusDetail;
  noPo: StatusDetail;
  totalComponents: number;
};

export type BomItem = {
  componentName: string;
  sizeDependent: boolean;
  source: 'Import' | 'Local';
  leadTime: number; // in days
  supplier: string;
  forecastType: 'Projection' | 'FRC';
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
  season?: string;
  poFcQty?: number;
  projection?: ForecastDetail;
  frc?: ForecastDetail;
  confirmedPoQty?: number;
  cutOrder?: SizeBreakdown;
  produced?: SizeBreakdown;
  shipped?: SizeBreakdown;
  poDetails?: PoDetail[];
  demandDetails?: DemandDetail[];
  fcVsFcDetails?: FcSnapshot[];
  projectionDetails?: ProjectionDetail[];
  bom?: BomItem[];
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
