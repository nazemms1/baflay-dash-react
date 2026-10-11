// html2pdf.js 0.10.x لا يحمل تعريفات TypeScript، فنصف هنا الجزء الذي نستعمله فقط:
// سلسلة `html2pdf().set(...).from(element).save()`.
declare module "html2pdf.js" {
  export interface Html2PdfWorker {
    set(options: Record<string, unknown>): Html2PdfWorker;
    from(source: HTMLElement | string): Html2PdfWorker;
    save(): Promise<void>;
  }

  export default function html2pdf(): Html2PdfWorker;
}
