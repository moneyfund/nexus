"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, Bell, BrainCircuit, Briefcase, CalendarDays, Command,
  LayoutDashboard, Lightbulb, Plus, Search, Target, Wallet
} from "lucide-react";
import { useNexus } from "@/components/nexus-provider";
import { AmbientScene } from "@/components/ambient-scene";

const nav = [
  { href: "/", label: "Today", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: Briefcase },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/finance", label: "Finance", icon: Wallet },
  { href: "/ideas", label: "Ideas", icon: Lightbulb },
  { href: "/analytics", label: "Analytics", icon: BarChart3 }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { setCaptureOpen } = useNexus();

  return (
    <div className="min-h-screen">
      <AmbientScene />
      <div className="nexus-grid pointer-events-none fixed inset-0 opacity-50" />
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[250px] border-r border-white/[.065] bg-black/68 p-5 backdrop-blur-xl lg:flex lg:flex-col">
        <div className="flex items-center gap-3 px-2 pt-1">
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-[#8b5cf6]/35 bg-gradient-to-br from-[#8b5cf6]/25 via-[#6d28d9]/10 to-transparent shadow-[0_0_35px_rgba(139,92,246,.18)]">
            <Command size={19} className="text-[#c4b5fd]" />
          </div>
          <div>
            <div className="text-[15px] font-bold tracking-[.24em]">NEXUS</div>
            <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[.22em] text-[#59647a]">Personal OS · v0.1</div>
          </div>
        </div>

        <nav className="mt-9 space-y-1.5">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const classes = active
              ? "bg-white/[.07] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.05)]"
              : "text-[#778198] hover:bg-white/[.035] hover:text-[#cdd4e3]";
            return (
              <Link key={item.href} href={item.href} className={"group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm transition " + classes}>
                {active && <span className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-[#9b6cff] shadow-[0_0_14px_rgba(155,108,255,.9)]" />}<Icon size={17} className={active ? "text-[#bca7ff]" : ""} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 border-t border-white/[.06] pt-6">
          <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[.2em] text-[#4e586b]">Intelligence</div>
          <button className="group flex w-full items-center justify-between rounded-xl border transition hover:-translate-y-0.5 hover:shadow-[0_0_32px_rgba(139,92,246,.12)] border-[#8b5cf6]/20 bg-[#8b5cf6]/[.06] px-3 py-3 text-sm text-[#cbbcff]">
            <span className="flex items-center gap-3"><BrainCircuit size={17} /> Nexus AI</span>
            <span className="rounded-full bg-white/[.06] px-2 py-0.5 text-[9px] uppercase tracking-wider text-[#778198]">Soon</span>
          </button>
        </div>

        <div className="mt-auto rounded-2xl border border-white/[.065] bg-white/[.025] p-3.5">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[#7c3aed] to-[#a78bfa] text-xs font-bold">NG</div>
            <div><div className="text-sm font-medium">Norvin García</div><div className="text-[10px] text-[#667086]">Command owner</div></div>
          </div>
        </div>
      </aside>

      <div className="relative lg:pl-[250px]">
        <header className="sticky top-0 z-30 flex h-[70px] items-center justify-between border-b border-white/[.055] bg-[#030306]/74 px-4 backdrop-blur-xl sm:px-7 lg:px-9">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="grid h-9 w-9 place-items-center rounded-xl border border-[#8b5cf6]/30 bg-[#8b5cf6]/10"><Command size={17} /></div>
            <span className="text-sm font-bold tracking-[.2em]">NEXUS</span>
          </div>
          <div className="hidden items-center gap-2 rounded-xl border border-white/[.065] bg-white/[.025] px-3 py-2 text-sm text-[#5e687b] sm:flex">
            <Search size={15} /><span>Buscar en Nexus</span><span className="ml-10 rounded-md border border-white/[.07] px-1.5 py-0.5 text-[10px]">⌘ K</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative rounded-xl border border-white/[.065] bg-white/[.025] p-2.5 text-[#788399]"><Bell size={17} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#8b5cf6]" /></button>
            <button onClick={() => setCaptureOpen(true)} className="flex items-center gap-2 rounded-xl bg-white px-3.5 py-2.5 text-xs font-semibold text-[#070910] transition hover:scale-[1.015]"><Plus size={15} /><span className="hidden sm:inline">Capture</span></button>
          </div>
        </header>
        <main className="px-4 pb-24 pt-6 sm:px-7 lg:px-9 lg:pb-10">{children}</main>
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-2xl border border-white/10 bg-[#060608]/92 p-2 backdrop-blur-xl lg:hidden">
        {nav.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return <Link key={item.href} href={item.href} className={"flex min-w-12 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[9px] " + (active ? "bg-white/[.07] text-white" : "text-[#647086]")}><Icon size={17} />{item.label}</Link>;
        })}
      </nav>
    </div>
  );
}
