import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Header } from '@/components/layout/header';

export default function Home() {
  return (
    <div className="flex h-screen flex-col">
      <Header />
      <main className="flex flex-1 items-center justify-center bg-background p-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Welcome to StitchPlan
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Your simple manufacturing process scheduler.
          </p>
          <div className="mt-8">
            <Button asChild size="lg">
              <Link href="/sewing-plan">Go to Sewing Plan</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
