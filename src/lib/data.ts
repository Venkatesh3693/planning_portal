import type { Machine, Order, Process } from '@/lib/types';
import { Scissors, Printer, Fingerprint, ExternalLink, MoveHorizontal, PackageCheck } from 'lucide-react';

export const MACHINES: Machine[] = [
  { id: 'm1', name: 'Cutting Machine Alpha', processIds: ['cutting'] },
  { id: 'm2', name: 'Printing Station', processIds: ['printing'] },
  { id: 'm3', name: 'Embroidery Station', processIds: ['embroidery'] },
  { id: 'm4', name: 'Sewing Station 1', processIds: ['sewing'] },
  { id: 'm5', name: 'Sewing Station 2', processIds: ['sewing'] },
  { id: 'm6', name: 'Finishing & QC', processIds: ['packing'] },
];

export const PROCESSES: Process[] = [
  { id: 'cutting', name: 'Cutting', sam: 5, icon: Scissors },
  { id: 'printing', name: 'Printing', sam: 15, icon: Printer },
  { id: 'embroidery', name: 'Embroidery', sam: 20, icon: Fingerprint },
  { id: 'outsourcing', name: 'Outsourcing', sam: 1, icon: ExternalLink },
  { id: 'sewing', name: 'Sewing', sam: 25, icon: MoveHorizontal },
  { id: 'packing', name: 'Packing', sam: 8, icon: PackageCheck },
];

export const ORDERS: Order[] = [
    { 
        id: 'ZAR4531-Shirt-Blue', 
        ocn: 'ZAR4531',
        buyer: 'Zara',
        style: 'Shirt',
        color: 'Blue',
        quantity: 100,
        processIds: ['cutting', 'printing', 'sewing', 'packing']
    },
    { 
        id: 'HNM1234-Pants-Black', 
        ocn: 'HNM1234',
        buyer: 'H&M',
        style: 'Pants',
        color: 'Black',
        quantity: 200,
        processIds: ['cutting', 'embroidery', 'sewing', 'packing']
    },
    { 
        id: 'GAP9876-TShirt-White', 
        ocn: 'GAP9876',
        buyer: 'Gap',
        style: 'T-Shirt',
        color: 'White',
        quantity: 150,
        processIds: ['cutting', 'sewing', 'packing', 'outsourcing']
    }
];

// Assuming an 8-hour work day
export const WORK_DAY_MINUTES = 8 * 60;
