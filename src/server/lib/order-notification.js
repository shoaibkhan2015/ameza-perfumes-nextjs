const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));

const formatMoney = value => `PKR ${Number(value || 0).toLocaleString('en-PK')}`;

function orderEmailHtml(order) {
  const address = order.shippingAddress || {};
  const rows = (order.items || []).map(item => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(item.title)}${item.variantTitle && item.variantTitle !== 'Default Title' ? ` <small>(${escapeHtml(item.variantTitle)})</small>` : ''}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${escapeHtml(item.quantity)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatMoney(Number(item.price) * Number(item.quantity))}</td>
    </tr>`).join('');
  const fullName = [address.firstName, address.lastName].filter(Boolean).join(' ');
  const deliveryAddress = [address.address1, address.city, address.zip, address.country].filter(Boolean).join(', ');

  return `
    <div style="font-family:Arial,sans-serif;color:#17140f;max-width:640px;margin:auto">
      <h1 style="font-family:Georgia,serif">New AMÉZA order #${escapeHtml(order.orderNumber)}</h1>
      <p>A new ${escapeHtml(order.paymentMethod || 'cod')} order has been placed and is awaiting confirmation.</p>
      <h2 style="font-size:16px">Items</h2>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr><th style="text-align:left;padding:8px">Product</th><th style="padding:8px">Qty</th><th style="text-align:right;padding:8px">Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p><b>Subtotal:</b> ${formatMoney(order.subtotal)}<br>
      <b>Shipping:</b> ${formatMoney(order.shipping)}<br>
      ${Number(order.discount) > 0 ? `<b>Discount:</b> −${formatMoney(order.discount)}<br>` : ''}
      <b>Order total:</b> ${formatMoney(order.total)}</p>
      ${order.paymentReference ? `<p><b>Payment reference:</b> ${escapeHtml(order.paymentReference)} (verify manually before confirming payment)</p>` : ''}
      <h2 style="font-size:16px">Customer and delivery</h2>
      <p><b>Name:</b> ${escapeHtml(fullName || 'Not provided')}<br>
      <b>Email:</b> ${escapeHtml(order.email)}<br>
      <b>Phone:</b> ${escapeHtml(order.phone)}<br>
      <b>Address:</b> ${escapeHtml(deliveryAddress || 'Not provided')}</p>
      ${order.note ? `<p><b>Order note:</b> ${escapeHtml(order.note)}</p>` : ''}
      <p>Open the AMÉZA admin dashboard to review and confirm this order.</p>
    </div>`;
}

export async function sendNewOrderNotification(order) {
  const { RESEND_API_KEY, ORDER_NOTIFICATION_EMAIL, EMAIL_FROM } = process.env;
  if (!RESEND_API_KEY || !ORDER_NOTIFICATION_EMAIL || !EMAIL_FROM) {
    console.warn(`[order-email] Notification not sent for order ${order.id}: configure RESEND_API_KEY, ORDER_NOTIFICATION_EMAIL, and EMAIL_FROM.`);
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `ameza-order-${order.id}`,
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [ORDER_NOTIFICATION_EMAIL],
      subject: `New AMÉZA order #${order.orderNumber}`,
      html: orderEmailHtml(order),
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const details = (await response.text()).slice(0, 500);
    throw new Error(`Email provider returned ${response.status}: ${details || response.statusText}`);
  }
}
