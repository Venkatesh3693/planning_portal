

import type { Unit, Machine, Order, Process, SewingOperation, Size, PoDetail, DemandDetail, FcSnapshot, FcComposition, ProjectionDetail, BomItem, ComponentStatusDetail, FrcDetail, SewingLine } from './types';
import { Scissors, Printer, Fingerprint, ExternalLink, MoveHorizontal, PackageCheck } from 'lucide-react';
import { addDays, subDays, startOfToday, getWeek, isBefore } from 'date-fns';

export const UNITS: Unit[] = [
  { id: 'u1', name: 'Unit 1' },
  { id: 'u2', name: 'Unit 2' },
  { id: 'u3', name: 'Unit 3' },
];

export const sewingMachineTypes = [
    'Single Needle Lock Stitch',
    'Over Lock Machine',
    'Flat Lock Machine',
    'Chain Stitch Machine',
    'Bar Tack Machine',
];

const generateSewingLinesAndMachines = (): { lines: SewingLine[], machines: Machine[] } => {
    const lines: SewingLine[] = [];
    const machines: Machine[] = [];
    const numLines = 7;

    const lineCompositions = [
        { 'Single Needle Lock Stitch': 10, 'Over Lock Machine': 8, 'Flat Lock Machine': 4, 'Chain Stitch Machine': 2, 'Bar Tack Machine': 1 },
        { 'Single Needle Lock Stitch': 12, 'Over Lock Machine': 7, 'Flat Lock Machine': 3, 'Chain Stitch Machine': 2, 'Bar Tack Machine': 1 },
        { 'Single Needle Lock Stitch': 8, 'Over Lock Machine': 10, 'Flat Lock Machine': 5, 'Chain Stitch Machine': 1, 'Bar Tack Machine': 1 },
        { 'Single Needle Lock Stitch': 15, 'Over Lock Machine': 5, 'Flat Lock Machine': 2, 'Chain Stitch Machine': 2, 'Bar Tack Machine': 1 },
        { 'Single Needle Lock Stitch': 9, 'Over Lock Machine': 9, 'Flat Lock Machine': 4, 'Chain Stitch Machine': 2, 'Bar Tack Machine': 1 },
        { 'Single Needle Lock Stitch': 11, 'Over Lock Machine': 6, 'Flat Lock Machine': 5, 'Chain Stitch Machine': 2, 'Bar Tack Machine': 1 },
        { 'Single Needle Lock Stitch': 10, 'Over Lock Machine': 7, 'Flat Lock Machine': 3, 'Chain Stitch Machine': 3, 'Bar Tack Machine': 2 },
    ];

    let machineIdCounter = 0;
    for (let i = 1; i <= numLines; i++) {
        const lineId = `L${i}`;
        const line: SewingLine = {
          id: lineId,
          name: `Line ${i}`,
          machines: []
        };

        const composition = lineCompositions[i-1];
        
        Object.entries(composition).forEach(([machineType, count]) => {
            for (let j = 0; j < count; j++) {
                const machine: Machine = {
                    id: `sm-${machineIdCounter++}`,
                    name: machineType, // Use the base machine type as the name
                    processIds: ['sewing'],
                    unitId: `u${(i % 3) + 1}`,
                    isMoveable: Math.random() > 0.3,
                };
                machines.push(machine);
                line.machines.push(machine);
            }
        });
        lines.push(line);
    }
    return { lines, machines };
}

const { lines: sewingLinesData, machines: sewingMachinesData } = generateSewingLinesAndMachines();
export const SEWING_LINES: SewingLine[] = sewingLinesData;


export const MACHINES: Machine[] = [
  { id: 'm1', name: 'Cutting Machine Alpha', processIds: ['cutting'], unitId: 'u1', isMoveable: false },
  { id: 'm7', name: 'Cutting Machine Beta', processIds: ['cutting'], unitId: 'u3', isMoveable: false },
  { id: 'm2', name: 'Printing Station 1', processIds: ['printing'], unitId: 'u1', isMoveable: false },
  { id: 'm10', name: 'Printing Station 2', processIds: ['printing'], unitId: 'u1', isMoveable: false },
  { id: 'm3', name: 'Embroidery Station 1', processIds: ['embroidery'], unitId: 'u2', isMoveable: false },
  { id: 'm11', name: 'Embroidery Station 2', processIds: ['embroidery'], unitId: 'u2', isMoveable: false },
  { id: 'm12', name: 'Packing table 1', processIds: ['packing'], unitId: 'u3', isMoveable: false },
  { id: 'm13', name: 'Packing table 2', processIds: ['packing'], unitId: 'u3', isMoveable: false },
  ...sewingMachinesData,
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
    { destination: 'New York, USA', selectionQty: 28333, po: 23333, fc: 1867, poPlusFc: 25200 },
    { destination: 'London, UK', selectionQty: 28333, po: 18667, fc: 7467, poPlusFc: 26134 },
    { destination: 'Tokyo, Japan', selectionQty: 28334, po: 4667, fc: 18666, poPlusFc: 23333 },
];

const dmiDemandDetailsGreen: DemandDetail[] = [
    { destination: 'Los Angeles, USA', selectionQty: 45000, po: 30000, fc: 5000, poPlusFc: 35000 },
    { destination: 'Sydney, AU', selectionQty: 25000, po: 15000, fc: 8000, poPlusFc: 23000 },
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
    season: 'AW' | 'SS',
    currentWeek: number,
    initialQtyPerWeek: number,
    volatility: number = 500
): FcSnapshot[] => {
    const snapshots: FcSnapshot[] = [];
    
    let valueStartWeek: number, valueEndWeek: number;
    let snapshotStartWeek: number;
    const seasonWeeks: number[] = [];

    if (season === 'AW') {
        snapshotStartWeek = 10;
        valueStartWeek = 27;
        valueEndWeek = 52;
        for (let w = 10; w <= 52; w++) seasonWeeks.push(w);
    } else { // SS
        snapshotStartWeek = 40;
        valueStartWeek = 1;
        valueEndWeek = 26;
        for (let w = 40; w <= 52; w++) seasonWeeks.push(w);
        for (let w = 1; w <= 26; w++) seasonWeeks.push(w);
    }

    let weeklyForecasts: Record<string, number> = {};
    seasonWeeks.forEach(w => {
        const isValueWeek = season === 'AW'
            ? (w >= valueStartWeek && w <= valueEndWeek)
            : (w >= valueStartWeek && w <= valueEndWeek);
        
        weeklyForecasts[`W${w}`] = isValueWeek ? initialQtyPerWeek : 0;
    });
    
    const lockedPoValues: Record<string, Record<Size | 'total', FcComposition>> = {};
    const snapshotWeeksToGenerate: number[] = [];
    
    if (season === 'AW') {
        if(currentWeek >= snapshotStartWeek) {
            for(let s = snapshotStartWeek; s <= currentWeek; s++) snapshotWeeksToGenerate.push(s);
        }
    } else { // SS
         if (currentWeek >= snapshotStartWeek) { // e.g. current week 42, snapshot start 40
            for(let s = snapshotStartWeek; s <= currentWeek; s++) snapshotWeeksToGenerate.push(s);
        } else if (currentWeek < valueEndWeek) { // e.g. current week 5, snapshot start 40
            for(let s = snapshotStartWeek; s <= 52; s++) snapshotWeeksToGenerate.push(s);
            for(let s = 1; s <= currentWeek; s++) snapshotWeeksToGenerate.push(s);
        }
    }


    for (const s of snapshotWeeksToGenerate) {
        const snapshotWeek = s;
        const snapshot: FcSnapshot = { snapshotWeek, forecasts: {} };

        // Apply volatility to future forecasts
        seasonWeeks.forEach(w => {
             const weekKey = `W${w}`;
            if (!lockedPoValues[weekKey]) {
                const isValueWeek = season === 'AW'
                    ? (w >= valueStartWeek && w <= valueEndWeek)
                    : (w >= valueStartWeek && w <= valueEndWeek);
                
                if (isValueWeek) {
                     const newQty = Math.max(0, weeklyForecasts[weekKey] + (Math.random() - 0.5) * volatility);
                     weeklyForecasts[weekKey] = newQty;
                }
            }
        });

        seasonWeeks.forEach(d => {
            const demandWeek = d;
            const weekKey = `W${demandWeek}`;
            
            if (lockedPoValues[weekKey]) {
                snapshot.forecasts[weekKey] = lockedPoValues[weekKey];
                return;
            }

            const totalQty = Math.round(weeklyForecasts[weekKey] || 0);
            const sizeBreakdown = generateFcBreakdown(totalQty);
            
            let isFirmPo = false;
            if (season === 'AW') {
                isFirmPo = demandWeek <= snapshotWeek + FIRM_PO_WINDOW;
            } else { // SS
                if (snapshotWeek >= 40) { // Snapshot is in previous year
                    isFirmPo = (demandWeek >= 40 && demandWeek <= snapshotWeek + FIRM_PO_WINDOW) || (demandWeek <= (snapshotWeek + FIRM_PO_WINDOW) % 52);
                } else { // Snapshot is in current year
                    isFirmPo = demandWeek <= snapshotWeek + FIRM_PO_WINDOW;
                }
            }


            const breakdown: Record<Size | 'total', FcComposition> = {
                total: { po: isFirmPo ? totalQty : 0, fc: isFirmPo ? 0 : totalQty }
            };

            SIZES.forEach(size => {
                const qty = sizeBreakdown[size] || 0;
                breakdown[size] = { po: isFirmPo ? qty : 0, fc: isFirmPo ? 0 : qty };
            });

            snapshot.forecasts[weekKey] = breakdown;
            
            if (isFirmPo) {
                lockedPoValues[weekKey] = breakdown;
            }
        });
        snapshots.push(snapshot);
    }
    return snapshots;
};


const dmiFcVsFcDetails: FcSnapshot[] = generateFcSnapshots('AW', CURRENT_WEEK, 3077, 500);
const dmiFcVsFcDetailsGreen: FcSnapshot[] = generateFcSnapshots('AW', CURRENT_WEEK, 2500, 600);
const dsiFcVsFcDetails: FcSnapshot[] = generateFcSnapshots('SS', CURRENT_WEEK, 50000, 2500);

const createComponentStatus = (
  bomItems: BomItem[],
  totalQty: number,
  ckDate: Date,
  forecastType: 'Projection' | 'FRC'
): { grn: ComponentStatusDetail, openPo: ComponentStatusDetail, noPo: ComponentStatusDetail, totalComponents: number } => {
  
  const relevantComponents = bomItems.filter(item => item.forecastType === forecastType);
  if (relevantComponents.length === 0) {
    return { grn: { quantities: { total: 0 }, componentCount: 0 }, openPo: { quantities: { total: 0 }, componentCount: 0 }, noPo: { quantities: { total: 0 }, componentCount: 0 }, totalComponents: 0 };
  }

  // Static distribution as requested
  const grnItems = relevantComponents.slice(0, 2);
  const openPoItems = relevantComponents.slice(2, 3);
  const noPoItems = relevantComponents.slice(3, 5);
  const totalComponents = grnItems.length + openPoItems.length + noPoItems.length;

  const createStatusDetail = (items: BomItem[], count: number): ComponentStatusDetail => {
    const qty = totalComponents > 0 ? Math.floor(totalQty * (count / totalComponents)) : 0;
    const quantities: Partial<SizeBreakdown> = { total: qty };
    // Simplified size breakdown for mock data
    SIZES.forEach((size, index) => {
      quantities[size] = Math.floor(qty / SIZES.length) + (index === 0 ? qty % SIZES.length : 0);
    });
    return { quantities: quantities as SizeBreakdown, componentCount: count };
  };

  const grnDetail = createStatusDetail(grnItems, grnItems.length);
  const openPoDetail = createStatusDetail(openPoItems, openPoItems.length);
  const noPoDetail = createStatusDetail(noPoItems, noPoItems.length);

  // Adjust total quantity due to floor rounding
  const assignedQty = grnDetail.quantities.total + openPoDetail.quantities.total + noPoDetail.quantities.total;
  const remainder = totalQty - assignedQty;
  if (grnItems.length > 0) grnDetail.quantities.total += remainder;
  else if (openPoItems.length > 0) openPoDetail.quantities.total += remainder;
  else noPoDetail.quantities.total += remainder;

  return { grn: grnDetail, openPo: openPoDetail, noPo: noPoDetail, totalComponents };
};

const createFrcDetails = (projection: ProjectionDetail, frcBom: BomItem[]): FrcDetail[] => {
  const frcDetails: FrcDetail[] = [];
  if (!projection.frcQty || projection.frcQty <= 0) return [];
  
  // Create 2 FRCs for this projection
  const frc1Qty = Math.floor(projection.frcQty * 0.6);
  const frc2Qty = projection.frcQty - frc1Qty;

  const frc1Date = addDays(projection.projectionDate, 10);
  const frc1Receipt = addDays(frc1Date, 45); // Assuming 45 days coverage
  const frc1_ckDate = subDays(frc1Receipt, 7);
  const frc1_status = createComponentStatus(frcBom, frc1Qty, frc1_ckDate, 'FRC');
  
  const frc2Date = addDays(frc1Date, 15);
  const frc2Receipt = addDays(frc2Date, 45);
  const frc2_ckDate = subDays(frc2Receipt, 7);
  const frc2_status = createComponentStatus(frcBom, frc2Qty, frc2_ckDate, 'FRC');

  frcDetails.push({
    frcNumber: `${projection.projectionNumber}-FRC-01`,
    frcDate: frc1Date,
    receiptDate: frc1Receipt,
    quantities: { total: frc1Qty, ...generateFcBreakdown(frc1Qty) },
    ...frc1_status
  }, {
    frcNumber: `${projection.projectionNumber}-FRC-02`,
    frcDate: frc2Date,
    receiptDate: frc2Receipt,
    quantities: { total: frc2Qty, ...generateFcBreakdown(frc2Qty) },
    ...frc2_status
  });

  return frcDetails;
};


const createProjectionDetails = (bom: BomItem[]): ProjectionDetail[] => {
    if (!bom || bom.length === 0) return [];
    const details: ProjectionDetail[] = [];
  
    for (let i = 1; i <= 4; i++) {
      const totalQty = 25000 + i * 5000;
      const frcQty = Math.round(totalQty * (0.6 + i * 0.05));
      const receiptDate = addDays(today, i * 20);
      const ckDate = subDays(receiptDate, 7);
      
      const projStatus = createComponentStatus(bom, totalQty, ckDate, 'Projection');

      const projection: ProjectionDetail = {
        projectionNumber: `PRJ-DMI-0${i}`,
        projectionDate: subDays(today, (4 - i) * 20),
        receiptDate: receiptDate,
        frcQty: frcQty,
        total: {
          quantities: { total: totalQty, ...generateFcBreakdown(totalQty) },
          componentCount: projStatus.totalComponents
        },
        ...projStatus,
        frcDetails: [],
      };
      
      projection.frcDetails = createFrcDetails(projection, bom);
      details.push(projection);
    }
    return details;
};

const paddedJacketBom: BomItem[] = [
  { componentName: 'Shell Fabric (Nylon)', sizeDependent: true, source: 'Import', leadTime: 90, supplier: 'Global Textiles', forecastType: 'Projection' },
  { componentName: 'Lining Fabric (Polyester)', sizeDependent: true, source: 'Local', leadTime: 30, supplier: 'Local Weavers', forecastType: 'FRC' },
  { componentName: 'Insulation Padding (Down)', sizeDependent: true, source: 'Import', leadTime: 100, supplier: 'Feather Inc.', forecastType: 'Projection' },
  { componentName: 'Main Zipper', sizeDependent: false, source: 'Import', leadTime: 60, supplier: 'YKK', forecastType: 'Projection' },
  { componentName: 'Pocket Zippers', sizeDependent: false, source: 'Import', leadTime: 60, supplier: 'YKK', forecastType: 'FRC' },
  { componentName: 'Sewing Thread', sizeDependent: false, source: 'Local', leadTime: 7, supplier: 'Stitch Co.', forecastType: 'FRC' },
  { componentName: 'Cuff Elastic', sizeDependent: false, source: 'Local', leadTime: 20, supplier: 'Elasticorp', forecastType: 'FRC' },
  { componentName: 'Brand Label', sizeDependent: false, source: 'Import', leadTime: 45, supplier: 'LabelMakers Inc.', forecastType: 'Projection' },
  { componentName: 'Care Label', sizeDependent: false, source: 'Import', leadTime: 45, supplier: 'LabelMakers Inc.', forecastType: 'Projection' },
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

const dmiProjectionDetails: ProjectionDetail[] = createProjectionDetails(paddedJacketBom);


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
        id: '114227-Purple',
        ocn: '114227',
        buyer: 'DMI',
        style: 'Padded Jacket',
        color: 'Purple',
        modelNo: 556622,
        season: 'AW-25',
        quantity: 85000,
        poFcQty: 80000,
        projection: { noPo: 14706, openPos: 11765, grn: 8824, total: 35294 },
        frc: { noPo: 11765, openPos: 10588, grn: 7059, total: 29412 },
        confirmedPoQty: 26471,
        cutOrder: { total: 26471 },
        produced: { total: 22059 },
        shipped: { total: 14706 },
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
        id: '114227-Green',
        ocn: '114227',
        buyer: 'DMI',
        style: 'Padded Jacket',
        color: 'Green',
        modelNo: 556623,
        season: 'AW-25',
        quantity: 70000,
        poFcQty: 65000,
        projection: { noPo: 12000, openPos: 10000, grn: 7000, total: 29000 },
        frc: { noPo: 10000, openPos: 9000, grn: 6000, total: 25000 },
        confirmedPoQty: 20000,
        cutOrder: { total: 20000 },
        produced: { total: 18000 },
        shipped: { total: 12000 },
        processIds: ['cutting', 'sewing', 'packing'],
        displayColor: ORDER_COLORS[1],
        leadTime: 21,
        budgetedEfficiency: 78,
        orderType: 'Forecasted',
        tna: {
            processes: [
                { processId: 'cutting', setupTime: 30 },
                { processId: 'sewing', setupTime: 100 },
                { processId: 'packing', setupTime: 10 },
            ]
        },
        poDetails: [], // Assuming new order has no PO details yet
        demandDetails: dmiDemandDetailsGreen,
        fcVsFcDetails: dmiFcVsFcDetailsGreen,
        projectionDetails: createProjectionDetails(paddedJacketBom),
        bom: paddedJacketBom,
    },
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
      { operation: 'Shell & Lining Cutting', machine: 'Cutting Machine Alpha', operators: 2, sam: 5.0, grade: 'B' },
      { operation: 'Padding Cutting & Quilting', machine: 'Chain Stitch Machine', operators: 4, sam: 8.0, grade: 'A' },
      { operation: 'Front Pocket Setting', machine: 'Single Needle Lock Stitch', operators: 3, sam: 4.5, grade: 'B' },
      { operation: 'Front Zipper Attachment', machine: 'Single Needle Lock Stitch', operators: 3, sam: 5.0, grade: 'A' },
      { operation: 'Sleeve Assembly', machine: 'Over Lock Machine', operators: 4, sam: 6.0, grade: 'C' },
      { operation: 'Sleeve Attachment to Body', machine: 'Over Lock Machine', operators: 4, sam: 5.5, grade: 'B' },
      { operation: 'Joining Shell and Lining', machine: 'Single Needle Lock Stitch', operators: 3, sam: 7.0, grade: 'A' },
      { operation: 'Cuff & Hem Finishing', machine: 'Flat Lock Machine', operators: 2, sam: 4.0, grade: 'C' },
    ],
  };

// Assuming an 8-hour work day
export const WORK_DAY_MINUTES = 8 * 60;
