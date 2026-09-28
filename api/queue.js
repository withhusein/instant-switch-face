export default async function handler(req, res) {
  global.pDOOH_QUEUE = global.pDOOH_QUEUE || [];
  
  // Jika player mengambil item, catat timestamp t5
  const t5_player = new Date().toISOString();
  
  if (global.pDOOH_QUEUE.length > 0) {
    const item = global.pDOOH_QUEUE.shift(); // Ambil paling awal (FIFO)
    
    if (global.pDOOH_LOGS && global.pDOOH_LOGS[item.jobId]) {
      const log = global.pDOOH_LOGS[item.jobId];
      log.timestamps.t5_player_fetched = t5_player;
      
      const t1Time = new Date(log.timestamps.t1_microsite_uploaded);
      log.durations.totalLatencySec = ((new Date(t5_player) - t1Time) / 1000).toFixed(2);
      log.status = 'PLAYED_ON_VIDEOTRON';
    }

    return res.status(200).json({ hasItem: true, item: item });
  }

  return res.status(200).json({ hasItem: false, item: null });
}