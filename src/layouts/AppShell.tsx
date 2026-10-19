import { Suspense, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { LogOut, Menu, X } from "lucide-react";
import { useBranchScope, usePermissions } from "@/features/auth/hooks";
import { useSession } from "@/features/auth/session-store";
import { currentLanguage } from "@/i18n";
import { APP_BUILD_DATE, APP_COMMIT, APP_VERSION } from "@/config/version";
import { localizedName } from "@/lib/localized";
import { LanguageSwitch } from "@/components/ui/LanguageSwitch";
import { PageLoader } from "@/components/ui/PageLoader";
import { RouteProgress } from "@/components/ui/RouteProgress";
import { InstallAppButton } from "@/features/pwa/InstallAppButton";
import { canSeeItem, NAV_GROUPS } from "./navigation";

export function AppShell() {
  const { t } = useTranslation();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = () => setDrawerOpen(false);

  return (
    <div className="flex min-h-screen">
      <RouteProgress />
      <Sidebar open={drawerOpen} onNavigate={closeDrawer} onClose={closeDrawer} />

      {drawerOpen && (
        <button
          type="button"
          aria-label={t("common.close")}
          onClick={closeDrawer}
          className="fixed inset-0 z-30 cursor-default bg-ink/40 lg:hidden"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setDrawerOpen(true)} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 sm:p-6 lg:p-8">
          {/* المفتاح بالمسار يعيد تشغيل حركة الظهور عند كل صفحة، والحدّ يُظهر مؤشر التحميل أثناء جلب الصفحة. */}
          <div key={location.pathname} className="animate-page-in">
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}

function Sidebar({
  open,
  onNavigate,
  onClose,
}: {
  open: boolean;
  onNavigate: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const permissions = usePermissions();

  return (
    <aside
      className={clsx(
        "fixed inset-y-0 start-0 z-40 flex w-64 flex-col bg-night text-surface transition-transform duration-200",
        // الإخفاء يعمل على الشاشات الصغيرة فقط؛ على الشاشات الكبيرة تبقى القائمة ظاهرة دائماً،
        // في العربية (RTL) وفي الإنجليزية على حد سواء.
        "lg:sticky lg:top-0 lg:h-screen",
        open ? "translate-x-0" : "max-lg:-translate-x-full max-lg:rtl:translate-x-full"
      )}
    >
      <div className="flex h-20 items-center justify-between border-b border-night-line px-5">
        <Link
          to="/welcome"
          onClick={onNavigate}
          aria-label={t("app.name")}
          title={t("app.name")}
          className="rounded-lg transition hover:opacity-90"
        >
          <img src="/logoT1.svg" alt="" className="h-12 w-auto" />
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className="grid size-8 cursor-pointer place-items-center rounded-lg text-surface/70 hover:bg-night-soft lg:hidden"
        >
          <X className="size-4" />
        </button>
      </div>

      <nav className="sidebar-scroll flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {NAV_GROUPS.map((group) => {
          const visible = group.items.filter((item) => canSeeItem(item, permissions));
          if (visible.length === 0) return null;

          return (
            <div key={group.key}>
              <p className="px-3 pb-2 text-xs font-semibold tracking-wide text-surface/45">
                {t(`nav.groups.${group.key}`)}
              </p>
              <ul className="space-y-1">
                {visible.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      end={item.path === "/"}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        clsx(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                          isActive
                            ? "bg-primary font-semibold text-ink shadow-sm"
                            : "text-surface/75 hover:bg-night-soft hover:text-surface"
                        )
                      }
                    >
                      <item.icon className="size-4.5 shrink-0" aria-hidden />
                      {t(`nav.${item.key}`)}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-night-line px-3 py-3 empty:hidden">
        <InstallAppButton />
      </div>

      <footer
        dir="ltr"
        title={t("shell.buildDate", { date: APP_BUILD_DATE })}
        className="border-t border-night-line px-5 py-3 text-xs tabular-nums text-surface/50"
      >
        v{APP_VERSION} · {APP_BUILD_DATE} · {APP_COMMIT}
      </footer>
    </aside>
  );
}

function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { t } = useTranslation();
  const user = useSession((state) => state.user);
  const signOut = useSession((state) => state.signOut);
  const scope = useBranchScope();
  const language = currentLanguage();
  const branchName = localizedName(user?.branch, language);

  // تاريخ اليوم في رأس الشريط، فلا يتكرر اسم الصفحة الذي تعرضه الصفحة نفسها.
  const todayLabel = new Intl.DateTimeFormat(language, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label={t("common.menu")}
        className="grid size-9 cursor-pointer place-items-center rounded-xl border border-line bg-surface text-ink-soft lg:hidden"
      >
        <Menu className="size-4" />
      </button>
      <Link to="/welcome" aria-label={t("app.name")} className="lg:hidden">
        <img src="/logo.png" alt="" className="h-8 w-auto" />
      </Link>
      <p className="hidden min-w-0 truncate text-sm text-muted md:block">{todayLabel}</p>

      {scope.isBranchScoped && branchName && (
        <span className="hidden truncate rounded-full bg-primary-soft px-3 py-1 text-sm text-ink ring-1 ring-primary/40 sm:inline-flex">
          {t("shell.branch", { name: branchName })}
        </span>
      )}

      <div className="ms-auto flex items-center gap-2">
        <LanguageSwitch />
        <div className="hidden text-end leading-tight md:block">
          <NavLink to="/profile" className="text-sm font-semibold hover:text-secondary">{user?.name}</NavLink>
          <p className="text-xs text-muted" dir="ltr">
            {user?.email}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          aria-label={t("common.logout")}
          title={t("common.logout")}
          className="grid size-9 cursor-pointer place-items-center rounded-xl border border-line bg-surface text-ink-soft transition hover:border-secondary hover:text-secondary"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </header>
  );
}
