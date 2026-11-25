/** Client-only: call from event handlers. */
export async function exportCardPng(el: HTMLElement, filename: string) {
  const { toPng } = await import("html-to-image");
  const url = await toPng(el, { pixelRatio: 1, cacheBust: true });
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.png`;
  a.click();
}

export async function exportCardPdf(front: HTMLElement, back: HTMLElement, filename: string) {
  const [{ toPng }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: [85, 55] });
  pdf.addImage(await toPng(front, { pixelRatio: 1, cacheBust: true }), "PNG", 0, 0, 85, 55);
  pdf.addPage([85, 55], "landscape");
  pdf.addImage(await toPng(back, { pixelRatio: 1, cacheBust: true }), "PNG", 0, 0, 85, 55);
  pdf.save(`${filename}.pdf`);
}
