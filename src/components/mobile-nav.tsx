"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "@/components/app-sidebar";
import { DrawerAccount } from "@/components/user-menu";

export function MobileNav({ centerName, name, email }: { centerName: string; name: string; email: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" />}>
        <Menu />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 max-w-[85vw] p-0" showCloseButton={false}>
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarNav
          centerName={centerName}
          onNavigate={() => setOpen(false)}
          footer={<DrawerAccount name={name} email={email} />}
        />
      </SheetContent>
    </Sheet>
  );
}
