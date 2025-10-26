
'use client';

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
import { ArrowLeft } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SIZES } from '@/lib/data';
import { useSchedule } from '@/context/schedule-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { CutOrderRecord, SizeBreakdown } from '@/lib/types';


const sizeSchema = SIZES.reduce((acc, size) => {
    return { ...acc, [size]: z.coerce.number().min(0, 'Must be a positive number').default(0) };
}, {});

const formSchema = z.object({
  startWeek: z.string().min(1, "Start week is required"),
  endWeek: z.string().min(1, "End week is required"),
  ...sizeSchema,
}).refine(data => {
    const start = parseInt(data.startWeek.replace('W', ''), 10);
    const end = parseInt(data.endWeek.replace('W', ''), 10);
    return end >= start;
}, {
    message: "End week cannot be earlier than start week",
    path: ["endWeek"],
});

type CutOrderFormValues = z.infer<typeof formSchema>;


function AddCutOrderForm({ orderId }: { orderId: string }) {
    const { addCutOrderRecord, cutOrderRecords } = useSchedule();
    const router = useRouter();
    const { toast } = useToast();
    
    const weekOptions = useMemo(() => Array.from({ length: 52 }, (_, i) => `W${i + 1}`), []);

    const form = useForm<CutOrderFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            startWeek: '',
            endWeek: '',
            ...SIZES.reduce((acc, size) => ({ ...acc, [size]: 0 }), {}),
        },
    });
    
    const sizeValues = form.watch(SIZES);
    const totalQuantity = SIZES.reduce((sum, size) => sum + (Number(sizeValues[size as keyof typeof sizeValues]) || 0), 0);
    
    const selectedStartWeek = form.watch('startWeek');
    const endWeekOptions = useMemo(() => {
        if (!selectedStartWeek) return weekOptions;
        const startNum = parseInt(selectedStartWeek.replace('W', ''));
        return weekOptions.filter(w => parseInt(w.replace('W','')) >= startNum);
    }, [selectedStartWeek, weekOptions]);
    

    useEffect(() => {
        form.setValue('total' as any, totalQuantity);
    }, [totalQuantity, form]);

    const onSubmit = (values: CutOrderFormValues) => {
        const orderCutOrders = cutOrderRecords.filter(co => co.orderId === orderId);
        const nextCoNumber = `CO-${orderId.split('-')[0]}-${(orderCutOrders.length + 1).toString().padStart(2, '0')}`;

        const quantities: Partial<SizeBreakdown> = {};
        SIZES.forEach(size => {
            quantities[size] = values[size as keyof CutOrderFormValues] as number;
        });
        quantities.total = totalQuantity;

        const newCutOrder: CutOrderRecord = {
            coNumber: nextCoNumber,
            orderId,
            coWeekCoverage: `${values.startWeek}-${values.endWeek}`,
            quantities: quantities as SizeBreakdown,
        };

        addCutOrderRecord(newCutOrder);
        
        toast({
            title: "Cut Order Created",
            description: `Cut Order ${newCutOrder.coNumber} has been successfully added.`,
        });

        router.push(`/cut-order?orderId=${orderId}`);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Create New Cut Order</CardTitle>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <FormField
                                control={form.control}
                                name="startWeek"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Start Week</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select start week" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {weekOptions.map(week => (
                                                    <SelectItem key={week} value={week}>{week}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="endWeek"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>End Week</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!selectedStartWeek}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select end week" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {endWeekOptions.map(week => (
                                                    <SelectItem key={week} value={week}>{week}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>


                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {SIZES.map(size => (
                                <FormField
                                    key={size}
                                    control={form.control}
                                    name={size}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{size}</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            ))}
                        </div>

                         <div className="pt-4 border-t">
                            <h3 className="text-lg font-bold">Total Quantity: {totalQuantity.toLocaleString()}</h3>
                        </div>

                        <div className="flex justify-end">
                            <Button type="submit">Create Cut Order</Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}

function AddCutOrderPageContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId');

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
                                <Link href="/orders">Order Management</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbLink asChild>
                                <Link href={`/cut-order?orderId=${orderId || ''}`}>Cut Order</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>Add Cut Order</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
                 <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold">Add New Cut Order</h1>
                        {orderId && (
                            <p className="text-muted-foreground">
                                For Order ID: {orderId}
                            </p>
                        )}
                    </div>
                     <Button variant="outline" asChild>
                        <Link href={`/cut-order?orderId=${orderId || ''}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Cut Orders
                        </Link>
                    </Button>
                </div>
                
                <div className="flex-1">
                    {orderId ? (
                        <AddCutOrderForm orderId={orderId} />
                    ) : (
                         <div className="flex-1 rounded-lg border border-dashed shadow-sm flex items-center justify-center">
                            <div className="text-center">
                                <p className="text-muted-foreground">Please select an order first.</p>
                                <Button asChild className="mt-4">
                                    <Link href="/orders">Go to Orders</Link>
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

export default function AddCutOrderPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Loading...</div>}>
            <AddCutOrderPageContent />
        </Suspense>
    );
}
