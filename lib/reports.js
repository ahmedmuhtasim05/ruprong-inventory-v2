import { db } from './db';

export async function getReportSummary(startDate, endDate) {
  // Get invoices in date range
  const invoicesResult = await db.query(
    `SELECT * FROM invoices WHERE invoice_date BETWEEN $1 AND $2 ORDER BY invoice_date`,
    [startDate, endDate]
  );
  const invoices = invoicesResult.rows;

  // Get invoice items
  const invoiceIds = invoices.map(i => i.id);
  let invoiceItems = [];
  if (invoiceIds.length > 0) {
    const itemsResult = await db.query(
      `SELECT ii.*, i.sku, i.name as item_name, i.cost_price as item_cost
       FROM invoice_items ii
       LEFT JOIN items i ON ii.item_id = i.id
       WHERE ii.invoice_id = ANY($1)`,
      [invoiceIds]
    );
    invoiceItems = itemsResult.rows;
  }

  // Get all items for unsold calculation
  const allItemsResult = await db.query('SELECT * FROM items');
  const allItems = allItemsResult.rows;

  // Calculate totals
  let subtotal = 0, discount = 0, delivery = 0, revenue = 0, cost = 0;
  const byInvoice = [];
  const productSales = {};

  for (const inv of invoices) {
    const invItems = invoiceItems.filter(ii => ii.invoice_id === inv.id);
    let invSubtotal = 0, invCost = 0;

    for (const item of invItems) {
      invSubtotal += parseFloat(item.line_total);
      const itemCost = item.item_cost ? parseFloat(item.item_cost) * item.quantity : 0;
      invCost += itemCost;

      // Track product sales
      const key = item.description;
      if (!productSales[key]) {
        productSales[key] = { description: key, qty: 0, revenue: 0, cost: 0, profit: 0 };
      }
      productSales[key].qty += item.quantity;
      productSales[key].revenue += parseFloat(item.line_total);
      productSales[key].cost += itemCost;
      productSales[key].profit += parseFloat(item.line_total) - itemCost;
    }

    const invDiscount = parseFloat(inv.discount_value) || 0;
    const invDelivery = parseFloat(inv.delivery_charge) || 0;
    const invTotal = invSubtotal - invDiscount + invDelivery;

    subtotal += invSubtotal;
    discount += invDiscount;
    delivery += invDelivery;
    revenue += invTotal;
    cost += invCost;

    byInvoice.push({
      invoice_no: inv.invoice_no,
      date: inv.invoice_date,
      customer: inv.customer_name,
      subtotal: invSubtotal,
      discount: invDiscount,
      delivery: invDelivery,
      total: invTotal,
      cost: invCost,
      profit: invTotal - invCost,
    });
  }

  const profit = revenue - cost;
  const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;

  // Calculate unsold inventory
  const soldByItem = {};
  for (const item of invoiceItems) {
    if (item.item_id) {
      soldByItem[item.item_id] = (soldByItem[item.item_id] || 0) + item.quantity;
    }
  }

  const unsoldItems = allItems.map(item => {
    const soldInPeriod = soldByItem[item.id] || 0;
    const qty = item.quantity;
    const unitPrice = parseFloat(item.price) || 0;
    const unitCost = parseFloat(item.cost_price) || 0;
    return {
      sku: item.sku,
      name: item.name,
      category: item.category,
      qty,
      sold_in_period: soldInPeriod,
      unit_price: unitPrice,
      unit_cost: unitCost,
      retail_value: qty * unitPrice,
      cost_value: qty * unitCost,
      profit_potential: qty * (unitPrice - unitCost),
    };
  }).filter(item => item.qty > 0);

  const unsold = {
    totalItems: unsoldItems.length,
    totalQty: unsoldItems.reduce((s, i) => s + i.qty, 0),
    costValue: unsoldItems.reduce((s, i) => s + i.cost_value, 0),
    retailValue: unsoldItems.reduce((s, i) => s + i.retail_value, 0),
    profitPotential: unsoldItems.reduce((s, i) => s + i.profit_potential, 0),
    items: unsoldItems,
  };

  return {
    totals: {
      invoiceCount: invoices.length,
      subtotal,
      discount,
      delivery,
      revenue,
      cost,
      profit,
      marginPct,
      unknownCostLines: invoiceItems.filter(ii => !ii.item_cost).length,
    },
    byInvoice,
    byProduct: Object.values(productSales),
    unsold,
  };
}
