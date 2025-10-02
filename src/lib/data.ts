import type { Machine, Process } from '@/lib/types';
import { Scissors, Pin, Shirt, PackageCheck, DraftingCompass } from 'lucide-react';

export const MACHINES: Machine[] = [
  { id: 'm1', name: 'Cutting Machine Alpha' },
  { id: 'm2', name: 'Sewing Station 1' },
  { id: 'm3', name: 'Sewing Station 2' },
  { id: 'm4', name: 'Finishing & QC' },
];

export const PROCESSES: Process[] = [
  { id: 'p1', name: 'Cut Fabric', sam: 5, orderQuantity: 100, icon: Scissors },
  { id: 'p2', name: 'Draft Pattern', sam: 20, orderQuantity: 10, icon: DraftingCompass },
  { id: 'p3', name: 'Sew Sleeves', sam: 12, orderQuantity: 50, icon: Pin },
  { id: 'p4', name: 'Assemble Shirt', sam: 25, orderQuantity: 50, icon: Shirt },
  { id: 'p5', name: 'Final Inspection & Pack', sam: 8, orderQuantity: 100, icon: PackageCheck },
  { id: 'p6', name: 'Cut Pockets', sam: 2, orderQuantity: 200, icon: Scissors },
];

// Assuming an 8-hour work day
export const WORK_DAY_MINUTES = 8 * 60;
