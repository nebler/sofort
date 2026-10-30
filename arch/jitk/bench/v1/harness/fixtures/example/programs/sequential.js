async () => {
  const totals = new Map();
  let page = 1;
  while (page !== null) {
    const { orders, next } = await codemode.listOrders({ page });
    for (const o of orders) {
      if (o.status !== 'shipped') continue;
      const order = await codemode.getOrder({ id: o.id });
      let sum = 0;
      for (const item of order.items) sum += item.qty * item.priceCents;
      totals.set(order.customer, (totals.get(order.customer) ?? 0) + sum);
    }
    page = next;
  }
  const ranked = [...totals].sort(([a, x], [b, y]) => y - x || (a < b ? -1 : 1));
  return ranked.slice(0, 3).map(([customer, cents]) => ({ customer, cents }));
}
