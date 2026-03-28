// ── Kalkyleberegninger ───────────────────────────────────────────────────

export function compute(project) {
  const riskFactor = { Lav: 1, Normal: 1.1, 'Høy': 1.2 }[project.work.risk] || 1.1;
  const hoursTotal = Number(project.work.hours) || 0;
  const laborCost = hoursTotal * (Number(project.work.internalCost) || 0);
  const laborSaleEx = hoursTotal * (Number(project.work.timeRate) || 0) * riskFactor;
  let matCost = 0, matSaleEx = 0;
  project.materials.forEach(m => {
    const qty = Number(m.qty) || 0, cost = Number(m.cost) || 0, waste = Number(m.waste) || 0, markup = Number(m.markup) || 0;
    const withWaste = qty * cost * (1 + waste / 100);
    matCost += withWaste;
    matSaleEx += withWaste * (1 + markup / 100);
  });
  const lhh = Number(project.work.laborHireHours) || 0, lhr = Number(project.extras.laborHire) || 0;
  const laborHireTotal = lhh > 0 ? (lhr * lhh) : lhr;
  const driftCost = hoursTotal * (Number(project.extras.driftRate) || 0);
  const subTotal = (project.extras.subcontractors || []).reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const extrasBase = (Number(project.extras.rental) || 0) + (Number(project.extras.waste) || 0) + subTotal + laborHireTotal + (Number(project.extras.misc) || 0) + (Number(project.extras.scaffolding) || 0) + (Number(project.extras.drawings) || 0) + driftCost;
  const rigEx = (laborSaleEx + matSaleEx) * ((Number(project.extras.rigPercent) || 0) / 100);
  const costPrice = laborCost + matCost + extrasBase + rigEx;
  const saleEx = laborSaleEx + matSaleEx + extrasBase + rigEx;
  const saleInc = saleEx * 1.25, profit = saleEx - costPrice;
  const margin = saleEx ? (profit / saleEx * 100) : 0;

  // Sum up snapshot materials from offer posts
  let snapMatCost = 0, snapMatSaleEx = 0, snapHours = 0, snapLaborSaleEx = 0, snapLaborCost = 0;
  (project.offerPosts || []).forEach(post => {
    if (post.snapshotCompute) {
      snapMatCost += post.snapshotCompute.matCost || 0;
      snapMatSaleEx += post.snapshotCompute.matSaleEx || 0;
      const postHours = Number(post.hours) || post.snapshotCompute.hoursTotal || 0;
      snapHours += postHours;
      const rf = { Lav: 1, Normal: 1.1, 'Høy': 1.2 }[project.work.risk] || 1.1;
      const rate = post.snapshotCompute.laborSaleEx / (post.snapshotCompute.hoursTotal || 1) / rf;
      const internalRate = post.snapshotCompute.laborCost / (post.snapshotCompute.hoursTotal || 1);
      snapLaborSaleEx += postHours * rate * rf;
      snapLaborCost += postHours * internalRate;
    }
  });
  const totalMatCost = matCost + snapMatCost;
  const totalMatSaleEx = matSaleEx + snapMatSaleEx;
  const computedTotal = hoursTotal + snapHours;
  const totalHours = Number(project.work.hoursOverride) > 0 ? Number(project.work.hoursOverride) : computedTotal;
  const ratePerHour = (Number(project.work.timeRate) || 0) * riskFactor;
  const costPerHour = (Number(project.work.internalCost) || 0);
  const totalLaborSaleEx = hoursTotal * ratePerHour + snapLaborSaleEx;
  const totalLaborCost = hoursTotal * costPerHour + snapLaborCost;
  const totalCostPrice = totalLaborCost + totalMatCost + extrasBase + rigEx;
  const totalSaleEx = totalLaborSaleEx + totalMatSaleEx + extrasBase + rigEx;
  const totalProfit = totalSaleEx - totalCostPrice;
  const totalMargin = totalSaleEx ? (totalProfit / totalSaleEx * 100) : 0;

  return {
    hoursTotal, laborCost, laborSaleEx, matCost, matSaleEx, extrasBase, rigEx,
    costPrice, saleEx, saleInc, vat: saleEx * 0.25, profit, margin, db: margin, driftCost,
    totalMatCost, totalMatSaleEx, totalHours, totalLaborSaleEx, totalLaborCost,
    totalCostPrice, totalSaleEx, totalProfit, totalMargin
  };
}

export function computeOfferPostsTotal(p) {
  if (!p.offerPosts || !p.offerPosts.length) return { fixed: 0, options: 0, total: 0, hours: 0 };
  let fixed = 0, options = 0, hours = 0;
  p.offerPosts.forEach(post => {
    hours += Number(post.snapshotCompute?.hoursTotal) || 0;
    const price = Number(post.price) || 0;
    if (post.type === 'option') { if (post.enabled) options += price; } else fixed += price;
  });
  return { fixed, options, total: fixed + options, hours };
}
