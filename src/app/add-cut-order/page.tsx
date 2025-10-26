
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
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function AddCutOrderContent() {
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
                
                <div className="flex-1 rounded-lg border border-dashed shadow-sm flex items-center justify-center">
                    <div className="text-center">
                        <p className="text-muted-foreground">Cut order form will be here.</p>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default function AddCutOrderPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AddCutOrderContent />
        </Suspense>
    )
}
