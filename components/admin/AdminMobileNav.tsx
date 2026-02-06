'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import {
  LayoutDashboard,
  Building2,
  Users,
  UserCheck,
  Menu,
} from 'lucide-react';
import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { AdminSidebar } from './AdminSidebar';

interface AdminMobileNavProps {
  adminName?: string;
  adminEmail?: string;
}

export function AdminMobileNav({ adminName, adminEmail }: AdminMobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const mainLinks = [
    {
      href: '/admin',
      label: 'Home',
      icon: LayoutDashboard,
    },
    {
      href: '/admin/empresas',
      label: 'Empresas',
      icon: Building2,
    },
    {
      href: '/admin/usuarios',
      label: 'Usuários',
      icon: Users,
    },
    {
      href: '/admin/qualificacao',
      label: 'Leads',
      icon: UserCheck,
    },
  ];

  return (
    <>
      {/* Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border">
        <div className="flex items-center justify-around h-16">
          {mainLinks.map((link) => {
            const Icon = link.icon;
            const isActive =
              pathname === link.href ||
              (link.href !== '/admin' && pathname.startsWith(link.href + '/'));

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 h-full transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <Icon className="h-5 w-5 mb-1" />
                <span className="text-xs font-medium">{link.label}</span>
              </Link>
            );
          })}

          {/* Menu Button */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button className="flex flex-col items-center justify-center flex-1 h-full text-muted-foreground">
                <Menu className="h-5 w-5 mb-1" />
                <span className="text-xs font-medium">Menu</span>
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <AdminSidebar adminName={adminName} adminEmail={adminEmail} />
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      {/* Spacer for bottom nav */}
      <div className="md:hidden h-16" />
    </>
  );
}
