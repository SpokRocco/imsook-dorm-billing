import React from 'react';
import { toThaiBahtText, formatNumber } from '../utils/bahtText.js';

/**
 * Exact Half-A4 Receipt Component (210mm x 147.8mm)
 * Designed strictly with explicit black/white styling for pixel-perfect PDF & A4 print output.
 */
export default function ReceiptHalfA4({
  doc = {},
  settings = {},
  editable = false,
  onChange = null
}) {
  const safeDoc = doc || {};
  const isBlank = Boolean(safeDoc.is_blank);

  const emitField = (field, val) => {
    if (!editable || !onChange) return;
    const next = { ...safeDoc, [field]: val };

    // Auto-recompute water units when prev/curr edited
    if (field === 'water_prev' || field === 'water_curr' || field === 'water_unit_price') {
      const wp = parseFloat(next.water_prev);
      const wc = parseFloat(next.water_curr);
      if (!isNaN(wp) && !isNaN(wc) && wc >= wp) {
        next.water_units = wc - wp;
        const rate = Number(next.water_unit_price || settings?.default_water_rate || 10);
        next.water_total = next.water_units * rate;
      }
    }

    // Auto-recompute electric units when prev/curr edited
    if (field === 'electric_prev' || field === 'electric_curr' || field === 'electric_unit_price') {
      const ep = parseFloat(next.electric_prev);
      const ec = parseFloat(next.electric_curr);
      if (!isNaN(ep) && !isNaN(ec) && ec >= ep) {
        next.electric_units = ec - ep;
        const rate = Number(next.electric_unit_price || settings?.default_electric_rate || 8);
        next.electric_total = next.electric_units * rate;
      }
    }

    // Recompute grand total when any component changes
    if (
      [
        'room_rate', 'water_prev', 'water_curr', 'water_unit_price', 'water_total',
        'electric_prev', 'electric_curr', 'electric_unit_price', 'electric_total',
        'other_amount', 'deposit_deduction'
      ].includes(field)
    ) {
      const t =
        Number(next.room_rate || 0) +
        Number(next.water_total || 0) +
        Number(next.electric_total || 0) +
        Number(next.other_amount || 0) -
        Number(next.deposit_deduction || 0);
      next.total_amount = t;
      next.baht_text = toThaiBahtText(t);
    } else if (field === 'total_amount') {
      next.baht_text = toThaiBahtText(val);
    }

    onChange(next);
  };

  const receiptTitle = settings?.receipt_title || 'ใบเสร็จรับเงินค่าเช่าห้อง';
  const dormName = settings?.dorm_name || 'หอพักอิ่มสุข';
  const bankName = safeDoc.bank_name_snapshot || settings?.bank_name || 'ธ.ก.ส.';
  const accountNumber = safeDoc.account_number_snapshot || settings?.account_number || '017562024411';
  const accountHolder = safeDoc.account_holder_snapshot || settings?.account_holder || 'นาง เอมอร ไทยนอ';
  const qrCaption = safeDoc.qr_caption_snapshot || settings?.qr_caption || accountHolder;

  const isDaily = safeDoc.invoice_type === 'daily';
  const isCustomOrMonthly = safeDoc.invoice_type !== 'daily';

  const displayRoomLabel = (() => {
    if (safeDoc.room_rate_label) return safeDoc.room_rate_label;
    if (safeDoc.invoice_type === 'daily') {
      return `ค่าเช่าห้องรายวัน ${safeDoc.days_count || 1} วัน`;
    }
    return `ค่าห้องเดือน...${safeDoc.billing_month || ''}....`;
  })();

  const computedTotal = Number(safeDoc.total_amount ?? 0);
  const displayBahtText = safeDoc.baht_text || (computedTotal ? toThaiBahtText(computedTotal) : '');

  const netOtherDisplay = (() => {
    const dep = Number(safeDoc.deposit_deduction || 0);
    const oth = Number(safeDoc.other_amount || 0);
    const net = oth - dep;
    if (dep > 0 && oth === 0) return `-${formatNumber(dep)}`;
    if (net !== 0) return net > 0 ? `+${formatNumber(net)}` : formatNumber(net);
    return '';
  })();

  const dotStyle = { borderBottom: '1px dotted #000000', paddingBottom: '1px' };
  const cellBorder = { border: '1px solid #000000' };

  return (
    <div className="half-a4-receipt" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
      {/* TOP HEADER BLOCK */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#000000' }}>
            {dormName}
          </div>
          <div style={{ fontSize: '11px', color: '#334155' }}>
            {safeDoc.zone ? `โซน: ${safeDoc.zone}` : ''}
          </div>
        </div>

        {/* Title Row & Date */}
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '4px' }}>
          <h2 style={{ fontSize: '18.5px', fontWeight: 700, textAlign: 'center', lineHeight: 1.2, margin: 0, color: '#000000' }}>
            {receiptTitle}
          </h2>
          <div style={{ position: 'absolute', right: 0, bottom: 0, fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>วันที่</span>
            {isBlank ? (
              <span style={{ display: 'inline-block', width: '48px', borderBottom: '1.5px dotted #000000' }}>&nbsp;</span>
            ) : editable ? (
              <input
                value={safeDoc.doc_day ?? ''}
                onChange={(e) => emitField('doc_day', e.target.value)}
                className="dotted-input"
                style={{ width: '40px', textAlign: 'center', fontWeight: 600 }}
              />
            ) : (
              <span style={{ display: 'inline-block', minWidth: '32px', textAlign: 'center', fontWeight: 600, ...dotStyle }}>
                {safeDoc.doc_day || '1'}
              </span>
            )}
          </div>
        </div>

        {/* Rental Type Checkboxes Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '36px', fontSize: '14.5px', marginBottom: '4px', paddingLeft: '16px' }}>
          <label
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: editable ? 'pointer' : 'default' }}
            onClick={() => editable && emitField('invoice_type', 'daily')}
          >
            <span
              style={{
                width: '15px',
                height: '15px',
                border: '1.5px solid #000000',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11.5px',
                fontWeight: 700
              }}
            >
              {isDaily ? '✓' : ''}
            </span>
            <span>รายวัน</span>
          </label>
          <label
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: editable ? 'pointer' : 'default' }}
            onClick={() => editable && emitField('invoice_type', 'monthly')}
          >
            <span
              style={{
                width: '15px',
                height: '15px',
                border: '1.5px solid #000000',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11.5px',
                fontWeight: 700
              }}
            >
              {isCustomOrMonthly ? '✓' : ''}
            </span>
            <span>รายเดือน</span>
          </label>
        </div>

        {/* Name & Room & Month Year Line */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', fontSize: '14px', marginBottom: '6px', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', flex: 1, minWidth: '210px' }}>
            <span style={{ marginRight: '8px', fontWeight: 500 }}>ชื่อ</span>
            {isBlank ? (
              <span style={{ flex: 1, borderBottom: '1.5px dotted #000000', marginRight: '8px' }}>&nbsp;</span>
            ) : editable ? (
              <input
                value={safeDoc.tenant_name ?? ''}
                onChange={(e) => emitField('tenant_name', e.target.value)}
                className="dotted-input"
                style={{ flex: 1, marginRight: '8px', fontWeight: 600, padding: '0 4px' }}
                placeholder="ชื่อผู้เช่า..."
              />
            ) : (
              <span style={{ flex: 1, fontWeight: 600, padding: '0 8px', marginRight: '8px', ...dotStyle }}>
                {safeDoc.tenant_name}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <span style={{ marginRight: '4px' }}>ห้อง</span>
            {isBlank ? (
              <span style={{ width: '56px', borderBottom: '1.5px dotted #000000', marginRight: '8px' }}>&nbsp;</span>
            ) : editable ? (
              <input
                value={safeDoc.room_number ?? ''}
                onChange={(e) => emitField('room_number', e.target.value)}
                className="dotted-input"
                style={{ width: '64px', textAlign: 'center', fontWeight: 700, marginRight: '8px' }}
                placeholder="เลขห้อง"
              />
            ) : (
              <span style={{ minWidth: '52px', textAlign: 'center', fontWeight: 700, padding: '0 6px', marginRight: '8px', ...dotStyle }}>
                {safeDoc.room_number}
              </span>
            )}

            <span style={{ marginRight: '4px' }}>เดือน</span>
            {isBlank ? (
              <span style={{ width: '96px', borderBottom: '1.5px dotted #000000', marginRight: '8px' }}>&nbsp;</span>
            ) : editable ? (
              <input
                value={safeDoc.billing_month ?? ''}
                onChange={(e) => emitField('billing_month', e.target.value)}
                className="dotted-input"
                style={{ width: '100px', textAlign: 'center', fontWeight: 600, marginRight: '8px' }}
              />
            ) : (
              <span style={{ minWidth: '88px', textAlign: 'center', fontWeight: 600, padding: '0 6px', marginRight: '8px', ...dotStyle }}>
                {safeDoc.billing_month}
              </span>
            )}

            <span style={{ marginRight: '4px' }}>พ.ศ.</span>
            {isBlank ? (
              <span style={{ width: '48px', borderBottom: '1.5px dotted #000000' }}>&nbsp;</span>
            ) : editable ? (
              <input
                value={safeDoc.billing_year_be ?? ''}
                onChange={(e) => emitField('billing_year_be', e.target.value)}
                className="dotted-input"
                style={{ width: '48px', textAlign: 'center', fontWeight: 600 }}
              />
            ) : (
              <span style={{ minWidth: '42px', textAlign: 'center', fontWeight: 600, padding: '0 4px', ...dotStyle }}>
                {safeDoc.billing_year_be}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* MAIN LINE ITEMS TABLE */}
      <table className="receipt-table" style={{ borderCollapse: 'collapse', width: '100%', border: '1.5px solid #000000' }}>
        <thead>
          <tr>
            <th style={{ ...cellBorder, width: '58%' }}>รายการ</th>
            <th style={{ ...cellBorder, width: '15%' }}>จำนวนหน่วย</th>
            <th style={{ ...cellBorder, width: '12%' }}>ราคา/หน่วย</th>
            <th style={{ ...cellBorder, width: '15%' }}>จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          {/* Row 1: Room Rent */}
          <tr>
            <td style={{ ...cellBorder, textAlign: 'left', fontWeight: 500 }}>
              {isBlank ? (
                <span>ค่าห้องเดือน............................................</span>
              ) : editable ? (
                <input
                  value={safeDoc.room_rate_label ?? ''}
                  onChange={(e) => emitField('room_rate_label', e.target.value)}
                  className="dotted-input"
                  style={{ width: '100%', fontSize: '13.5px', fontWeight: 500 }}
                />
              ) : (
                <span>{displayRoomLabel}</span>
              )}
            </td>
            <td style={{ ...cellBorder, textAlign: 'center' }}>
              {isDaily && !isBlank ? safeDoc.days_count : ''}
            </td>
            <td style={{ ...cellBorder, textAlign: 'center' }}>&nbsp;</td>
            <td style={{ ...cellBorder, textAlign: 'right', fontWeight: 600 }}>
              {isBlank ? null : editable ? (
                <input
                  value={safeDoc.room_rate ?? 0}
                  onChange={(e) => emitField('room_rate', e.target.value)}
                  type="number"
                  className="dotted-input"
                  style={{ width: '100%', textAlign: 'right', fontWeight: 600 }}
                />
              ) : (
                <span>{formatNumber(safeDoc.room_rate)}</span>
              )}
            </td>
          </tr>

          {/* Row 2: Water */}
          <tr>
            <td style={{ ...cellBorder, textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 500 }}>ค่าน้ำประปา</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12.5px' }}>
                  <span>เลขครั้งก่อน</span>
                  {isBlank ? (
                    <span style={{ display: 'inline-block', width: '48px', borderBottom: '1px dotted #000000' }}>&nbsp;</span>
                  ) : editable ? (
                    <input
                      value={safeDoc.water_prev ?? ''}
                      onChange={(e) => emitField('water_prev', e.target.value)}
                      className="dotted-input"
                      style={{ width: '48px', textAlign: 'center', fontWeight: 600 }}
                    />
                  ) : (
                    <span style={{ display: 'inline-block', minWidth: '40px', textAlign: 'center', fontWeight: 600 }}>
                      {safeDoc.water_prev || ''}
                    </span>
                  )}
                  <span>ครั้งหลัง</span>
                  {isBlank ? (
                    <span style={{ display: 'inline-block', width: '48px', borderBottom: '1px dotted #000000' }}>&nbsp;</span>
                  ) : editable ? (
                    <input
                      value={safeDoc.water_curr ?? ''}
                      onChange={(e) => emitField('water_curr', e.target.value)}
                      className="dotted-input"
                      style={{ width: '48px', textAlign: 'center', fontWeight: 600 }}
                    />
                  ) : (
                    <span style={{ display: 'inline-block', minWidth: '40px', textAlign: 'center', fontWeight: 600 }}>
                      {safeDoc.water_curr || ''}
                    </span>
                  )}
                </div>
              </div>
            </td>
            <td style={{ ...cellBorder, textAlign: 'center', fontWeight: 600 }}>
              {isBlank ? null : editable ? (
                <input
                  value={safeDoc.water_units ?? ''}
                  onChange={(e) => emitField('water_units', e.target.value)}
                  className="dotted-input"
                  style={{ width: '100%', textAlign: 'center' }}
                />
              ) : (
                <span>
                  {safeDoc.water_calc_type === 'meter' && safeDoc.water_units
                    ? safeDoc.water_units
                    : safeDoc.water_calc_type !== 'meter' && safeDoc.water_total
                      ? 'เหมาจ่าย'
                      : ''}
                </span>
              )}
            </td>
            <td style={{ ...cellBorder, textAlign: 'center' }}>
              {isBlank ? null : editable ? (
                <input
                  value={safeDoc.water_unit_price ?? ''}
                  onChange={(e) => emitField('water_unit_price', e.target.value)}
                  className="dotted-input"
                  style={{ width: '100%', textAlign: 'center' }}
                />
              ) : (
                <span>{safeDoc.water_calc_type === 'meter' ? (safeDoc.water_unit_price || 10) : ''}</span>
              )}
            </td>
            <td style={{ ...cellBorder, textAlign: 'right', fontWeight: 600 }}>
              {isBlank ? null : editable ? (
                <input
                  value={safeDoc.water_total ?? 0}
                  onChange={(e) => emitField('water_total', e.target.value)}
                  type="number"
                  className="dotted-input"
                  style={{ width: '100%', textAlign: 'right', fontWeight: 600 }}
                />
              ) : (
                <span>{safeDoc.water_total ? formatNumber(safeDoc.water_total) : ''}</span>
              )}
            </td>
          </tr>

          {/* Row 3: Electric */}
          <tr>
            <td style={{ ...cellBorder, textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 500 }}>ค่าไฟฟ้า</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12.5px' }}>
                  <span>เลขครั้งก่อน</span>
                  {isBlank ? (
                    <span style={{ display: 'inline-block', width: '48px', borderBottom: '1px dotted #000000' }}>&nbsp;</span>
                  ) : editable ? (
                    <input
                      value={safeDoc.electric_prev ?? ''}
                      onChange={(e) => emitField('electric_prev', e.target.value)}
                      className="dotted-input"
                      style={{ width: '48px', textAlign: 'center', fontWeight: 600 }}
                    />
                  ) : (
                    <span style={{ display: 'inline-block', minWidth: '40px', textAlign: 'center', fontWeight: 600 }}>
                      {safeDoc.electric_prev || ''}
                    </span>
                  )}
                  <span>ครั้งหลัง</span>
                  {isBlank ? (
                    <span style={{ display: 'inline-block', width: '48px', borderBottom: '1px dotted #000000' }}>&nbsp;</span>
                  ) : editable ? (
                    <input
                      value={safeDoc.electric_curr ?? ''}
                      onChange={(e) => emitField('electric_curr', e.target.value)}
                      className="dotted-input"
                      style={{ width: '48px', textAlign: 'center', fontWeight: 600 }}
                    />
                  ) : (
                    <span style={{ display: 'inline-block', minWidth: '40px', textAlign: 'center', fontWeight: 600 }}>
                      {safeDoc.electric_curr || ''}
                    </span>
                  )}
                </div>
              </div>
            </td>
            <td style={{ ...cellBorder, textAlign: 'center', fontWeight: 600 }}>
              {isBlank ? null : editable ? (
                <input
                  value={safeDoc.electric_units ?? ''}
                  onChange={(e) => emitField('electric_units', e.target.value)}
                  className="dotted-input"
                  style={{ width: '100%', textAlign: 'center' }}
                />
              ) : (
                <span>{safeDoc.electric_units ? safeDoc.electric_units : ''}</span>
              )}
            </td>
            <td style={{ ...cellBorder, textAlign: 'center' }}>
              {isBlank ? null : editable ? (
                <input
                  value={safeDoc.electric_unit_price ?? 8}
                  onChange={(e) => emitField('electric_unit_price', e.target.value)}
                  className="dotted-input"
                  style={{ width: '100%', textAlign: 'center' }}
                />
              ) : (
                <span>{safeDoc.electric_units ? (safeDoc.electric_unit_price || 8) : ''}</span>
              )}
            </td>
            <td style={{ ...cellBorder, textAlign: 'right', fontWeight: 600 }}>
              {isBlank ? null : editable ? (
                <input
                  value={safeDoc.electric_total ?? 0}
                  onChange={(e) => emitField('electric_total', e.target.value)}
                  type="number"
                  className="dotted-input"
                  style={{ width: '100%', textAlign: 'right', fontWeight: 600 }}
                />
              ) : (
                <span>{safeDoc.electric_total ? formatNumber(safeDoc.electric_total) : ''}</span>
              )}
            </td>
          </tr>

          {/* Row 4: Other / Deposit Deduction */}
          <tr>
            <td style={{ ...cellBorder, textAlign: 'left', color: safeDoc.other_description || editable ? '#000000' : '#475569' }}>
              {isBlank ? (
                <span>อื่นๆ...............................................</span>
              ) : editable ? (
                <input
                  value={safeDoc.other_description ?? ''}
                  onChange={(e) => emitField('other_description', e.target.value)}
                  className="dotted-input"
                  style={{ width: '100%', fontSize: '13.5px' }}
                  placeholder="อื่นๆ (เช่น หักค่ามัดจำ 2,500 บาท, ค่าปรับ, ส่วนลด...)"
                />
              ) : (
                <span style={{ fontWeight: safeDoc.other_description ? 600 : 400 }}>
                  {safeDoc.other_description ? `อื่นๆ  ${safeDoc.other_description}` : 'อื่นๆ'}
                </span>
              )}
            </td>
            <td style={{ ...cellBorder, textAlign: 'center' }}>&nbsp;</td>
            <td style={{ ...cellBorder, textAlign: 'center' }}>&nbsp;</td>
            <td style={{ ...cellBorder, textAlign: 'right', fontWeight: 600 }}>
              {isBlank ? null : editable ? (
                <input
                  value={safeDoc.other_amount ?? 0}
                  onChange={(e) => emitField('other_amount', e.target.value)}
                  type="number"
                  className="dotted-input"
                  style={{ width: '100%', textAlign: 'right', fontWeight: 600 }}
                />
              ) : (
                <span>{netOtherDisplay}</span>
              )}
            </td>
          </tr>

          {/* Row 5: Grand Total & Thai Baht Text */}
          <tr>
            <td style={{ ...cellBorder, textAlign: 'center', fontWeight: 700, fontSize: '14px' }}>
              {isBlank ? (
                <span>&nbsp;</span>
              ) : editable ? (
                <input
                  value={safeDoc.baht_text ?? ''}
                  onChange={(e) => emitField('baht_text', e.target.value)}
                  className="dotted-input"
                  style={{ width: '100%', textAlign: 'center', fontWeight: 700 }}
                />
              ) : (
                <span>{displayBahtText}</span>
              )}
            </td>
            <td colSpan={2} style={{ ...cellBorder, textAlign: 'center', fontWeight: 700, fontSize: '14px' }}>
              รวม
            </td>
            <td style={{ ...cellBorder, textAlign: 'right', fontWeight: 700, fontSize: '15px' }}>
              {isBlank ? null : editable ? (
                <input
                  value={safeDoc.total_amount ?? 0}
                  onChange={(e) => emitField('total_amount', e.target.value)}
                  type="number"
                  className="dotted-input"
                  style={{ width: '100%', textAlign: 'right', fontWeight: 700 }}
                />
              ) : (
                <span>{formatNumber(safeDoc.total_amount)}</span>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* BOTTOM TRANSFER DETAILS, QR CODE & SIGNATURE */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '6px', paddingLeft: '4px', paddingRight: '4px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, paddingRight: '16px', gap: '8px' }}>
          <div style={{ fontSize: '14.5px', fontWeight: 700, lineHeight: 1.5, color: '#000000' }}>
            <div>
              <span>โอนเลขบัญชี :</span>
              <span style={{ marginLeft: '12px' }}>{bankName}</span>
              <span style={{ marginLeft: '8px' }}>{accountNumber}</span>
            </div>
            <div style={{ paddingLeft: '94px' }}>
              {accountHolder}
            </div>
          </div>

          <div style={{ textAlign: 'right', paddingRight: '28px', paddingTop: '6px', fontSize: '14px' }}>
            <span>ลงชื่อ......................................................ผู้รับเงิน</span>
          </div>
        </div>

        {/* QR Code Box + Name Tag */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', shrink: 0, width: '112px' }}>
          <div style={{ width: '82px', height: '82px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#ffffff' }}>
            {settings?.qr_code_url ? (
              <img
                src={settings.qr_code_url}
                alt="QR Code โอนเงิน"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              <div style={{ width: '78px', height: '78px', border: '1px dashed #64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#64748b', textAlign: 'center' }}>
                QR Code
              </div>
            )}
          </div>
          <div style={{ width: '100%', border: '1px solid #000000', textAlign: 'center', fontSize: '11px', fontWeight: 600, padding: '1px 4px', marginTop: '2px', lineHeight: 1.25 }}>
            {qrCaption}
          </div>
        </div>
      </div>
    </div>
  );
}
