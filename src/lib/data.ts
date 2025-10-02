import type { Machine, Order, Process } from '@/lib/types';
import { Scissors, Printer, Fingerprint, ExternalLink, MoveHorizontal, PackageCheck } from 'lucide-react';
import { addDays, startOfToday } from 'date-fns';

export const MACHINES: Machine[] = [
  { id: 'm1', name: 'Cutting Machine Alpha', processIds: ['cutting'] },
  { id: 'm2', name: 'Printing Station', processIds: ['printing'] },
  { id: 'm3', name: 'Embroidery Station', processIds: ['embroidery'] },
  { id: 'm4', name: 'Sewing Station 1', processIds: ['sewing'] },
  { id: 'm5', name: 'Sewing Station 2', processIds: ['sewing'] },
  { id: 'm6', name: 'Finishing & QC', processIds: ['packing'] },
];

export const PROCESSES: Process[] = [
  { id: 'cutting', name: 'Cutting', sam: 5, icon: Scissors, color: 'hsl(var(--chart-1))' },
  { id: 'printing', name: 'Printing', sam: 15, icon: Printer, color: 'hsl(var(--chart-2))' },
  { id: 'embroidery', name: 'Embroidery', sam: 20, icon: Fingerprint, color: 'hsl(var(--chart-3))' },
  { id: 'outsourcing', name: 'Outsourcing', sam: 1, icon: ExternalLink, color: 'hsl(var(--muted-foreground))' },
  { id: 'sewing', name: 'Sewing', sam: 25, icon: MoveHorizontal, color: 'hsl(var(--chart-4))' },
  { id: 'packing', name: 'Packing', sam: 8, icon: PackageCheck, color: 'hsl(var(--chart-5))' },
];

const today = startOfToday();

export const ORDERS: Order[] = [
    { 
        id: 'ZAR4531-Shirt-Blue', 
        ocn: 'ZAR4531',
        buyer: 'Zara',
        style: 'Shirt',
        color: 'Blue',
        quantity: 100,
        processIds: ['cutting', 'printing', 'sewing', 'packing'],
        dueDate: addDays(today, 10)
    },
    { 
        id: 'HNM1234-Pants-Black', 
        ocn: 'HNM1234',
        buyer: 'H&M',
        style: 'Pants',
        color: 'Black',
        quantity: 200,
        processIds: ['cutting', 'embroidery', 'sewing', 'packing'],
        dueDate: addDays(today, 15)
    },
    { 
        id: 'GAP9876-TShirt-White', 
        ocn: 'GAP9876',
        buyer: 'Gap',
        style: 'T-Shirt',
        color: 'White',
        quantity: 150,
        processIds: ['cutting', 'sewing', 'packing', 'outsourcing'],
        dueDate: addDays(today, 7)
    }
];

// Assuming an 8-hour work day
export const WORK_DAY_MINUTES = 8 * 60;
