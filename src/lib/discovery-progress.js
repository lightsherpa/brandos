// Keep watching the correlated run; elapsed time cannot establish completion.
export function watchDiscoveryBio({discoveryId, read, onStatus, onComplete, onFailure, schedule = setInterval, cancel = clearInterval}) {
  let active = true;
  let reading = false;
  const tick = async () => {
    if (!active || reading) return;
    reading = true;
    try {
      const bio = await read();
      if (!active) return;
      onStatus(false);
      if (discoveryId && bio?.discovery_id === discoveryId) {
        active = false;
        cancel(timer);
        onComplete(bio);
      }
    } catch(error) {
      if(active&&error?.terminal){active=false;cancel(timer);onFailure?.(error);}
      else if (active) onStatus(true);
    } finally {
      reading = false;
    }
  };
  const timer = schedule(tick, 3000);
  tick();
  return () => { active = false; cancel(timer); };
}
