// Loaded only by the fourth Playwright server through NODE_OPTIONS.
import { employeeDatabaseFixture } from './employee-database.mjs';
const {transport}=await employeeDatabaseFixture();
const original=globalThis.fetch;
globalThis.fetch=(input,init)=>{
 const value=input instanceof Request?input.url:String(input);
 return value.startsWith('https://employee-fixture.supabase.co/')?transport(input,init):original(input,init);
};
