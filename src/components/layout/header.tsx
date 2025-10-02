import { Factory } from 'lucide-react';

export function Header() {
  return (
    <header className="border-b bg-card shadow-sm">
      <div className="container mx-auto max-w-full px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Factory className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              StitchPlan
            </h1>
          </div>
        </div>
      </div>
    </header>
  );
}
