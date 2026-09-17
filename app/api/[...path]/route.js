import { ensureSession, loadSessionWithRuns, commitDay, commitState, resetSession, getRun, probeDatabase } from '../../../lib/store.js';
import { kpis } from '../../../lib/engine/state.js';
import { runDay, resolveHuman, view, WEEK_PLAN, HumanDecisionPending, WeekComplete } from '../../../lib/engine/orchestrator.js';
import { SCENARIO_LEADS } from '../../../lib/engine/scenarios.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json=(body,status=200)=>Response.json(body,{status});
const fail=(detail,status=400)=>json({detail},status);
const sessionId=(request)=>{const raw=(request.headers.get('x-loopos-session')||'').trim();return /^[a-zA-Z0-9_-]{8,80}$/.test(raw)?raw:'public-demo'};
const pub=(r)=>{const {state,before,...publicResult}=r;return {state,before,publicResult}};

async function segments(params){return (await params).path||[]}

export async function GET(request,{params}){
  const p=await segments(params);
  if(p.length===1&&p[0]==='health'){
    try{
      const probe=await probeDatabase();
      return json({status:'ok',service:'loopos',storage:'neon-postgres',platform:'vercel',database:probe.ok?'ok':'error',database_role:probe.role});
    }catch(e){
      return json({status:'degraded',service:'loopos',storage:'neon-postgres',platform:'vercel',database:'error',error_code:e?.code||'DB_CONNECT_FAILED'},503);
    }
  }
  if(p.length===1&&p[0]==='state'){
    const sid=sessionId(request);const {state,runs}=await loadSessionWithRuns(sid);return json(view(state,runs));
  }
  return fail('Not found',404);
}

export async function POST(request,{params}){
  const p=await segments(params),sid=sessionId(request);const body=await request.json().catch(()=>({}));
  if(p.length===1&&p[0]==='reset'){const {state}=await resetSession(sid);return json(view(state,[]));}
  if(p.join('/')==='run/day'){
    const scenario=String(body.scenario||'normal');if(!(scenario in SCENARIO_LEADS))return fail('Unknown scenario',400);
    const {state,version}=await ensureSession(sid);
    try{const r=await runDay(structuredClone(state),scenario),{state:next,before,publicResult}=pub(r);const nv=await commitDay({sessionId:sid,expectedVersion:version,state:next,run:{...publicResult,before,publicResult}});if(nv==null)return fail('Concurrent company update detected. Refresh and retry.',409);return json(publicResult)}catch(e){if(e instanceof HumanDecisionPending||e instanceof WeekComplete)return fail(e.message,409);throw e}
  }
  if(p.join('/')==='run/week'){
    const runs=[];
    while(true){const {state,version}=await ensureSession(sid);const open=state.inbox.filter(i=>i.status==='open').length;if(open)return json({status:'paused_for_human',runs,current_day:state.day,open_human_items:open});if(state.day>=5)return json({status:'complete',runs,current_day:state.day,open_human_items:0});const scenario=WEEK_PLAN[state.day+1],r=await runDay(structuredClone(state),scenario),{state:next,before,publicResult}=pub(r);const nv=await commitDay({sessionId:sid,expectedVersion:version,state:next,run:{...publicResult,before,publicResult}});if(nv==null)return fail('Concurrent company update detected. Refresh and retry.',409);runs.push(publicResult);if(publicResult.human_required)return json({status:'paused_for_human',runs,current_day:publicResult.day,open_human_items:publicResult.kpis_after.open_human_items});}
  }
  if(p.length===2&&p[0]==='human'){
    const {state,version}=await ensureSession(sid),next=structuredClone(state);try{const run_id=resolveHuman(next,p[1],String(body.decision||''),String(body.note||''));const nv=await commitState({sessionId:sid,expectedVersion:version,state:next});if(nv==null)return fail('Concurrent company update detected. Refresh and retry.',409);return json({run_id,inbox_id:p[1],decision:body.decision})}catch(e){return fail(e.message,e.message==='Open inbox item not found'?404:409)}
  }
  if(p.length===2&&p[0]==='replay'){
    const stored=await getRun(sid,p[1]);if(!stored)return fail('Run not found',404);const r=await runDay(structuredClone(stored.before_json),stored.scenario,stored.run_id);return json({run_id:stored.run_id,day:stored.day,scenario:stored.scenario,original_hash:stored.after_hash,replay_hash:r.state_hash,deterministic_match:r.state_hash===stored.after_hash,replay_kpis:kpis(r.state)});
  }
  return fail('Not found',404);
}
