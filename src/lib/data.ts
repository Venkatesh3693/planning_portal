import type { Machine, Order, Process } from '@/lib/types';
import { Scissors, Pin, Shirt, PackageCheck, DraftingCompass } from 'lucide-react';

export const MACHINES: Machine[] = [
  { id: 'm1', name: 'Cutting Machine Alpha' },
  { id: 'm2', name: 'Sewing Station 1' },
  { id: 'm3', name: 'Sewing Station 2' },
  { id: 'm4', name: 'Finishing & QC' },
  { id: 'm5', name: 'Pattern Drafting Table' },
];

export const PROCESSES: Process[] = [
  { id: 'p1', name: 'Cut Fabric', sam: 5, icon: Scissors },
  { id: 'p2', name: 'Draft Pattern', sam: 20, icon: DraftingCompass },
  { id: 'p3', name: 'Sew Sleeves', sam: 12, icon: Pin },
  { id: 'p4', name: 'Assemble Shirt', sam: 25, icon: Shirt },
  { id: 'p5', name: 'Final Inspection & Pack', sam: 8, icon: PackageCheck },
  { id: 'p6', name: 'Cut Pockets', sam: 2, icon: Scissors },
];

export const ORDERS: Order[] = [
    { 
        id: 'ZAR4531-Shirt-Blue', 
        ocn: 'ZAR4531',
        buyer: 'Zara',
        style: 'Shirt',
        color: 'Blue',
        quantity: 100,
        processIds: ['p2', 'p1', 'p6', 'p3', 'p4', 'p5']
    },
    { 
        id: 'HNM1234-Pants-Black', 
        ocn: 'HNM1234',
        buyer: 'H&M',
        style: 'Pants',
        color: 'Black',
        quantity: 200,
        processIds: ['p2', 'p1', 'p6', 'p4', 'p5']
    },
    { 
        id: 'GAP9876-TShirt-White', 
        ocn: 'GAP9876',
        buyer: 'Gap',
        style: 'T-Shirt',
        color: 'White',
        quantity: 150,
        processIds: ['p1', 'p4', 'p5']
    }
];

// Assuming an 8-hour work day
export const WORK_DAY_MINUTES = 8 * 60;
