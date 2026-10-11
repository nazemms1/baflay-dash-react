import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ImageField, SelectField } from "@/components/ui/Fields";
import { Panel } from "@/components/ui/Panel";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Bars";
import { ErrorState } from "@/components/ui/States";
import { LocationPicker } from "@/components/map/LocationPicker";
import { useSession } from "@/features/auth/session-store";
import * as authApi from "@/features/auth/api";
import { toFormData } from "@/lib/form-data";
import { asRecord, toNullableNumber, toText } from "@/lib/coerce";
import { ApiError, toApiError } from "@/lib/http/errors";
import { users } from "@/services";

type Tab = "personal" | "location" | "permissions" | "security";

/** صفحة الملف الشخصي: بياناتي، وموقعي، وصلاحياتي، وكلمة المرور. */
export function ProfilePage() {
  const { t } = useTranslation();
  const user = useSession((state) => state.user);
  const [tab, setTab] = useState<Tab>("personal");

  if (!user) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink">{t("profile.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("profile.subtitle")}</p>
      </header>

      <Segmented<Tab>
        label={t("profile.tabsLabel")}
        value={tab}
        onChange={setTab}
        options={[
          { value: "personal", label: t("profile.tabs.personal") },
          { value: "location", label: t("profile.tabs.location") },
          { value: "permissions", label: t("profile.tabs.permissions") },
          { value: "security", label: t("profile.tabs.security") },
        ]}
      />

      {tab === "personal" && <PersonalTab id={user.id} />}
      {tab === "location" && <LocationTab id={user.id} />}
      {tab === "permissions" && <PermissionsTab />}
      {tab === "security" && <SecurityTab id={user.id} />}
    </div>
  );
}

/** تحميل سجل المستخدم الكامل، لأن الجلسة لا تحمل كل حقوله. */
function useProfileRecord(id: number) {
  return useQuery({
    queryKey: ["profile-record", id],
    queryFn: async ({ signal }) => asRecord(await users.get(id, signal)),
  });
}

/** يعيد تحميل الجلسة بعد أي حفظ، فيظهر الاسم والصورة الجديدة في الشريط العلوي فوراً. */
async function refreshSession() {
  const fresh = await authApi.profile();
  useSession.setState({ user: fresh });
}

function PersonalTab({ id }: { id: number }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const record = useProfileRecord(id);
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [picture, setPicture] = useState<File | null>(null);

  const saved = {
    name: toText(record.data?.name),
    username: toText(record.data?.username),
    email: toText(record.data?.email),
    phone: toText(record.data?.phone),
    date_of_birth: toText(record.data?.date_of_birth),
    gender: toText(record.data?.gender),
  };
  const form = draft ?? saved;
  const set = (key: keyof typeof saved, value: string) => setDraft({ ...form, [key]: value });

  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(form)) {
        payload[key] = value.trim() === "" ? null : value.trim();
      }
      if (picture) payload.picture = picture;
      return users.update(id, toFormData(payload));
    },
    onSuccess: async () => {
      toast.success(t("profile.updated"));
      setDraft(null);
      setPicture(null);
      await Promise.all([refreshSession(), queryClient.invalidateQueries({ queryKey: ["profile-record", id] })]);
    },
    onError: (caught) => toast.error(toApiError(caught, t("errors.unexpected")).message),
  });

  if (record.isPending) return <Skeleton className="h-96" />;
  if (record.isError) return <ErrorState message={t("errors.unexpected")} onRetry={() => void record.refetch()} />;

  return (
    <Panel title={t("profile.personalTitle")} description={t("profile.personalHint")}>
      <form
        className="grid gap-5 sm:grid-cols-2"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <Input label={t("crud.field.name")} required value={form.name} onChange={(e) => set("name", e.target.value)} />
        <Input label={t("crud.field.username")} dir="ltr" value={form.username} onChange={(e) => set("username", e.target.value)} />
        <Input label={t("crud.field.email")} type="email" dir="ltr" value={form.email} onChange={(e) => set("email", e.target.value)} />
        <Input label={t("crud.field.phone")} type="tel" dir="ltr" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        <Input label={t("profile.dateOfBirth")} type="date" value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} />
        <SelectField
          label={t("profile.gender")}
          options={[
            { value: "male", label: t("profile.male") },
            { value: "female", label: t("profile.female") },
          ]}
          value={form.gender || null}
          placeholder={t("crud.choose")}
          onChange={(value) => set("gender", value === null ? "" : String(value))}
        />
        <div className="sm:col-span-2">
          <ImageField
            label={t("crud.field.picture")}
            currentUrl={typeof record.data?.picture === "string" ? record.data.picture : null}
            file={picture}
            onChange={setPicture}
          />
        </div>
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" disabled={save.isPending || form.name.trim() === ""} className="bg-primary text-ink hover:bg-primary/90">
            {save.isPending ? t("crud.saving") : t("profile.save")}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

/**
 * موقع المستخدم على الخريطة. الخادم يحفظ خط العرض في `location_x` وخط الطول في `location_y`
 * كما في الفروع، والداشبورد القديم كان يعكسهما للمستخدم فيظهر الموقع في غير مكانه.
 */
function LocationTab({ id }: { id: number }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const record = useProfileRecord(id);
  const [draft, setDraft] = useState<{ lat: number | null; lng: number | null } | null>(null);

  const saved = {
    lat: toNullableNumber(record.data?.location_x),
    lng: toNullableNumber(record.data?.location_y),
  };
  const point = draft ?? saved;

  const save = useMutation({
    mutationFn: () =>
      users.update(id, {
        location_x: point.lat,
        location_y: point.lng,
      }),
    onSuccess: async () => {
      toast.success(t("profile.updated"));
      setDraft(null);
      await Promise.all([refreshSession(), queryClient.invalidateQueries({ queryKey: ["profile-record", id] })]);
    },
    onError: (caught) => toast.error(toApiError(caught, t("errors.unexpected")).message),
  });

  if (record.isPending) return <Skeleton className="h-96" />;
  if (record.isError) return <ErrorState message={t("errors.unexpected")} onRetry={() => void record.refetch()} />;

  return (
    <Panel title={t("profile.locationTitle")} description={t("profile.locationHint")}>
      <div className="space-y-4">
        <LocationPicker
          lat={point.lat}
          lng={point.lng}
          height="20rem"
          onChange={(next) => setDraft({ lat: next.lat, lng: next.lng })}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted tabular-nums" dir="ltr">
            {point.lat !== null && point.lng !== null ? `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}` : t("crud.location.notSet")}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={point.lat === null} onClick={() => setDraft({ lat: null, lng: null })}>
              {t("crud.location.clear")}
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="bg-primary text-ink hover:bg-primary/90">
              {save.isPending ? t("crud.saving") : t("profile.save")}
            </Button>
          </div>
        </div>
      </div>
    </Panel>
  );
}

/** الصلاحيات الممنوحة لي، مجمعة حسب المجال الذي تنتمي إليه. للعرض فقط. */
function PermissionsTab() {
  const { t } = useTranslation();
  const rules = useSession((state) => state.user?.abilityRules ?? []);

  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const rule of rules) {
      const name = rule.name ?? (rule.subject && rule.action ? `${rule.subject}.${rule.action}` : "");
      if (!name) continue;
      const area = name.split(".")[0];
      map.set(area, [...(map.get(area) ?? []), name]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rules]);

  return (
    <Panel title={t("profile.permissionsTitle")} description={t("profile.permissionsHint", { count: rules.length })}>
      {groups.length === 0 ? (
        <p className="text-sm text-muted">{t("welcome.hintNoPermissions")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map(([area, names]) => (
            <div key={area} className="rounded-xl border border-line p-4">
              <p className="text-sm font-semibold text-ink">{area}</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {names.map((name) => (
                  <li key={name} dir="ltr" className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs text-ink ring-1 ring-primary/30">
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function SecurityTab({ id }: { id: number }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const save = useMutation({
    mutationFn: () => users.update(id, { password, password_confirmation: confirmation }),
    onSuccess: () => {
      toast.success(t("profile.passwordUpdated"));
      setPassword("");
      setConfirmation("");
    },
    onError: (caught) => toast.error(caught instanceof ApiError ? caught.message : t("profile.passwordError")),
  });

  const mismatch = confirmation !== "" && confirmation !== password;

  return (
    <Panel title={t("profile.securityTitle")} description={t("profile.securityHint")}>
      <form
        className="grid max-w-md gap-5"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          if (password.length > 0 && !mismatch) save.mutate();
        }}
      >
        <Input label={t("profile.newPassword")} type="password" autoComplete="new-password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Input
          label={t("profile.confirmPassword")}
          type="password"
          autoComplete="new-password"
          dir="ltr"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          error={mismatch ? t("profile.passwordsMismatch") : null}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={password.length === 0 || mismatch || save.isPending} className="bg-primary text-ink hover:bg-primary/90">
            {save.isPending ? t("crud.saving") : t("profile.updatePassword")}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
