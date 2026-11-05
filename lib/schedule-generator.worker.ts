import { generateMonthlySchedule, type GeneratorOptions } from './schedule-generator';
import type { Store } from './types';
// Runs in a dedicated browser worker so a larger roster stays cancellable.
const scope=self as unknown as {onmessage:(event:MessageEvent<{store:Store;options:GeneratorOptions}>)=>void;postMessage:(value:unknown)=>void};
scope.onmessage=event=>{
 try{scope.postMessage({result:generateMonthlySchedule(event.data.store,event.data.options)});}
 catch(error){scope.postMessage({error:error instanceof Error?error.message:'Não foi possível gerar a sugestão.'});}
};
