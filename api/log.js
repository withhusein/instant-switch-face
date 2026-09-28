export default async function handler(req, res) {
  global.pDOOH_LOGS = global.pDOOH_LOGS || {};
  return res.status(200).json({
    total: Object.keys(global.pDOOH_LOGS).length,
    logs: Object.values(global.pDOOH_LOGS).reverse()
  });
}