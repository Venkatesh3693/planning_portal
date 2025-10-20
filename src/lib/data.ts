

import type { Unit, Machine, Order, Process, SewingOperation, Size, PoDetail, DemandDetail, FcSnapshot, FcComposition, ProjectionDetail, BomItem } from '@/lib/types';
import { Scissors, Printer, Fingerprint, ExternalLink, MoveHorizontal, PackageCheck } from 'lucide-react';
import { addDays, subDays, startOfToday, getWeek } from 'date-fns';

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

export const SIZES: Size[] = ['2XS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];


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

const dmiPoDetails: PoDetail[] = [
  {
    poNumber: 'PO-DMI-001',
    ehd: new Date(currentYear, 10, 15),
    chd: new Date(currentYear, 10, 17),
    destination: 'New York, USA',
    quantities: { 'XS': 5000, 'S': 10000, 'M': 15000, 'L': 10000, 'XL': 5000, total: 45000 },
    productionStatus: 'completed',
    inspectionStatus: 'completed',
    shippingStatus: 'shipped-on-time',
  },
  {
    poNumber: 'PO-DMI-002',
    ehd: new Date(currentYear, 11, 1),
    chd: new Date(currentYear, 11, 3),
    destination: 'London, UK',
    quantities: { 'S': 5000, 'M': 10000, 'L': 10000, 'XL': 10000, '2XL': 5000, total: 40000 },
    productionStatus: 'in-progress',
    inspectionStatus: 'not-started',
    shippingStatus: 'not-shipped',
  },
  {
    poNumber: 'PO-DMI-003',
    ehd: new Date(currentYear, 11, 10),
    chd: new Date(currentYear, 11, 10),
    destination: 'Tokyo, Japan',
    quantities: { '2XS': 1000, 'XS': 2000, 'S': 2000, 'M': 5000, total: 10000 },
    productionStatus: 'not-started',
    inspectionStatus: 'not-started',
    shippingStatus: 'not-shipped',
  },
];

const dsiPoDetails: PoDetail[] = [
  {
    poNumber: 'PO-DSI-201',
    ehd: new Date(currentYear, 9, 20),
    chd: new Date(currentYear, 9, 22),
    destination: 'Berlin, DE',
    quantities: { 'M': 20000, 'L': 30000, 'XL': 25000, '2XL': 5000, total: 80000 },
    productionStatus: 'completed',
    inspectionStatus: 'completed',
    shippingStatus: 'shipped-late',
  },
  {
    poNumber: 'PO-DSI-202',
    ehd: new Date(currentYear, 10, 5),
    chd: new Date(currentYear, 10, 5),
    destination: 'Paris, FR',
    quantities: { 'L': 25000, 'XL': 35000, '2XL': 20000, '3XL': 20000, total: 100000 },
    productionStatus: 'completed',
    inspectionStatus: 'in-progress',
    shippingStatus: 'not-shipped',
  },
];

const dmiDemandDetails: DemandDetail[] = [
    { destination: 'New York, USA', selectionQty: 50000, po: 45000, fc: 5000, poPlusFc: 50000 },
    { destination: 'London, UK', selectionQty: 50000, po: 40000, fc: 15000, poPlusFc: 55000 },
    { destination: 'Tokyo, Japan', selectionQty: 50000, po: 10000, fc: 35000, poPlusFc: 45000 },
];

const dsiDemandDetails: DemandDetail[] = [
    { destination: 'Berlin, DE', selectionQty: 100000, po: 80000, fc: 25000, poPlusFc: 105000 },
    { destination: 'Paris, FR', selectionQty: 150000, po: 100000, fc: 40000, poPlusFc: 140000 },
];

const CURRENT_WEEK = getWeek(new Date());
const FIRM_PO_WINDOW = 3; // weeks

const generateFcBreakdown = (total: number): Record<Size, number> => {
    const breakdown: Record<Size, number> = {} as Record<Size, number>;
    const numSizes = SIZES.length;
    let baseQty = Math.floor(total / numSizes);
    let remainder = total % numSizes;

    SIZES.forEach(size => {
        let qty = baseQty;
        if (remainder > 0) {
            qty++;
            remainder--;
        }
        breakdown[size] = qty;
    });

    return breakdown;
};


const generateFcSnapshots = (
    seasonStartWeek: number,
    currentWeek: number,
    initialQtyPerWeek: number,
    volatility: number = 500
): FcSnapshot[] => {
    const snapshots: FcSnapshot[] = [];
    const seasonEndWeek = currentWeek + 8; // Project 8 weeks into the future
    
    // This will hold the "true" forecast for each week, evolving over time.
    let weeklyForecasts: Record<string, number> = {};
    for (let w = seasonStartWeek; w <= seasonEndWeek; w++) {
        weeklyForecasts[`W${w}`] = initialQtyPerWeek;
    }

    // This will store the locked PO values once a week becomes firm.
    const lockedPoValues: Record<string, Record<Size | 'total', FcComposition>> = {};

    // Generate snapshots from season start up to the current week
    for (let s = seasonStartWeek; s <= currentWeek; s++) {
        const snapshotWeek = s;
        const snapshot: FcSnapshot = { snapshotWeek, forecasts: {} };

        // Apply volatility to future forecasts
        for (let w = snapshotWeek; w <= seasonEndWeek; w++) {
             const weekKey = `W${w}`;
            // Don't change forecast if it's already a locked PO
            if (!lockedPoValues[weekKey]) {
                const newQty = Math.max(0, weeklyForecasts[weekKey] + (Math.random() - 0.5) * volatility);
                weeklyForecasts[weekKey] = newQty;
            }
        }

        // For the current snapshot, build the forecast for all demand weeks
        for (let d = seasonStartWeek; d <= seasonEndWeek; d++) {
            const demandWeek = d;
            const weekKey = `W${demandWeek}`;
            
            // If this demand week is now a locked PO, use the locked value.
            if (lockedPoValues[weekKey]) {
                snapshot.forecasts[weekKey] = lockedPoValues[weekKey];
                continue;
            }

            const totalQty = Math.round(weeklyForecasts[weekKey] || 0);
            const sizeBreakdown = generateFcBreakdown(totalQty);
            const isFirmPo = demandWeek <= snapshotWeek + FIRM_PO_WINDOW;

            const breakdown: Record<Size | 'total', FcComposition> = {
                total: { po: isFirmPo ? totalQty : 0, fc: isFirmPo ? 0 : totalQty }
            };

            SIZES.forEach(size => {
                const qty = sizeBreakdown[size] || 0;
                breakdown[size] = { po: isFirmPo ? qty : 0, fc: isFirmPo ? 0 : qty };
            });

            snapshot.forecasts[weekKey] = breakdown;
            
            // If this week just became a firm PO, lock its value for future snapshots.
            if (isFirmPo) {
                lockedPoValues[weekKey] = breakdown;
            }
        }
        snapshots.push(snapshot);
    }
    return snapshots;
};

const dmiFcVsFcDetails: FcSnapshot[] = generateFcSnapshots(CURRENT_WEEK - 5, CURRENT_WEEK, 20000, 1000);
const dsiFcVsFcDetails: FcSnapshot[] = generateFcSnapshots(CURRENT_WEEK - 5, CURRENT_WEEK, 50000, 2500);

const dmiProjectionDetails: ProjectionDetail[] = [
  { projectionNumber: 'PRJ-DMI-01', projectionDate: subDays(today, 60), projectionQty: 40000, poQty: 30000, grnQty: 25000, receiptDate: subDays(today, 10) },
  { projectionNumber: 'PRJ-DMI-02', projectionDate: subDays(today, 45), projectionQty: 42000, poQty: 40000, grnQty: 38000, receiptDate: subDays(today, 5) },
  { projectionNumber: 'PRJ-DMI-03', projectionDate: subDays(today, 30), projectionQty: 45000, poQty: 45000, grnQty: 0, receiptDate: addDays(today, 15) },
  { projectionNumber: 'PRJ-DMI-04', projectionDate: subDays(today, 15), projectionQty: 50000, poQty: 0, grnQty: 0, receiptDate: addDays(today, 30) },
];

const dsiProjectionDetails: ProjectionDetail[] = [
  { projectionNumber: 'PRJ-DSI-01', projectionDate: subDays(today, 50), projectionQty: 100000, poQty: 80000, grnQty: 75000, receiptDate: subDays(today, 20) },
  { projectionNumber: 'PRJ-DSI-02', projectionDate: subDays(today, 25), projectionQty: 120000, poQty: 100000, grnQty: 0, receiptDate: addDays(today, 25) },
];

const paddedJacketBom: BomItem[] = [
  { componentName: 'Shell Fabric (Nylon)', sizeDependent: true, source: 'Import', leadTime: 90, supplier: 'Global Textiles', forecastType: 'Projection' },
  { componentName: 'Lining Fabric (Polyester)', sizeDependent: true, source: 'Local', leadTime: 30, supplier: 'Local Weavers', forecastType: 'FRC' },
  { componentName: 'Insulation Padding (Down)', sizeDependent: true, source: 'Import', leadTime: 100, supplier: 'Feather Inc.', forecastType: 'Projection' },
  { componentName: 'Main Zipper', sizeDependent: false, source: 'Import', leadTime: 60, supplier: 'YKK', forecastType: 'Projection' },
  { componentName: 'Pocket Zippers', sizeDependent: false, source: 'Import', leadTime: 60, supplier: 'YKK', forecastType: 'FRC' },
  { componentName: 'Sewing Thread', sizeDependent: false, source: 'Local', leadTime: 7, supplier: 'Stitch Co.', forecastType: 'FRC' },
  { componentName: 'Cuff Elastic', sizeDependent: false, source: 'Local', leadTime: 20, supplier: 'Elasticorp', forecastType: 'FRC' },
  { componentName: 'Brand Label', sizeDependent: false, source: 'Import', leadTime: 45, supplier: 'LabelMakers Inc.', forecastType: 'Projection' },
];

const pantsBom: BomItem[] = [
  { componentName: 'Main Fabric (Twill)', sizeDependent: true, source: 'Import', leadTime: 75, supplier: 'Premium Fabrics', forecastType: 'Projection' },
  { componentName: 'Pocketing Fabric', sizeDependent: true, source: 'Local', leadTime: 20, supplier: 'Local Weavers', forecastType: 'FRC' },
  { componentName: 'Zipper', sizeDependent: false, source: 'Import', leadTime: 50, supplier: 'YKK', forecastType: 'Projection' },
  { componentName: 'Button', sizeDependent: false, source: 'Import', leadTime: 50, supplier: 'Button World', forecastType: 'Projection' },
  { componentName: 'Sewing Thread', sizeDependent: false, source: 'Local', leadTime: 7, supplier: 'Stitch Co.', forecastType: 'FRC' },
  { componentName: 'Brand Label', sizeDependent: false, source: 'Import', leadTime: 45, supplier: 'LabelMakers Inc.', forecastType: 'Projection' },
  { componentName: 'Polybag', sizeDependent: false, source: 'Local', leadTime: 15, supplier: 'PackRight', forecastType: 'FRC' },
  { componentName: 'Carton Box', sizeDependent: false, source: 'Local', leadTime: 10, supplier: 'BoxFactory', forecastType: 'FRC' },
];


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
        style: 'Padded Jacket',
        color: 'Purple',
        modelNo: 556622,
        season: 'AW-25',
        quantity: 150000,
        poFcQty: 150000,
        projection: { noPo: 50000, openPos: 40000, grn: 30000, total: 120000 },
        frc: { noPo: 40000, openPos: 35000, grn: 25000, total: 100000 },
        confirmedPoQty: 95000,
        cutOrder: { '2XS': 9000, 'XS': 9000, 'S': 9000, 'M': 9000, 'L': 9000, 'XL': 9000, '2XL': 9000, '3XL': 9000, '4XL': 9000, '5XL': 9000, total: 90000 },
        produced: { '2XS': 7500, 'XS': 7500, 'S': 7500, 'M': 7500, 'L': 7500, 'XL': 7500, '2XL': 7500, '3XL': 7500, '4XL': 7500, '5XL': 7500, total: 75000 },
        shipped: { '2XS': 5000, 'XS': 5000, 'S': 5000, 'M': 5000, 'L': 5000, 'XL': 5000, '2XL': 5000, '3XL': 5000, '4XL': 5000, '5XL': 5000, total: 50000 },
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
        },
        poDetails: dmiPoDetails,
        demandDetails: dmiDemandDetails,
        fcVsFcDetails: dmiFcVsFcDetails,
        projectionDetails: dmiProjectionDetails,
        bom: paddedJacketBom,
    },
    {
        id: 'DSI-300096-Green',
        ocn: '300096',
        buyer: 'DSI',
        style: 'Pants',
        color: 'Green',
        modelNo: 778899,
        season: 'SS-26',
        quantity: 250000,
        poFcQty: 250000,
        projection: { noPo: 100000, openPos: 75000, grn: 50000, total: 225000 },
        frc: { noPo: 80000, openPos: 70000, grn: 50000, total: 200000 },
        confirmedPoQty: 180000,
        cutOrder: { '2XS': 18000, 'XS': 18000, 'S': 18000, 'M': 18000, 'L': 18000, 'XL': 18000, '2XL': 18000, '3XL': 18000, '4XL': 18000, '5XL': 17000, total: 179000 },
        produced: { '2XS': 15000, 'XS': 15000, 'S': 15000, 'M': 15000, 'L': 15000, 'XL': 15000, '2XL': 15000, '3XL': 15000, '4XL': 15000, '5XL': 15000, total: 150000 },
        shipped: { '2XS': 12000, 'XS': 12000, 'S': 12000, 'M': 12000, 'L': 12000, 'XL': 12000, '2XL': 12000, '3XL': 12000, '4XL': 12000, '5XL': 12000, total: 120000 },
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
        },
        poDetails: dsiPoDetails,
        demandDetails: dsiDemandDetails,
        fcVsFcDetails: dsiFcVsFcDetails,
        projectionDetails: dsiProjectionDetails,
        bom: pantsBom,
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
    'Padded Jacket': [
      { operation: 'Shell & Lining Cutting', machine: 'Cutting Machine Alpha', operators: 1, sam: 5.0, grade: 'B' },
      { operation: 'Padding Cutting & Quilting', machine: 'Chain Stitch Machine', operators: 1, sam: 8.0, grade: 'A' },
      { operation: 'Front Pocket Setting', machine: 'Single Needle Lock Stitch', operators: 1, sam: 4.5, grade: 'B' },
      { operation: 'Front Zipper Attachment', machine: 'Single Needle Lock Stitch', operators: 1, sam: 5.0, grade: 'A' },
      { operation: 'Sleeve Assembly', machine: 'Over Lock Machine', operators: 1, sam: 6.0, grade: 'C' },
      { operation: 'Sleeve Attachment to Body', machine: 'Over Lock Machine', operators: 1, sam: 5.5, grade: 'B' },
      { operation: 'Joining Shell and Lining', machine: 'Single Needle Lock Stitch', operators: 1, sam: 7.0, grade: 'A' },
      { operation: 'Cuff & Hem Finishing', machine: 'Flat Lock Machine', operators: 1, sam: 4.0, grade: 'C' },
    ],
  };

// Assuming an 8-hour work day
export const WORK_DAY_MINUTES = 8 * 60;

    