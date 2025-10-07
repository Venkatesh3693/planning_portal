
import type { Unit, Machine, Order, Process } from '@/lib/types';
import { Scissors, Printer, Fingerprint, ExternalLink, MoveHorizontal, PackageCheck } from 'lucide-react';
import { addDays, subDays, startOfToday } from 'date-fns';

export const UNITS: Unit[] = [
  { id: 'u1', name: 'Unit 1' },
  { id: 'u2', name: 'Unit 2' },
  { id: 'u3', name: 'Unit 3' },
];

export const MACHINES: Machine[] = [
  { id: 'm1', name: 'Cutting Machine Alpha', processIds: ['cutting'], unitId: 'u1', isMoveable: false },
  { id: 'm2', name: 'Printing Station', processIds: ['printing'], unitId: 'u1', isMoveable: false },
  { id: 'm3', name: 'Embroidery Station', processIds: ['embroidery'], unitId: 'u2', isMoveable: false },
  { id: 'm4', name: 'Sewing Station 1', processIds: ['sewing'], unitId: 'u2', isMoveable: true },
  { id: 'm5', name: 'Sewing Station 2', processIds: ['sewing'], unitId: 'u2', isMoveable: true },
  { id: 'm6', name: 'Finishing & QC', processIds: ['packing'], unitId: 'u3', isMoveable: false },
  { id: 'm7', name: 'Cutting Machine Beta', processIds: ['cutting'], unitId: 'u3', isMoveable: false },
  { id: 'm8', name: 'Sewing Station 3', processIds: ['sewing'], unitId: 'u3', isMoveable: true },
  { id: 'm9', name: 'Sewing Station 4', processIds: ['sewing'], unitId: 'u3', isMoveable: false },
];


export const PROCESSES: Process[] = [
  { id: 'cutting', name: 'Cutting', sam: 5, icon: Scissors, color: 'hsl(var(--chart-1))', singleRunOutput: 500 },
  { id: 'printing', name: 'Printing', sam: 10, icon: Printer, color: 'hsl(var(--chart-2))', singleRunOutput: 250 },
  { id: 'embroidery', name: 'Embroidery', sam: 6, icon: Fingerprint, color: 'hsl(var(--chart-3))', singleRunOutput: 200 },
  { id: 'outsourcing', name: 'Outsourcing', sam: 1, icon: ExternalLink, color: 'hsl(var(--muted-foreground))', singleRunOutput: 1000 },
  { id: 'sewing', name: 'Sewing', sam: 15, icon: MoveHorizontal, color: 'hsl(var(--chart-4))', singleRunOutput: 150 },
  { id: 'packing', name: 'Packing', sam: 8, icon: PackageCheck, color: 'hsl(var(--chart-5))', singleRunOutput: 400 },
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
        dueDate: addDays(today, 10),
        tna: {
            ckDate: subDays(today, 5),
            processes: [
                { processId: 'cutting', startDate: subDays(today, 2), endDate: subDays(today, 1), setupTime: 45 },
                { processId: 'printing', startDate: today, endDate: addDays(today, 1), setupTime: 90 },
                { processId: 'sewing', startDate: addDays(today, 2), endDate: addDays(today, 5), setupTime: 120 },
                { processId: 'packing', startDate: addDays(today, 6), endDate: addDays(today, 8), setupTime: 15 },
            ]
        }
    },
    { 
        id: 'HNM1234-Pants-Black', 
        ocn: 'HNM1234',
        buyer: 'H&M',
        style: 'Pants',
        color: 'Black',
        quantity: 1200,
        processIds: ['cutting', 'embroidery', 'sewing', 'packing'],
        dueDate: addDays(today, 15),
        tna: {
            ckDate: subDays(today, 10),
            processes: [
                { processId: 'cutting', startDate: subDays(today, 5), endDate: subDays(today, 3), setupTime: 60 },
                { processId: 'embroidery', startDate: subDays(today, 2), endDate: addDays(today, 2), setupTime: 150 },
                { processId: 'sewing', startDate: addDays(today, 3), endDate: addDays(today, 9), setupTime: 180 },
                { processId: 'packing', startDate: addDays(today, 10), endDate: addDays(today, 13), setupTime: 20 },
            ]
        }
    },
    { 
        id: 'GAP9876-TShirt-White', 
        ocn: 'GAP9876',
        buyer: 'Gap',
        style: 'T-Shirt',
        color: 'White',
        quantity: 150,
        processIds: ['cutting', 'sewing', 'packing', 'outsourcing'],
        dueDate: addDays(today, 7),
        tna: {
            ckDate: subDays(today, 8),
            processes: [
                { processId: 'cutting', startDate: subDays(today, 6), endDate: subDays(today, 5), setupTime: 30 },
                { processId: 'sewing', startDate: subDays(today, 4), endDate: addDays(today, 1), setupTime: 100 },
                { processId: 'outsourcing', startDate: addDays(today, 2), endDate: addDays(today, 3), setupTime: 0 },
                { processId: 'packing', startDate: addDays(today, 4), endDate: addDays(today, 5), setupTime: 10 },
            ]
        }
    }
];

// Assuming an 8-hour work day
export const WORK_DAY_MINUTES = 8 * 60;
