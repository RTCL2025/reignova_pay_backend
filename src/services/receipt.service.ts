import { Resend } from 'resend';
import PDFDocument from 'pdfkit';
import { Checkout } from '../models/checkout.model.js';
import { Payment } from '../models/payment.model.js';
import { Application } from '../models/application.model.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const REIGNOVA_GOLD_R_SVG_PATH =
  'M557.65,467.39c0,0,96.21-30.27,96.21-157c0-85.57-76-169.75-169.75-169.75H198.84c-45.26,0-81.96,36.69-81.96,81.96v311.33c-24.08,12.71-39.45,39.73-34.68,69.76c4.6,29.02,28.79,51.96,57.99,55.24c40.21,4.52,74.27-26.83,74.27-66.13c0-25.75-14.65-48.04-36.05-59.11V232.88c0-14.49,11.75-26.24,26.24-26.24h267.34c17.24,0,34.49,3.1,50.1,10.41c61.98,29.03,75.14,101.36,50.1,156.27c-29.09,63.77-129.77,57.05-129.77,57.05l145.43,163.33h-89.5L317.13,396.82v-51.46l153.57,0c16.65,0,31.52-12.17,33.1-28.75c1.81-19.02-13.09-35.02-31.73-35.02H257.84v135.36l213.89,233.11h246.94L557.65,467.39z M147.89,616.38c-13.02,0-23.58-10.56-23.58-23.58c0-13.02,10.56-23.58,23.58-23.58c13.02,0,23.58,10.56,23.58,23.58C171.47,605.82,160.92,616.38,147.89,616.38z';

function formatCurrency(amount: number, currency = 'TZS'): string {
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(amount);
  return `${currency} ${formatted}`;
}

function formatDate(date?: Date | null): string {
  if (!date) date = new Date();
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
}

export class ReceiptService {
  private resendClient: Resend | null = null;

  constructor() {
    if (env.RESEND_API_KEY) {
      this.resendClient = new Resend(env.RESEND_API_KEY);
    }
  }

  /**
   * Generates a high-quality PDF receipt buffer for a Checkout session with official Reignova branding & logo.
   */
  public generateReceiptPdf(checkout: Checkout): Promise<Buffer> {
    const application = (checkout as unknown as { application?: Application }).application;
    const amountItem = checkout.amounts?.[0];
    const currency = amountItem?.currency || 'TZS';
    const totalAmount = amountItem ? Number(amountItem.amount) : 0;
    const merchantName = application?.name || 'Reignova Merchant';

    const metadata = checkout.metadata as Record<string, any> | null;
    const reason = checkout.reason as Record<string, any> | null;

    const title =
      metadata?.itemTitle ||
      metadata?.title ||
      (typeof reason === 'object' && reason?.title ? String(reason.title) : null) ||
      (typeof reason === 'object' && reason?.description ? String(reason.description) : null) ||
      checkout.reference;

    const category =
      metadata?.itemCategory ||
      metadata?.category ||
      (typeof reason === 'object' && reason?.category ? String(reason.category) : null) ||
      'Checkout Order';

    const subtotal: number | null =
      typeof metadata?.subtotal === 'number'
        ? metadata.subtotal
        : typeof metadata?.baseAmount === 'number'
        ? metadata.baseAmount
        : typeof metadata?.itemAmount === 'number'
        ? metadata.itemAmount
        : null;

    const feeAmount: number | null =
      typeof metadata?.fee === 'number'
        ? metadata.fee
        : typeof metadata?.feeAmount === 'number'
        ? metadata.feeAmount
        : typeof metadata?.serviceFee === 'number'
        ? metadata.serviceFee
        : subtotal !== null && totalAmount >= subtotal
        ? totalAmount - subtotal
        : null;

    const quantity = metadata?.quantity || metadata?.itemQuantity || 1;
    const itemName = metadata?.itemName || metadata?.itemLabel || 'Item Access';
    const payerName = checkout.customerName || (checkout.payer?.name as string) || 'Customer';
    const payerPhone = checkout.customerPhone || (checkout.payer?.phoneNumber as string) || '—';
    const payerEmail = checkout.customerEmail || (checkout.payer?.email as string) || '—';
    const depositId = checkout.depositId || checkout.reference;
    const paymentDate = formatDate(checkout.completedAt || checkout.createdAt);

    return this.buildPdfDocument({
      reference: checkout.reference,
      merchantName,
      title,
      category,
      totalAmount,
      currency,
      subtotal,
      feeAmount,
      quantity,
      itemName,
      payerName,
      payerPhone,
      payerEmail,
      depositId,
      paymentDate,
      statusLabel: 'Payment Confirmed',
      provider: 'Mobile Money',
    });
  }

  /**
   * Generates a high-quality PDF receipt buffer for a direct Payment record.
   */
  public generatePaymentReceiptPdf(payment: Payment): Promise<Buffer> {
    const application = (payment as unknown as { application?: Application }).application;
    const currency = payment.currency || 'TZS';
    const totalAmount = Number(payment.amount) || 0;
    const merchantName = application?.name || 'Reignova Merchant';

    const metadata = (payment.metadata || {}) as Record<string, any>;
    const title = metadata?.itemTitle || metadata?.title || payment.description || payment.reference;
    const category = metadata?.itemCategory || metadata?.category || metadata?.type || `${payment.type} Order`;

    const subtotal: number | null =
      typeof metadata?.subtotal === 'number'
        ? metadata.subtotal
        : typeof metadata?.baseAmount === 'number'
        ? metadata.baseAmount
        : typeof metadata?.itemAmount === 'number'
        ? metadata.itemAmount
        : null;

    const feeAmount: number | null =
      typeof metadata?.fee === 'number'
        ? metadata.fee
        : typeof metadata?.feeAmount === 'number'
        ? metadata.feeAmount
        : typeof metadata?.serviceFee === 'number'
        ? metadata.serviceFee
        : subtotal !== null && totalAmount >= subtotal
        ? totalAmount - subtotal
        : null;

    const quantity = metadata?.quantity || metadata?.itemQuantity || 1;
    const itemName = metadata?.itemName || metadata?.itemLabel || 'Item Access';
    const payerName = (metadata?.customerName as string) || (metadata?.payerName as string) || 'Customer';
    const payerPhone = payment.phoneNumber || '—';
    const payerEmail = (metadata?.customerEmail as string) || (metadata?.payerEmail as string) || '—';
    const depositId = payment.providerPaymentId || payment.reference;
    const paymentDate = formatDate(payment.completedAt || payment.createdAt);

    return this.buildPdfDocument({
      reference: payment.reference,
      merchantName,
      title,
      category,
      totalAmount,
      currency,
      subtotal,
      feeAmount,
      quantity,
      itemName,
      payerName,
      payerPhone,
      payerEmail,
      depositId,
      paymentDate,
      statusLabel: payment.status || 'COMPLETED',
      provider: payment.provider || 'PawaPay Mobile Money',
    });
  }

  /**
   * PDF Document Builder with Reignova Pay Logo & Brand Schemes.
   */
  private buildPdfDocument(params: {
    reference: string;
    merchantName: string;
    title: string;
    category: string;
    totalAmount: number;
    currency: string;
    subtotal: number | null;
    feeAmount: number | null;
    quantity: number;
    itemName: string;
    payerName: string;
    payerPhone: string;
    payerEmail: string;
    depositId: string;
    paymentDate: string;
    statusLabel: string;
    provider: string;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
          info: {
            Title: `Payment Receipt - ${params.reference}`,
            Author: 'Reignova Pay',
            Subject: 'Official Payment Receipt',
          },
        });

        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));

        const pageWidth = 515.28; // 595.28 - 80 margin
        const startX = 40;

        // ----------------------------------------------------
        // 1. Header Banner (Deep Navy #0F1A25)
        // ----------------------------------------------------
        const headerY = 40;
        const headerHeight = 90;
        doc.roundedRect(startX, headerY, pageWidth, headerHeight, 12).fill('#0F1A25');

        // Draw Reignova Vector Logo (Navy box + Gold R emblem)
        doc.save();
        doc.translate(startX + 16, headerY + 16);
        doc.scale(0.072); // 800x800 -> 57.6x57.6 pt
        doc.roundedRect(0, 0, 800, 800, 160).fill('#0F1A25');
        doc.path(REIGNOVA_GOLD_R_SVG_PATH).fill('#F3A221');
        doc.restore();

        // Reignova Pay Typography
        doc
          .fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .fontSize(18)
          .text('REIGNOVA ', startX + 80, headerY + 24, { continued: true })
          .fillColor('#F3A221')
          .text('PAY');

        doc
          .fillColor('#94A3B8')
          .font('Helvetica')
          .fontSize(9.5)
          .text('Official Payment Receipt', startX + 80, headerY + 48);

        // Status Badge Pill
        const badgeWidth = 140;
        const badgeX = startX + pageWidth - badgeWidth - 16;
        doc.roundedRect(badgeX, headerY + 30, badgeWidth, 24, 12).fill('#10B981');
        doc
          .fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .text(params.statusLabel.toUpperCase(), badgeX, headerY + 37, {
            width: badgeWidth,
            align: 'center',
          });

        // ----------------------------------------------------
        // 2. Amount Paid Hero Card
        // ----------------------------------------------------
        const heroY = headerY + headerHeight + 16;
        const heroHeight = 65;
        doc
          .roundedRect(startX, heroY, pageWidth, heroHeight, 8)
          .fillAndStroke('#F8FAFC', '#E2E8F0');

        doc
          .fillColor('#64748B')
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .text('AMOUNT PAID', startX, heroY + 12, { width: pageWidth, align: 'center' });

        doc
          .fillColor('#0F172A')
          .font('Helvetica-Bold')
          .fontSize(20)
          .text(formatCurrency(params.totalAmount, params.currency), startX, heroY + 25, {
            width: pageWidth,
            align: 'center',
          });

        doc
          .fillColor('#94A3B8')
          .font('Helvetica')
          .fontSize(7.5)
          .text('Taxes & clearing fees included', startX, heroY + 48, {
            width: pageWidth,
            align: 'center',
          });

        // ----------------------------------------------------
        // 3. Transaction Details Section
        // ----------------------------------------------------
        let currentY = heroY + heroHeight + 20;

        doc
          .fillColor('#475569')
          .font('Helvetica-Bold')
          .fontSize(9)
          .text('TRANSACTION DETAILS', startX, currentY);

        currentY += 16;

        const details: [string, string][] = [
          ['Merchant / Settled To', params.merchantName],
          ['Order Description', params.title],
          ['Order Reference', params.reference],
          ['Transaction ID', params.depositId],
          ['Payment Date', params.paymentDate],
          ['Payer Name', params.payerName],
          ['Handset / Account', params.payerPhone],
          ['Payer Email', params.payerEmail],
        ];

        for (const [label, val] of details) {
          doc
            .fillColor('#64748B')
            .font('Helvetica')
            .fontSize(9)
            .text(label, startX, currentY);

          doc
            .fillColor('#0F172A')
            .font('Helvetica-Bold')
            .fontSize(9)
            .text(val, startX + 160, currentY, { width: pageWidth - 160, align: 'right' });

          currentY += 16;
          doc
            .moveTo(startX, currentY)
            .lineTo(startX + pageWidth, currentY)
            .strokeColor('#F1F5F9')
            .lineWidth(0.8)
            .stroke();

          currentY += 6;
        }

        // ----------------------------------------------------
        // 4. Line Items & Breakdown Box
        // ----------------------------------------------------
        currentY += 10;
        const boxY = currentY;

        let boxHeight = 70;
        if (params.subtotal !== null && params.feeAmount !== null && params.feeAmount > 0) {
          boxHeight = 90;
        }

        doc
          .roundedRect(startX, boxY, pageWidth, boxHeight, 8)
          .fillAndStroke('#F8FAFC', '#E2E8F0');

        let innerY = boxY + 10;
        doc
          .fillColor('#64748B')
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .text('PAYMENT LINE ITEMS', startX + 14, innerY);

        innerY += 16;

        if (params.subtotal !== null) {
          doc
            .fillColor('#334155')
            .font('Helvetica')
            .fontSize(9)
            .text(`${params.quantity}x ${params.itemName}`, startX + 14, innerY);

          doc
            .fillColor('#0F172A')
            .font('Helvetica-Bold')
            .fontSize(9)
            .text(formatCurrency(params.subtotal, params.currency), startX + 14, innerY, {
              width: pageWidth - 28,
              align: 'right',
            });

          innerY += 16;

          if (params.feeAmount !== null && params.feeAmount > 0) {
            doc
              .fillColor('#334155')
              .font('Helvetica')
              .fontSize(9)
              .text('Platform & Network Clearing Fee', startX + 14, innerY);

            doc
              .fillColor('#0F172A')
              .font('Helvetica-Bold')
              .fontSize(9)
              .text(formatCurrency(params.feeAmount, params.currency), startX + 14, innerY, {
                width: pageWidth - 28,
                align: 'right',
              });

            innerY += 16;
          }
        } else {
          doc
            .fillColor('#334155')
            .font('Helvetica')
            .fontSize(9)
            .text(`${params.category} (${params.title})`, startX + 14, innerY);

          doc
            .fillColor('#0F172A')
            .font('Helvetica-Bold')
            .fontSize(9)
            .text(formatCurrency(params.totalAmount, params.currency), startX + 14, innerY, {
              width: pageWidth - 28,
              align: 'right',
            });

          innerY += 16;
        }

        doc
          .moveTo(startX + 14, innerY)
          .lineTo(startX + pageWidth - 14, innerY)
          .strokeColor('#CBD5E1')
          .lineWidth(0.8)
          .stroke();

        innerY += 8;

        doc
          .fillColor('#0F172A')
          .font('Helvetica-Bold')
          .fontSize(10)
          .text('Total Settled', startX + 14, innerY);

        doc
          .fillColor('#0F172A')
          .font('Helvetica-Bold')
          .fontSize(11)
          .text(formatCurrency(params.totalAmount, params.currency), startX + 14, innerY, {
            width: pageWidth - 28,
            align: 'right',
          });

        // ----------------------------------------------------
        // 5. Footer (PCI-DSS & Security)
        // ----------------------------------------------------
        const footerY = 740;
        doc
          .moveTo(startX, footerY)
          .lineTo(startX + pageWidth, footerY)
          .strokeColor('#E2E8F0')
          .lineWidth(1)
          .stroke();

        doc
          .fillColor('#475569')
          .font('Helvetica-Bold')
          .fontSize(9)
          .text('Thank you for your payment. Secured by Reignova Payments.', startX, footerY + 12, {
            width: pageWidth,
            align: 'center',
          });

        doc
          .fillColor('#94A3B8')
          .font('Helvetica')
          .fontSize(7.5)
          .text('PCI-DSS Compliant • TLS 1.3 Encryption • 256-bit Security', startX, footerY + 26, {
            width: pageWidth,
            align: 'center',
          });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Generates responsive HTML document with print styles for payment receipt.
   */
  public generateReceiptHtml(checkout: Checkout): string {
    const application = (checkout as unknown as { application?: Application }).application;
    const amountItem = checkout.amounts?.[0];
    const currency = amountItem?.currency || 'TZS';
    const totalAmount = amountItem ? Number(amountItem.amount) : 0;
    const merchantName = application?.name || 'Reignova Merchant';

    const metadata = checkout.metadata as Record<string, any> | null;
    const reason = checkout.reason as Record<string, any> | null;

    const title =
      metadata?.itemTitle ||
      metadata?.title ||
      (typeof reason === 'object' && reason?.title ? String(reason.title) : null) ||
      (typeof reason === 'object' && reason?.description ? String(reason.description) : null) ||
      checkout.reference;

    const category =
      metadata?.itemCategory ||
      metadata?.category ||
      (typeof reason === 'object' && reason?.category ? String(reason.category) : null) ||
      'Checkout Order';

    const subtotal: number | null =
      typeof metadata?.subtotal === 'number'
        ? metadata.subtotal
        : typeof metadata?.baseAmount === 'number'
        ? metadata.baseAmount
        : typeof metadata?.itemAmount === 'number'
        ? metadata.itemAmount
        : null;

    const feeAmount: number | null =
      typeof metadata?.fee === 'number'
        ? metadata.fee
        : typeof metadata?.feeAmount === 'number'
        ? metadata.feeAmount
        : typeof metadata?.serviceFee === 'number'
        ? metadata.serviceFee
        : subtotal !== null && totalAmount >= subtotal
        ? totalAmount - subtotal
        : null;

    const quantity = metadata?.quantity || metadata?.itemQuantity || 1;
    const itemName = metadata?.itemName || metadata?.itemLabel || 'Item Access';
    const payerName = checkout.customerName || (checkout.payer?.name as string) || 'Customer';
    const payerPhone = checkout.customerPhone || (checkout.payer?.phoneNumber as string) || '—';
    const payerEmail = checkout.customerEmail || (checkout.payer?.email as string) || '—';
    const depositId = checkout.depositId || checkout.reference;
    const paymentDate = formatDate(checkout.completedAt || checkout.createdAt);
    const checkoutUrl = checkout.publicToken ? `${env.CHECKOUT_BASE_URL}/checkout/${checkout.publicToken}` : '#';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Payment Receipt - ${checkout.reference}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      padding: 32px 16px;
      line-height: 1.5;
    }
    .receipt-card {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.05);
      overflow: hidden;
    }
    .receipt-header {
      background: #0f1a25;
      color: #ffffff;
      padding: 32px 28px;
      text-align: center;
    }
    .brand-logo {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #ffffff;
      margin-bottom: 8px;
    }
    .brand-gold { color: #f3a221; }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #10b981;
      font-size: 12px;
      font-weight: 700;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 8px;
    }
    .receipt-body {
      padding: 28px;
    }
    .amount-hero {
      text-align: center;
      padding: 20px;
      background: #f8fafc;
      border-radius: 12px;
      border: 1px solid #f1f5f9;
      margin-bottom: 24px;
    }
    .amount-label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .amount-value {
      font-size: 32px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -1px;
      margin-top: 4px;
    }
    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .details-table td {
      padding: 10px 0;
      font-size: 13px;
      border-bottom: 1px solid #f1f5f9;
    }
    .details-table td.label {
      color: #64748b;
      font-weight: 500;
      width: 40%;
    }
    .details-table td.value {
      color: #0f172a;
      font-weight: 600;
      text-align: right;
    }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .breakdown-section {
      background: #f8fafc;
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 24px;
      border: 1px solid #e2e8f0;
    }
    .breakdown-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }
    .breakdown-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      padding: 4px 0;
      color: #334155;
    }
    .breakdown-row.total {
      border-top: 1px solid #cbd5e1;
      margin-top: 8px;
      padding-top: 10px;
      font-weight: 800;
      font-size: 15px;
      color: #0f172a;
    }
    .receipt-footer {
      text-align: center;
      padding: 24px;
      border-top: 1px solid #f1f5f9;
      color: #64748b;
      font-size: 12px;
    }
    .action-btn {
      display: inline-block;
      margin-top: 12px;
      padding: 10px 20px;
      background: #f3a221;
      color: #0f1a25;
      font-weight: 700;
      text-decoration: none;
      border-radius: 8px;
      font-size: 13px;
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .receipt-card { border: none; box-shadow: none; width: 100%; max-width: 100%; }
      .action-btn { display: none; }
    }
  </style>
</head>
<body>
  <div class="receipt-card">
    <div class="receipt-header">
      <div class="brand-logo">REIGNOVA<span class="brand-gold">PAY</span></div>
      <p style="font-size: 13px; color: #94a3b8;">Official Payment Receipt</p>
      <div class="status-badge">Payment Successful</div>
    </div>

    <div class="receipt-body">
      <div class="amount-hero">
        <div class="amount-label">Amount Paid</div>
        <div class="amount-value">${formatCurrency(totalAmount, currency)}</div>
        <p style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Taxes &amp; clearing fees included</p>
      </div>

      <table class="details-table">
        <tr>
          <td class="label">Merchant / Settled To</td>
          <td class="value">${merchantName}</td>
        </tr>
        <tr>
          <td class="label">Order Description</td>
          <td class="value">${title}</td>
        </tr>
        <tr>
          <td class="label">Order Reference</td>
          <td class="value mono">${checkout.reference}</td>
        </tr>
        <tr>
          <td class="label">Transaction ID</td>
          <td class="value mono">${depositId}</td>
        </tr>
        <tr>
          <td class="label">Payment Date</td>
          <td class="value">${paymentDate}</td>
        </tr>
        <tr>
          <td class="label">Payer Name</td>
          <td class="value">${payerName}</td>
        </tr>
        <tr>
          <td class="label">Handset / Account</td>
          <td class="value mono">${payerPhone}</td>
        </tr>
        <tr>
          <td class="label">Payer Email</td>
          <td class="value">${payerEmail}</td>
        </tr>
      </table>

      <div class="breakdown-section">
        <div class="breakdown-title">Payment Line Items</div>
        ${
          subtotal !== null
            ? `
          <div class="breakdown-row">
            <span>${quantity}x ${itemName}</span>
            <span>${formatCurrency(subtotal, currency)}</span>
          </div>
          ${
            feeAmount !== null && feeAmount > 0
              ? `
          <div class="breakdown-row">
            <span>Platform &amp; Network Clearing Fee</span>
            <span>${formatCurrency(feeAmount, currency)}</span>
          </div>`
              : ''
          }
        `
            : `
          <div class="breakdown-row">
            <span>${category} (${title})</span>
            <span>${formatCurrency(totalAmount, currency)}</span>
          </div>`
        }
        <div class="breakdown-row total">
          <span>Total Settled</span>
          <span>${formatCurrency(totalAmount, currency)}</span>
        </div>
      </div>
    </div>

    <div class="receipt-footer">
      <p>Thank you for your payment. Secured by <strong>Reignova Payments</strong>.</p>
      <p style="font-size: 11px; color: #94a3b8; margin-top: 4px;">PCI-DSS Compliant • TLS 1.3 Encryption • 256-bit Security</p>
      <a href="${checkoutUrl}" class="action-btn">View Live Checkout Status</a>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Generates HTML receipt for a Payment record (Admin monitoring / direct payments).
   */
  public generatePaymentReceiptHtml(payment: Payment): string {
    const application = (payment as unknown as { application?: Application }).application;
    const currency = payment.currency || 'TZS';
    const totalAmount = Number(payment.amount) || 0;
    const merchantName = application?.name || 'Reignova Merchant';

    const metadata = (payment.metadata || {}) as Record<string, any>;
    const title = metadata?.itemTitle || metadata?.title || payment.description || payment.reference;
    const category = metadata?.itemCategory || metadata?.category || metadata?.type || `${payment.type} Order`;

    const subtotal: number | null =
      typeof metadata?.subtotal === 'number'
        ? metadata.subtotal
        : typeof metadata?.baseAmount === 'number'
        ? metadata.baseAmount
        : typeof metadata?.itemAmount === 'number'
        ? metadata.itemAmount
        : null;

    const feeAmount: number | null =
      typeof metadata?.fee === 'number'
        ? metadata.fee
        : typeof metadata?.feeAmount === 'number'
        ? metadata.feeAmount
        : typeof metadata?.serviceFee === 'number'
        ? metadata.serviceFee
        : subtotal !== null && totalAmount >= subtotal
        ? totalAmount - subtotal
        : null;

    const quantity = metadata?.quantity || metadata?.itemQuantity || 1;
    const itemName = metadata?.itemName || metadata?.itemLabel || 'Item Access';
    const payerName = (metadata?.customerName as string) || (metadata?.payerName as string) || 'Customer';
    const payerPhone = payment.phoneNumber || '—';
    const payerEmail = (metadata?.customerEmail as string) || (metadata?.payerEmail as string) || '—';
    const depositId = payment.providerPaymentId || payment.reference;
    const paymentDate = formatDate(payment.completedAt || payment.createdAt);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Payment Receipt - ${payment.reference}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      padding: 32px 16px;
      line-height: 1.5;
    }
    .receipt-card {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.05);
      overflow: hidden;
    }
    .receipt-header {
      background: #0f1a25;
      color: #ffffff;
      padding: 32px 28px;
      text-align: center;
    }
    .brand-logo {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #ffffff;
      margin-bottom: 8px;
    }
    .brand-gold { color: #f3a221; }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #10b981;
      font-size: 12px;
      font-weight: 700;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 8px;
    }
    .receipt-body {
      padding: 28px;
    }
    .amount-hero {
      text-align: center;
      padding: 20px;
      background: #f8fafc;
      border-radius: 12px;
      border: 1px solid #f1f5f9;
      margin-bottom: 24px;
    }
    .amount-label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .amount-value {
      font-size: 32px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -1px;
      margin-top: 4px;
    }
    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .details-table td {
      padding: 10px 0;
      font-size: 13px;
      border-bottom: 1px solid #f1f5f9;
    }
    .details-table td.label {
      color: #64748b;
      font-weight: 500;
      width: 40%;
    }
    .details-table td.value {
      color: #0f172a;
      font-weight: 600;
      text-align: right;
    }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .breakdown-section {
      background: #f8fafc;
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 24px;
      border: 1px solid #e2e8f0;
    }
    .breakdown-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }
    .breakdown-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      padding: 4px 0;
      color: #334155;
    }
    .breakdown-row.total {
      border-top: 1px solid #cbd5e1;
      margin-top: 8px;
      padding-top: 10px;
      font-weight: 800;
      font-size: 15px;
      color: #0f172a;
    }
    .receipt-footer {
      text-align: center;
      padding: 24px;
      border-top: 1px solid #f1f5f9;
      color: #64748b;
      font-size: 12px;
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .receipt-card { border: none; box-shadow: none; width: 100%; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="receipt-card">
    <div class="receipt-header">
      <div class="brand-logo">REIGNOVA<span class="brand-gold">PAY</span></div>
      <p style="font-size: 13px; color: #94a3b8;">Official Payment Receipt</p>
      <div class="status-badge">${payment.status}</div>
    </div>

    <div class="receipt-body">
      <div class="amount-hero">
        <div class="amount-label">Amount Paid</div>
        <div class="amount-value">${formatCurrency(totalAmount, currency)}</div>
        <p style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Taxes &amp; clearing fees included</p>
      </div>

      <table class="details-table">
        <tr>
          <td class="label">Merchant / Settled To</td>
          <td class="value">${merchantName}</td>
        </tr>
        <tr>
          <td class="label">Order Description</td>
          <td class="value">${title}</td>
        </tr>
        <tr>
          <td class="label">Order Reference</td>
          <td class="value mono">${payment.reference}</td>
        </tr>
        <tr>
          <td class="label">Transaction ID</td>
          <td class="value mono">${depositId}</td>
        </tr>
        <tr>
          <td class="label">Carrier Provider</td>
          <td class="value">${payment.provider || 'PawaPay Mobile Money'}</td>
        </tr>
        <tr>
          <td class="label">Payment Date</td>
          <td class="value">${paymentDate}</td>
        </tr>
        <tr>
          <td class="label">Payer Name</td>
          <td class="value">${payerName}</td>
        </tr>
        <tr>
          <td class="label">Handset / Account</td>
          <td class="value mono">${payerPhone}</td>
        </tr>
        ${payerEmail !== '—' ? `<tr><td class="label">Payer Email</td><td class="value">${payerEmail}</td></tr>` : ''}
      </table>

      <div class="breakdown-section">
        <div class="breakdown-title">Payment Line Items</div>
        ${
          subtotal !== null
            ? `
          <div class="breakdown-row">
            <span>${quantity}x ${itemName}</span>
            <span>${formatCurrency(subtotal, currency)}</span>
          </div>
          ${
            feeAmount !== null && feeAmount > 0
              ? `
          <div class="breakdown-row">
            <span>Platform &amp; Network Clearing Fee</span>
            <span>${formatCurrency(feeAmount, currency)}</span>
          </div>`
              : ''
          }
        `
            : `
          <div class="breakdown-row">
            <span>${category} (${title})</span>
            <span>${formatCurrency(totalAmount, currency)}</span>
          </div>`
        }
        <div class="breakdown-row total">
          <span>Total Settled</span>
          <span>${formatCurrency(totalAmount, currency)}</span>
        </div>
      </div>
    </div>

    <div class="receipt-footer">
      <p>Thank you for your payment. Secured by <strong>Reignova Payments</strong>.</p>
      <p style="font-size: 11px; color: #94a3b8; margin-top: 4px;">PCI-DSS Compliant • TLS 1.3 Encryption • 256-bit Security</p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Automatically sends receipt email to payer with HTML body and attached PDF receipt.
   */
  public async sendReceiptEmail(checkout: Checkout): Promise<boolean> {
    const recipientEmail = checkout.customerEmail || (checkout.payer?.email as string | undefined);

    if (!recipientEmail || !recipientEmail.includes('@')) {
      logger.info(
        { checkoutId: checkout.id, reference: checkout.reference },
        'No valid customer email found on checkout session. Skipping receipt email.'
      );
      return false;
    }

    if (!env.RESEND_API_KEY || !this.resendClient) {
      logger.info(
        { checkoutId: checkout.id, recipientEmail },
        'RESEND_API_KEY is not configured. Skipping automated receipt email dispatch.'
      );
      return false;
    }

    try {
      const htmlContent = this.generateReceiptHtml(checkout);
      const pdfBuffer = await this.generateReceiptPdf(checkout);
      const application = (checkout as unknown as { application?: Application }).application;
      const merchantName = application?.name || 'Reignova';

      const data = await this.resendClient.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: [recipientEmail],
        subject: `Payment Receipt: ${checkout.reference} - ${merchantName}`,
        html: htmlContent,
        attachments: [
          {
            filename: `Receipt-${checkout.reference}.pdf`,
            content: pdfBuffer,
          },
        ],
      });

      logger.info(
        { checkoutId: checkout.id, emailId: data.data?.id, recipientEmail },
        'Automated payment receipt email successfully dispatched with PDF attachment via Resend'
      );
      return true;
    } catch (err: unknown) {
      logger.error(
        { err, checkoutId: checkout.id, recipientEmail },
        'Failed to dispatch payment receipt email via Resend'
      );
      return false;
    }
  }
}

export const receiptService = new ReceiptService();
export default receiptService;

