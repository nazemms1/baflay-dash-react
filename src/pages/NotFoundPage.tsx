import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-6xl font-bold text-line">404</p>
      <h1 className="text-xl font-semibold">{t("notFound.title")}</h1>
      <Link to="/" className="text-sm font-medium text-secondary hover:underline">
        {t("notFound.back")}
      </Link>
    </div>
  );
}
