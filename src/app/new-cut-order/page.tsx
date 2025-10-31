
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSchedule } from '@/context/schedule-provider';
import { Header } from '@/components/layout/header';
import Link from 'next/link';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';

export default function NewCutOrderPage() {
    const { orders, isScheduleLoaded } = useSchedule();
    const [selectedCc, setSelectedCc] = useState('');
    const [selectedColor, setSelectedColor] = useState('');
    const [startWeek, setStartWeek] = useState('');
    const [endWeek, setEndWeek] = useState('');

    const ccOptions = useMemo(() => {
        if (!isScheduleLoaded) return [];
        const ccSet = new Set<string>();
        orders.forEach(o => {
            if (o.orderType === 'Forecasted' && o.ocn) {
                ccSet.add(o.ocn);
            }
        });
        return Array.from(ccSet).sort();
    }, [orders, isScheduleLoaded]);

    const colorOptions = useMemo(() => {
        if (!selectedCc) return [];
        const colorSet = new Set<string>();
        orders.forEach(o => {
            if (o.ocn === selectedCc) {
                colorSet.add(o.color);
            }
        });
        return Array.from(colorSet).sort();
    }, [selectedCc, orders]);

    const weekOptions = useMemo(() => {
        return Array.from({ length: 52 }, (_, i) => `W${i + 1}`);
    }, []);
    
    useEffect(() => {
        // Reset color if CC changes and the selected color is no longer valid
        if (!colorOptions.includes(selectedColor)) {
            setSelectedColor('');
        }
    }, [selectedCc, colorOptions, selectedColor]);

    return (
        <div className="flex h-screen flex-col">
            <Header />
            <main className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col">
                <Breadcrumb className="mb-4 flex-shrink-0">
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbLink asChild>
                                <Link href="/">Home</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                             <BreadcrumbLink asChild>
                                <Link href="/cut-order-details">Cut order details</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>New Cut Order</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
                 <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold">Create New Cut Order</h1>
                        <p className="text-muted-foreground">
                            Select the criteria for the new cut order.
                        </p>
                    </div>
                     <div className="flex items-center gap-2">
                        <Button variant="outline" asChild>
                           <Link href="/cut-order-details">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back
                            </Link>
                        </Button>
                    </div>
                </div>

                <Card className="max-w-2xl">
                    <CardHeader>
                        <CardTitle>Cut Order Criteria</CardTitle>
                        <CardDescription>Select the CC, Color and week range to generate the cut order for.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="cc-select">CC no.</Label>
                                <Select value={selectedCc} onValueChange={setSelectedCc}>
                                    <SelectTrigger id="cc-select">
                                        <SelectValue placeholder="Select a CC" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ccOptions.map(cc => (
                                            <SelectItem key={cc} value={cc}>{cc}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="color-select">Color</Label>
                                <Select value={selectedColor} onValueChange={setSelectedColor} disabled={!selectedCc}>
                                    <SelectTrigger id="color-select">
                                        <SelectValue placeholder="Select a color" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {colorOptions.map(color => (
                                            <SelectItem key={color} value={color}>{color}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="start-week-select">Cut Order Start Week</Label>
                                <Select value={startWeek} onValueChange={setStartWeek}>
                                    <SelectTrigger id="start-week-select">
                                        <SelectValue placeholder="Select start week" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {weekOptions.map(week => (
                                            <SelectItem key={week} value={week}>{week}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                              <div className="space-y-2">
                                <Label htmlFor="end-week-select">Cut Order End Week</Label>
                                <Select value={endWeek} onValueChange={setEndWeek}>
                                    <SelectTrigger id="end-week-select">
                                        <SelectValue placeholder="Select end week" />
                                    </SelectTrigger>
                                    <SelectContent>
                                       {weekOptions.filter(w => parseInt(w.slice(1)) >= parseInt(startWeek.slice(1) || '0')).map(week => (
                                            <SelectItem key={week} value={week}>{week}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
