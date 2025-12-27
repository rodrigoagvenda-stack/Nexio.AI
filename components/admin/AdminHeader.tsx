'use client';

import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { AdminSidebarContent } from './AdminSidebarContent';

interface AdminHeaderProps {
  title?: string;
  subtitle?: string;
  adminName?: string;
  adminEmail?: string;
}

export function AdminHeader({ title, subtitle, adminName, adminEmail }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-3 md:px-6">
      {/* Mobile Menu Button */}
      <Sheet>
        <SheetTrigger asChild className="md:hidden">
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-72">
          <AdminSidebarContent adminName={adminName} adminEmail={adminEmail} />
        </SheetContent>
      </Sheet>

      <div className="flex-1">
        {title && <h2 className="text-lg font-semibold">{title}</h2>}
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
    </header>
  );
}
