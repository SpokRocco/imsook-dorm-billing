/**
 * BillAuditSubAgent
 * เอเจนต์ย่อยเฉพาะทางสำหรับคำนวณสมการค่าใช้จ่ายรายห้องและบันทึก Log แยกรายบิลลง Supabase
 * สูตรมาตรฐาน:
 *   ค่าเช่าห้อง + (หน่วยน้ำที่ใช้ * เรทราคา) + (ค่าไฟที่ใช้ * เรทราคา) +/- ค่าใช้จ่ายอื่นๆ = ผลลัพธ์ตามสมการ
 */

function fmtNum(n) {
  return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function buildBillFormulaDetails(input) {
  const roomRate = Number(input.room_rate ?? 0);
  const waterCalcType = input.water_calc_type || 'meter';
  const waterUnits = Number(input.water_units ?? 0);
  const occupantCount = Math.max(1, Number(input.occupant_count ?? 1));
  const waterRate =
    waterCalcType === 'meter'
      ? Number(input.water_unit_price ?? input.water_rate ?? 10)
      : Number(input.water_total ?? 100);
  const waterTotal =
    waterCalcType === 'meter'
      ? waterUnits * waterRate
      : Number(input.water_total ?? (waterCalcType === 'per_person' ? occupantCount * 100 : 100));

  const electricUnits = Number(input.electric_units ?? 0);
  const electricRate = Number(input.electric_unit_price ?? input.electric_rate ?? 8);
  const electricTotal = electricUnits * electricRate;

  const rawOther = Number(input.other_amount ?? 0);
  const depositDeduction = Number(input.deposit_deduction ?? 0);
  const otherAmountSigned = rawOther - depositDeduction;

  const computedTotal = roomRate + waterTotal + electricTotal + otherAmountSigned;

  const waterExpr =
    waterCalcType === 'meter'
      ? `(${fmtNum(waterUnits)} * ${fmtNum(waterRate)})`
      : waterCalcType === 'per_person'
        ? `(เหมา ${occupantCount} คน * ${fmtNum(Math.round(waterTotal / occupantCount))})`
        : `(เหมาจ่าย ${fmtNum(waterTotal)})`;

  const electricExpr = `(${fmtNum(electricUnits)} * ${fmtNum(electricRate)})`;
  const otherExpr =
    otherAmountSigned < 0
      ? `- ${fmtNum(Math.abs(otherAmountSigned))}`
      : `+ ${fmtNum(otherAmountSigned)}`;

  const formulaExpression = `${fmtNum(roomRate)} + ${waterExpr} + ${electricExpr} ${otherExpr} = ${fmtNum(computedTotal)}`;

  return {
    room_rate: roomRate,
    water_calc_type: waterCalcType,
    water_units: waterUnits,
    water_rate: waterRate,
    water_total: waterTotal,
    electric_units: electricUnits,
    electric_rate: electricRate,
    electric_total: electricTotal,
    other_amount_signed: otherAmountSigned,
    deposit_deduction: depositDeduction,
    computed_total: computedTotal,
    formula_expression: formulaExpression
  };
}

export async function runBillAuditSubAgent(supabase, bill, options = {}) {
  const formula = buildBillFormulaDetails(bill);
  const actionStatus = options.action_status || 'recorded';

  const row = {
    invoice_id: options.invoice_id ?? bill.invoice_id ?? null,
    meter_note_id: options.meter_note_id ?? bill.meter_note_id ?? null,
    room_id: bill.room_id || null,
    room_number: String(bill.room_number || '-'),
    zone: String(bill.zone || ''),
    tenant_id: bill.tenant_id || null,
    tenant_name: String(bill.tenant_name || ''),
    billing_month: String(bill.billing_month || ''),
    billing_month_num: Number(bill.billing_month_num || 1),
    billing_year_be: Number(bill.billing_year_be || 2569),
    room_rate: formula.room_rate,
    water_calc_type: formula.water_calc_type,
    water_prev: String(bill.water_prev ?? ''),
    water_curr: String(bill.water_curr ?? ''),
    water_units: formula.water_units,
    water_rate: formula.water_rate,
    water_total: formula.water_total,
    electric_prev: String(bill.electric_prev ?? ''),
    electric_curr: String(bill.electric_curr ?? ''),
    electric_units: formula.electric_units,
    electric_rate: formula.electric_rate,
    electric_total: formula.electric_total,
    other_description: String(bill.other_description ?? ''),
    other_amount_signed: formula.other_amount_signed,
    deposit_deduction: formula.deposit_deduction,
    formula_expression: formula.formula_expression,
    computed_total: formula.computed_total,
    agent_name: options.agent_name || 'BillAuditSubAgent',
    action_status: actionStatus,
    notes: options.notes || bill.notes || ''
  };

  try {
    const { data, error } = await supabase
      .from('bill_audit_logs')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('[BillAuditSubAgent] Insert failed:', error.message);
      return { success: false, error: error.message, formula };
    }
    return { success: true, log: data, formula };
  } catch (err) {
    console.error('[BillAuditSubAgent] Unexpected error:', err.message);
    return { success: false, error: err.message, formula };
  }
}
