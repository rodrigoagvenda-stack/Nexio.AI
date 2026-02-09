'use client';

import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { AdminSidebarContent } from './AdminSidebarContent';

interface AdminHeaderProps {
  adminName?: string;
  adminEmail?: string;
}

export function AdminHeader({ adminName, adminEmail }: AdminHeaderProps) {
  return (
    <div className="md:hidden sticky top-0 z-30 flex h-14 items-center px-3 border-b bg-background">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          <AdminSidebarContent adminName={adminName} adminEmail={adminEmail} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
