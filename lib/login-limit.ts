// Bounds work per normalized account on this instance. Employee logins also use
// the shared, atomic Supabase limiter so parallel Vercel instances share a limit.
const WINDOW=15*60*1000,MAX_ATTEMPTS=20,MAX_BUCKETS=1000;
const buckets=new Map<string,{attempts:number;started:number}>();
export function allowLogin(account='admin',now=Date.now()){
 for(const [key,value] of buckets)if(now-value.started>=WINDOW)buckets.delete(key);
 const current=buckets.get(account);
 if(current){if(current.attempts>=MAX_ATTEMPTS)return false;current.attempts++;return true;}
 if(buckets.size>=MAX_BUCKETS)return false;
 buckets.set(account,{attempts:1,started:now});return true;
}
