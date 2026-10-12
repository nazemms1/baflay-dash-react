import { api } from "@/lib/http/client";
import { toPage, unwrapData } from "@/lib/http/envelope";
import type { ListParams } from "./resource";
import type { Named } from "./catalog";
import type { Id } from "./resource";

/** إجابات الزبائن على الاستبيانات: قراءة وإحصاء وتصدير، وإرسال إجابة جديدة. */
export const customerSurveys = {
  list: (params: ListParams = {}, signal?: AbortSignal) =>
    api
      .get("customer-surveys", { params, signal })
      .then((response) => toPage<Named>(response.data)),

  get: (id: Id, signal?: AbortSignal) =>
    api
      .get(`customer-surveys/${id}`, { signal })
      .then((response) => unwrapData<Named>(response.data)),

  statistics: (params: ListParams = {}, signal?: AbortSignal) =>
    api
      .get("customer-surveys/statistics", { params, signal })
      .then((response) => unwrapData<unknown>(response.data)),

  submitAnswers: (body: Record<string, unknown>) =>
    api.post("customer-survey-answers", body).then((response) => response.data as unknown),
};
