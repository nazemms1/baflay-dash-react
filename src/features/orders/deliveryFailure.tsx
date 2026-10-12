import { useTranslation } from "react-i18next";
import { SelectField, TextArea } from "@/components/ui/Fields";
import { FAILURE_REASONS } from "./failureReasons";

/** حقلا سبب تعذّر التسليم وملاحظته، يُستعملان في نافذة السائق ونافذة تغيير الحالة في الإدارة. */
export function DeliveryFailureFields({
  reason,
  note,
  onReasonChange,
  onNoteChange,
  disabled,
}: {
  reason: string;
  note: string;
  onReasonChange: (reason: string) => void;
  onNoteChange: (note: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const noteRequired = reason === "other";

  return (
    <div className="space-y-3">
      <SelectField
        label={t("deliveryFailure.reason")}
        required
        options={FAILURE_REASONS.map((value) => ({ value, label: t(`deliveryFailure.reasons.${value}`) }))}
        placeholder={t("deliveryFailure.pick")}
        value={reason || null}
        disabled={disabled}
        onChange={(value) => onReasonChange(value === null ? "" : String(value))}
      />
      <TextArea
        label={noteRequired ? t("deliveryFailure.noteRequired") : t("deliveryFailure.note")}
        required={noteRequired}
        rows={3}
        maxLength={255}
        value={note}
        disabled={disabled}
        onChange={(event) => onNoteChange(event.target.value)}
      />
    </div>
  );
}
