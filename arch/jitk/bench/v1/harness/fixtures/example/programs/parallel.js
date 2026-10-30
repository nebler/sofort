async () => {
  const orders = [];
  for (let page = 1; page; ) {
    const r = await codemode.listOrders({ page });
    orders.push(...r.orders);
    page = r.next;
  }
  const shipped = orders.filter(o => o.status === 'shipped');
  const details = await Promise.all(shipped.map(o => codemode.getOrder({ id: o.id })));
  const revenue = {};
  for (const d of details) revenue[d.customer] = (revenue[d.customer] || 0) + d.items.reduce((s, it) => s + it.qty * it.priceCents, 0);
  return Object.entries(revenue)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([customer, cents]) => ({ customer, cents }));
}
