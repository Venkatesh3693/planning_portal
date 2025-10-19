
import type { Unit, Machine, Order, Process, SewingOperation } from '@/lib/types';
import { Scissors, Printer, Fingerprint, ExternalLink, MoveHorizontal, PackageCheck } from 'lucide-react';
import { addDays, subDays, startOfToday } from 'date-fns';

export const UNITS: Unit[] = [
  { id: 'u1', name: 'Unit 1' },
  { id: 'u2', name: 'Unit 2' },
  { id: 'u3', name: 'Unit 3' },
];

export const MACHINES: Machine[] = [
  { id: 'm1', name: 'Cutting Machine Alpha', processIds: ['cutting'], unitId: 'u1', isMoveable: false },
  { id: 'm2', name: 'Printing Station 1', processIds: ['printing'], unitId: 'u1', isMoveable: false },
  { id: 'm10', name: 'Printing Station 2', processIds: ['printing'], unitId: 'u1', isMoveable: false },
  { id: 'm3', name: 'Embroidery Station 1', processIds: ['embroidery'], unitId: 'u2', isMoveable: false },
  { id: 'm11', name: 'Embroidery Station 2', processIds: ['embroidery'], unitId: 'u2', isMoveable: false },
  { id: 'm4', name: 'Sewing Station 1', processIds: ['sewing'], unitId: 'u2', isMoveable: true },
  { id: 'm5', name: 'Sewing Station 2', processIds: ['sewing'], unitId: 'u2', isMoveable: true },
  { id: 'm7', name: 'Cutting Machine Beta', processIds: ['cutting'], unitId: 'u3', isMoveable: false },
  { id: 'm8', name: 'Sewing Station 3', processIds: ['sewing'], unitId: 'u3', isMoveable: true },
  { id: 'm9', name: 'Sewing Station 4', processIds: ['sewing'], unitId: 'u3', isMoveable: false },
  { id: 'm12', name: 'Packing table 1', processIds: ['packing'], unitId: 'u3', isMoveable: false },
  { id: 'm13', name: 'Packing table 2', processIds: ['packing'], unitId: 'u3', isMoveable: false },
];

export const ORDER_COLORS = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
    'hsl(217, 91%, 60%)', // primary
    'hsl(330, 84%, 50%)', // A vibrant pink
    'hsl(50, 95%, 55%)',  // A bright yellow
];


export const PROCESSES: Process[] = [
  { id: 'cutting', name: 'Cutting', sam: 5, icon: Scissors, color: 'hsl(var(--chart-1))', singleRunOutput: 500 },
  { id: 'printing', name: 'Printing', sam: 10, icon: Printer, color: 'hsl(var(--chart-2))', singleRunOutput: 250 },
  { id: 'embroidery', name: 'Embroidery', sam: 6, icon: Fingerprint, color: 'hsl(var(--chart-3))', singleRunOutput: 200 },
  { id: 'outsourcing', name: 'Outsourcing', sam: 1, icon: ExternalLink, color: 'hsl(var(--muted-foreground))', singleRunOutput: 1000 },
  { id: 'sewing', name: 'Sewing', sam: 15, icon: MoveHorizontal, color: 'hsl(var(--chart-4))', singleRunOutput: 150 },
  { id: 'packing', name: 'Packing', sam: 2, icon: PackageCheck, color: 'hsl(var(--chart-5))', singleRunOutput: 400 },
];

const today = startOfToday();
const currentYear = today.getFullYear();

export const ORDERS: Order[] = [
    {
        id: 'ZAR4531-Shirt-Blue',
        ocn: 'ZAR4531',
        buyer: 'Zara',
        style: 'Shirt',
        color: 'Blue',
        quantity: 500,
        processIds: ['cutting', 'printing', 'sewing', 'packing'],
        dueDate: new Date(currentYear, 10, 20), // November 20
        displayColor: ORDER_COLORS[0],
        leadTime: 60,
        budgetedEfficiency: 85,
        orderType: 'Firm PO',
        tna: {
            processes: [
                { processId: 'cutting', setupTime: 45 },
                { processId: 'printing', setupTime: 90 },
                { processId: 'sewing', setupTime: 120 },
                { processId: 'packing', setupTime: 15 },
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
        dueDate: new Date(currentYear, 11, 5), // December 5
        displayColor: ORDER_COLORS[1],
        leadTime: 90,
        budgetedEfficiency: 80,
        orderType: 'Firm PO',
        tna: {
            processes: [
                { processId: 'cutting', setupTime: 60 },
                { processId: 'embroidery', setupTime: 150 },
                { processId: 'sewing', setupTime: 180 },
                { processId: 'packing', setupTime: 20 },
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
        processIds: ['cutting', 'printing', 'sewing', 'packing'],
        dueDate: new Date(currentYear, 10, 28), // November 28
        displayColor: ORDER_COLORS[2],
        leadTime: 45,
        budgetedEfficiency: 90,
        orderType: 'Firm PO',
        tna: {
            processes: [
                { processId: 'cutting', setupTime: 30 },
                { processId: 'printing', setupTime: 90 },
                { processId: 'sewing', setupTime: 100 },
                { processId: 'packing', setupTime: 10 },
            ]
        }
    },
    {
        id: 'DMI-114227-Purple',
        ocn: '114227',
        buyer: 'DMI',
        style: 'T-Shirt',
        color: 'Purple',
        modelNo: 556622,
        quantity: 800,
        processIds: ['cutting', 'sewing', 'packing'],
        displayColor: ORDER_COLORS[5],
        leadTime: 21,
        budgetedEfficiency: 75,
        orderType: 'Forecasted',
        tna: {
            processes: [
                { processId: 'cutting', setupTime: 30 },
                { processId: 'sewing', setupTime: 100 },
                { processId: 'packing', setupTime: 10 },
            ]
        }
    },
    {
        id: 'DSI-300096-Green',
        ocn: '300096',
        buyer: 'DSI',
        style: 'Pants',
        color: 'Green',
        modelNo: 778899,
        quantity: 2000,
        processIds: ['cutting', 'embroidery', 'sewing', 'packing'],
        displayColor: ORDER_COLORS[6],
        leadTime: 21,
        budgetedEfficiency: 78,
        orderType: 'Forecasted',
        tna: {
            processes: [
                { processId: 'cutting', setupTime: 60 },
                { processId: 'embroidery', setupTime: 150 },
                { processId: 'sewing', setupTime: 180 },
                { processId: 'packing', setupTime: 20 },
            ]
        }
    }
];

export const MACHINE_NAME_ABBREVIATIONS: Record<string, string> = {
    'Single Needle Lock Stitch': 'SNLS',
    'Over Lock Machine': 'OLM',
    'Chain Stitch Machine': 'CSM',
    'Bar Tack Machine': 'BTM',
    'Flat Lock Machine': 'FLM',
};

export const SEWING_OPERATIONS_BY_STYLE: Record<string, SewingOperation[]> = {
    'Shirt': [
      { operation: 'Collar Preparation', machine: 'Single Needle Lock Stitch', operators: 1, sam: 2.5, grade: 'B' },
      { operation: 'Collar Attachment', machine: 'Single Needle Lock Stitch', operators: 1, sam: 3.0, grade: 'A' },
      { operation: 'Cuff Preparation', machine: 'Single Needle Lock Stitch', operators: 1, sam: 2.0, grade: 'C' },
      { operation: 'Cuff Attachment', machine: 'Over Lock Machine', operators: 1, sam: 2.5, grade: 'B' },
      { operation: 'Sleeve Placket', machine: 'Single Needle Lock Stitch', operators: 1, sam: 3.5, grade: 'A' },
      { operation: 'Sleeve Attachment', machine: 'Over Lock Machine', operators: 1, sam: 4.0, grade: 'B' },
      { operation: 'Front & Back Panel Joining', machine: 'Over Lock Machine', operators: 1, sam: 2.0, grade: 'D' },
      { operation: 'Button Placket', machine: 'Single Needle Lock Stitch', operators: 1, sam: 3.0, grade: 'C' },
      { operation: 'Bottom Hemming', machine: 'Single Needle Lock Stitch', operators: 1, sam: 2.5, grade: 'D' },
    ],
    'Pants': [
      { operation: 'Pocket Preparation', machine: 'Single Needle Lock Stitch', operators: 1, sam: 3.0, grade: 'C' },
      { operation: 'Pocket Attachment', machine: 'Single Needle Lock Stitch', operators: 1, sam: 3.5, grade: 'B' },
      { operation: 'Zipper Attachment', machine: 'Single Needle Lock Stitch', operators: 1, sam: 4.0, grade: 'A' },
      { operation: 'Inseam Joining', machine: 'Over Lock Machine', operators: 1, sam: 3.0, grade: 'C' },
      { operation: 'Outseam Joining', machine: 'Over Lock Machine', operators: 1, sam: 3.0, grade: 'C' },
      { operation: 'Waistband Preparation', machine: 'Chain Stitch Machine', operators: 1, sam: 2.5, grade: 'B' },
      { operation: 'Waistband Attachment', machine: 'Chain Stitch Machine', operators: 1, sam: 4.5, grade: 'A' },
      { operation: 'Belt Loop Preparation', machine: 'Bar Tack Machine', operators: 1, sam: 2.0, grade: 'D' },
      { operation: 'Belt Loop Attachment', machine: 'Bar Tack Machine', operators: 1, sam: 3.0, grade: 'B' },
      { operation: 'Bottom Hemming', machine: 'Single Needle Lock Stitch', operators: 1, sam: 3.5, grade: 'D' },
    ],
    'T-Shirt': [
      { operation: 'Shoulder Joining', machine: 'Over Lock Machine', operators: 1, sam: 1.5, grade: 'D' },
      { operation: 'Neck Rib Attachment', machine: 'Over Lock Machine', operators: 1, sam: 2.0, grade: 'C' },
      { operation: 'Sleeve Attachment', machine: 'Over Lock Machine', operators: 1, sam: 2.5, grade: 'C' },
      { operation: 'Side Seam', machine: 'Over Lock Machine', operators: 1, sam: 2.0, grade: 'D' },
      { operation: 'Sleeve & Bottom Hemming', machine: 'Flat Lock Machine', operators: 1, sam: 3.0, grade: 'B' },
    ],
  };

// Assuming an 8-hour work day
export const WORK_DAY_MINUTES = 8 * 60;
