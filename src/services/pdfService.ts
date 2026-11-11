// ====================================================================
// RESTO OS - Official GST Tax Invoice PDF Generator
// ====================================================================

import jsPDF from 'jspdf';
import { Invoice, Order, Restaurant } from '../types';
import { formatCurrency } from '../utils/currency';
import { formatDateTime } from '../utils/date';

export class PDFInvoiceService {
  public static generateInvoicePDF(
    invoice: Invoice,
    restaurant: Restaurant,
    order?: Order
  ): void {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const primaryColor = '#111827';
    const accentColor = '#7047EB';

    // Header Background
    doc.setFillColor(17, 24, 39); // #111827
    doc.rect(0, 0, 210, 36, 'F');

    // Restaurant Header
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(restaurant.name.toUpperCase(), 14, 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`${restaurant.address}, ${restaurant.city} - Phone: ${restaurant.phone}`, 14, 23);
    doc.text(`GSTIN: ${restaurant.gstin || '29ABCDE1234F1Z5'} | FSSAI: ${restaurant.fssai_license || '11223344556677'}`, 14, 29);

    // Invoice Meta Header
    doc.setTextColor(primaryColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('TAX INVOICE', 14, 48);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Invoice No:`, 14, 56);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.invoice_number, 36, 56);

    doc.setFont('helvetica', 'bold');
    doc.text(`Date & Time:`, 14, 62);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDateTime(invoice.issued_at), 36, 62);

    doc.setFont('helvetica', 'bold');
    doc.text(`Payment:`, 14, 68);
    doc.setFont('helvetica', 'normal');
    doc.text(`${invoice.payment_method} (${invoice.transaction_ref || 'CONFIRMED'})`, 36, 68);

    // Table & Customer Box (Right column)
    doc.setFont('helvetica', 'bold');
    doc.text(`Table:`, 140, 56);
    doc.setFont('helvetica', 'normal');
    doc.text(`Table #${invoice.table_id.substring(0, 5)}`, 160, 56);

    if (invoice.customer_phone) {
      doc.setFont('helvetica', 'bold');
      doc.text(`Customer:`, 140, 62);
      doc.setFont('helvetica', 'normal');
      doc.text(`${invoice.customer_name || 'Guest'} (${invoice.customer_phone})`, 160, 62);
    }

    // Line Divider
    doc.setDrawColor(229, 231, 235);
    doc.line(14, 74, 196, 74);

    // Table Header
    doc.setFillColor(243, 244, 246);
    doc.rect(14, 78, 182, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('ITEM DESCRIPTION', 18, 83);
    doc.text('QTY', 120, 83);
    doc.text('RATE', 145, 83);
    doc.text('AMOUNT', 175, 83);

    // Table Body
    let y = 92;
    doc.setFont('helvetica', 'normal');

    if (order && order.items && order.items.length > 0) {
      order.items.forEach(item => {
        doc.text(item.item_name, 18, y);
        doc.text(String(item.quantity), 122, y);
        doc.text(formatCurrency(item.unit_price), 145, y);
        doc.text(formatCurrency(item.total_price), 175, y);
        y += 7;
      });
    } else {
      // Consolidated billing line
      doc.text('Restaurant Food & Beverage Service (Consolidated Table Session)', 18, y);
      doc.text('1', 122, y);
      doc.text(formatCurrency(invoice.subtotal_amount), 145, y);
      doc.text(formatCurrency(invoice.subtotal_amount), 175, y);
      y += 8;
    }

    // Divider
    doc.line(14, y + 2, 196, y + 2);
    y += 10;

    // Financial Breakdown
    const rightLabelX = 130;
    const rightValX = 175;

    doc.setFont('helvetica', 'normal');
    doc.text('Taxable Subtotal:', rightLabelX, y);
    doc.text(formatCurrency(invoice.subtotal_amount), rightValX, y);
    y += 6;

    doc.text(`CGST (${invoice.cgst_rate}%):`, rightLabelX, y);
    doc.text(formatCurrency(invoice.cgst_amount), rightValX, y);
    y += 6;

    doc.text(`SGST (${invoice.sgst_rate}%):`, rightLabelX, y);
    doc.text(formatCurrency(invoice.sgst_amount), rightValX, y);
    y += 6;

    if (invoice.discount_amount > 0) {
      doc.text('Discount:', rightLabelX, y);
      doc.text(`-${formatCurrency(invoice.discount_amount)}`, rightValX, y);
      y += 6;
    }

    // Total Highlight
    doc.setFillColor(243, 240, 255); // Purple tint
    doc.rect(rightLabelX - 5, y - 1, 71, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(112, 71, 235); // #7047EB
    doc.text('TOTAL AMOUNT:', rightLabelX, y + 6);
    doc.text(formatCurrency(invoice.total_amount), rightValX, y + 6);

    // Footer
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Thank you for dining with us! This is a system-generated tax invoice powered by RESTO OS.', 14, 275);
    doc.text('For queries or reservations, contact: ' + restaurant.phone, 14, 280);

    // Save PDF
    doc.save(`${invoice.invoice_number}.pdf`);
  }
}
