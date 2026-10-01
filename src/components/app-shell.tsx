"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Bell, Search, Plus, Orbit, Menu, X } from "lucide-react";
import { useNexus } from "./nexus-provider";
import { navigation } from "@/config/navigation";
import { IconButton } from "./ui/primitives";
import { CommandPalette, NotificationCenter } from "./command-system";
import { IdeaPanel } from "./idea-panel";
import { PwaRegistration } from "./pwa-registration";
import { AuthScreen } from "./auth-screen";
import { NexusVoiceOrb } from "./nexus-voice-orb";
import { NexusAudioPlayer } from "./nexus-audio-player";
import { NexusDesktopUpdater } from "./nexus-desktop-updater";
import { SpatialEnvironment, spatialZone } from "./spatial-environment";
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const n = useNexus();
  const current = navigation.find((i) =>
    i.href === "/" ? pathname === "/" : pathname.startsWith(i.href),
  );
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const groups = ["workspace", "intelligence", "system"];
  if (!n.authReady) {
    return (
      <main
        style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}
      >
        Conectando NEXUS…
      </main>
    );
  }
  if (!n.session) return <AuthScreen />;
  return (
    <>
      <a href="#main" className="skip-link">
        Ir al contenido
      </a>
      <SpatialEnvironment variant={spatialZone(pathname)} />
      <aside className="app-rail">
        <Link href="/" className="brand" aria-label="NEXUS Today">
          <span className="brand-symbol">
            <Orbit size={24} strokeWidth={1.3} />
          </span>
          <span>
            <span className="brand-name">NEXUS</span>
            <div className="brand-subtitle">PERSONAL INTELLIGENCE</div>
          </span>
        </Link>
        <nav aria-label="Módulos de NEXUS">
          {groups.map((group) => (
            <div key={group}>
              <div className="rail-group-label">
                {group === "workspace"
                  ? "Workspace"
                  : group === "intelligence"
                    ? "Intelligence"
                    : "Preferences"}
              </div>
              {navigation
                .filter((i) => i.group === group)
                .map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={
                      "rail-link " + (isActive(item.href) ? "active" : "")
                    }
                  >
                    <item.icon size={17} strokeWidth={1.5} />
                    {item.label}
                    {item.href === "/ai" && (
                      <span className="nav-index">AI</span>
                    )}
                    {item.href === "/settings" && n.sqlReady && (
                      <span className="nav-index">SQL</span>
                    )}
                  </Link>
                ))}
            </div>
          ))}
        </nav>
        <div className="rail-bottom">
          <Link href="/settings" className="rail-system-state">
            <span
              className={
                "connection-light " +
                (n.cloudReady && !n.cloudError ? "connected" : "")
              }
            />
            <span>
              {n.cloudError
                ? "Revisar conexión"
                : n.cloudReady
                  ? "Espacio sincronizado"
                  : "Conectando espacio"}
            </span>
          </Link>
          <Link href="/settings" className="profile-link">
            <span className="avatar">{n.data.user.initials}</span>
            <span>
              <div className="profile-name">{n.data.user.name}</div>
              <div className="profile-role">Tu espacio. Tu dirección.</div>
            </span>
          </Link>
        </div>
      </aside>
      <div className="app-content" data-zone={spatialZone(pathname)}>
        <header className="topbar">
          <Link href="/" className="mobile-brand">
            <Orbit size={23} className="accent" />
            NEXUS
          </Link>
          <div className="topbar-path">
            <span>WORKSPACE</span>
            <span>/</span>
            <strong>{current?.label.toUpperCase() ?? "PROJECT COMMAND"}</strong>
          </div>
          <div className="topbar-tools">
            <Link
              href="/settings"
              className="topbar-system-link"
              title={n.sqlError || n.cloudError || "Estado del sistema"}
            >
              <span
                className={
                  "connection-light " +
                  (n.sqlReady && !n.sqlError ? "connected" : "")
                }
              />
              {n.sqlError
                ? "SQL · REVISAR"
                : n.sqlReady
                  ? n.sqlSyncing
                    ? "SQL · SYNC"
                    : "SQL · LIVE"
                  : "SQL · CONECTANDO"}
            </Link>
            <button
              className="search-trigger"
              onClick={() => n.setCommandOpen(true)}
              aria-label="Buscar en NEXUS"
            >
              <Search size={17} />
              <span>Buscar en tu universo</span>
              <kbd>⌘ K</kbd>
            </button>
            <div style={{ position: "relative" }}>
              <IconButton
                label="Notificaciones"
                onClick={() => n.setNotificationOpen(true)}
              >
                <Bell size={17} />
              </IconButton>
              {n.data.user.preferences.notifications &&
                n.data.notifications.some((i) => !i.read) && (
                  <span className="notice-dot" />
                )}
            </div>
            <button
              className="button button-primary topbar-capture"
              onClick={() => n.openCapture()}
            >
              <Plus size={16} />
              Capturar
            </button>
          </div>
        </header>
        <main id="main" className="main-content">
          {n.storageError && (
            <div role="alert" className="system-alert">
              {n.storageError} <Link href="/settings">Abrir System</Link>
            </div>
          )}
          <motion.div
            key={pathname}
            initial={
              n.reduceMotion
                ? false
                : {
                    opacity: 0,
                    y: 12,
                    scale: 0.995,
                  }
            }
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              rotateX: 0,
              filter: "blur(0px)",
            }}
            transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
            className="zone-content"
            style={{ transformOrigin: "50% 18%" }}
          >
            {children}
          </motion.div>
          <footer className="system-footer">
            <span>
              <span className="status-tick" />
              NEXUS OS / 02
            </span>
            <span>UN ESPACIO PARA PENSAR. UN SISTEMA PARA HACER.</span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Navegación móvil">
        {["/", "/projects"].map((href) => {
          const item = navigation.find((i) => i.href === href)!;
          return (
            <Link
              key={href}
              href={href}
              className={isActive(href) ? "active" : ""}
            >
              <item.icon size={19} />
              {item.label}
            </Link>
          );
        })}
        <button
          className="capture-nav"
          onClick={() => n.openCapture()}
          aria-label="Capturar"
        >
          <Plus size={22} />
        </button>
        {["/finance", "/ai"].map((href) => {
          const item = navigation.find((i) => i.href === href)!;
          return (
            <Link
              key={href}
              href={href}
              className={isActive(href) ? "active" : ""}
            >
              <item.icon size={19} />
              {item.label === "Nexus AI"
                ? "AI"
                : item.label === "Finance"
                  ? "Dinero"
                  : item.label}
            </Link>
          );
        })}
        <button
          aria-label="Todos los módulos"
          onClick={() => n.setCommandOpen(true)}
        >
          <Menu size={19} />
          Más
        </button>
      </nav>
      <CommandPalette />
      <NotificationCenter />
      <IdeaPanel />
      <PwaRegistration />
      <NexusVoiceOrb />
      <NexusAudioPlayer />
      <NexusDesktopUpdater />
      {n.toast && (
        <div
          className={"toast " + (n.toast.error ? "toast-error" : "")}
          role={n.toast.error ? "alert" : "status"}
        >
          <span>{n.toast.message}</span>
          <button aria-label="Cerrar aviso" onClick={() => n.setToast(null)}>
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
