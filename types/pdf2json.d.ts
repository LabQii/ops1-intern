declare module 'pdf2json' {
  export default class PDFParser {
    constructor(context: any, needRawText: number);
    on(eventName: string, callback: (data: any) => void): this;
    parseBuffer(buffer: Buffer): void;
    loadPDF(pdfFilePath: string): void;
    getRawTextContent(): string;
  }
}
